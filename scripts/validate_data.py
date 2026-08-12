# -*- coding: utf-8 -*-
"""docs/data/meta.json, docs/data/zips.json 검증 스크립트."""
import json
import os
import sys
from collections import defaultdict

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
META_PATH = os.path.join(ROOT, "docs", "data", "meta.json")
ZIPS_PATH = os.path.join(ROOT, "docs", "data", "zips.json")

errors = []
warnings = []


def check(cond, msg):
    if not cond:
        errors.append(msg)


def main():
    check(os.path.exists(META_PATH), f"meta.json 없음: {META_PATH}")
    check(os.path.exists(ZIPS_PATH), f"zips.json 없음: {ZIPS_PATH}")
    if errors:
        print_result()
        sys.exit(1)

    meta_size = os.path.getsize(META_PATH)
    zips_size = os.path.getsize(ZIPS_PATH)

    with open(META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    with open(ZIPS_PATH, "r", encoding="utf-8") as f:
        zips_data = json.load(f)

    # --- meta.json structural checks ---
    for key in ("generated_at", "source", "min_biz_per_zip", "cities", "categories", "metrics"):
        check(key in meta, f"meta.json 필수 키 누락: {key}")

    check(isinstance(meta.get("cities"), list) and len(meta["cities"]) > 0, "meta.cities가 비어있음")

    city_ids = set()
    for c in meta.get("cities", []):
        for key, typ in [
            ("id", str), ("city", str), ("state", str), ("zip_count", int),
            ("biz_count", int), ("review_count", int), ("avg_stars", (int, float)),
            ("center", list), ("category_mix", dict),
        ]:
            check(key in c, f"city 레코드에 {key} 누락: {c.get('id')}")
            if key in c:
                check(isinstance(c[key], typ), f"city.{key} 타입 오류: {c.get('id')} -> {type(c[key])}")
        if "center" in c:
            check(len(c["center"]) == 2, f"city.center 길이 오류: {c.get('id')}")
        if "id" in c:
            check(c["id"] not in city_ids, f"city id 중복: {c['id']}")
            city_ids.add(c["id"])
        if "id" in c and "state" in c and "city" in c:
            check(c["id"] == f"{c['state']}-{c['city']}", f"city id 규칙 위반: {c['id']}")

    cat_ids = {cat["id"] for cat in meta.get("categories", [])}
    expected_cats = {"cafe", "restaurant", "bar", "grocery", "beauty", "fitness"}
    check(cat_ids == expected_cats, f"categories 6개 세트 불일치: {cat_ids}")

    # --- zips.json structural checks ---
    check("zips" in zips_data, "zips.json에 zips 키 없음")
    zlist = zips_data.get("zips", [])
    check(len(zlist) > 0, "zips 리스트가 비어있음")

    zip_ids = set()
    norm_range_bad = []
    score_range_bad = []
    bad_city_ref = []
    biz_count_bad = []

    rank_groups = defaultdict(list)  # city_id -> list of vitality_rank
    cat_rank_groups = defaultdict(list)  # (city_id, cat) -> list of opportunity_rank

    for z in zlist:
        for key, typ in [
            ("id", str), ("zip", str), ("city_id", str), ("city", str), ("state", str),
            ("center", list), ("biz_count", int), ("review_total", int),
            ("avg_stars", (int, float)), ("norm_review", (int, float)), ("norm_biz", (int, float)),
            ("norm_stars", (int, float)), ("vitality_score", (int, float)), ("vitality_rank", int),
            ("cats", dict),
        ]:
            check(key in z, f"zip 레코드에 {key} 누락: {z.get('id')}")
            if key in z:
                check(isinstance(z[key], typ), f"zip.{key} 타입 오류: {z.get('id')} -> {type(z[key])}")

        zid = z.get("id")
        if zid in zip_ids:
            errors.append(f"zip id 중복: {zid}")
        zip_ids.add(zid)

        if z.get("biz_count", 0) < 20:
            biz_count_bad.append(zid)

        if z.get("city_id") not in city_ids:
            bad_city_ref.append(zid)

        for nk in ("norm_review", "norm_biz", "norm_stars", "vitality_score"):
            v = z.get(nk)
            if v is None or not (0 <= v <= 100):
                norm_range_bad.append((zid, nk, v))

        rank_groups[z.get("city_id")].append(z.get("vitality_rank"))

        for code, entry in z.get("cats", {}).items():
            for key, typ in [
                ("biz_count", int), ("review_total", int), ("avg_stars", (int, float)),
                ("norm_cat_review", (int, float)), ("norm_cat_biz", (int, float)),
                ("opportunity_score", (int, float)), ("opportunity_rank", int),
            ]:
                check(key in entry, f"cats.{code} 레코드에 {key} 누락: {zid}")
                if key in entry:
                    check(isinstance(entry[key], typ), f"cats.{code}.{key} 타입 오류: {zid}")
            for nk in ("norm_cat_review", "norm_cat_biz", "opportunity_score"):
                v = entry.get(nk)
                if v is None or not (0 <= v <= 100):
                    score_range_bad.append((zid, code, nk, v))
            cat_rank_groups[(z.get("city_id"), code)].append(entry.get("opportunity_rank"))

    check(len(biz_count_bad) == 0, f"biz_count<20 ZIP 포함: {biz_count_bad[:10]}")
    check(len(bad_city_ref) == 0, f"city_id가 meta.cities에 없는 zip: {bad_city_ref[:10]}")
    check(len(norm_range_bad) == 0, f"norm_*/vitality_score 범위 이탈: {norm_range_bad[:10]}")
    check(len(score_range_bad) == 0, f"cats norm/opportunity 범위 이탈: {score_range_bad[:10]}")

    # vitality_rank: 1..N 중복 없이
    for cid, ranks in rank_groups.items():
        n = len(ranks)
        check(sorted(ranks) == list(range(1, n + 1)), f"vitality_rank 1..N 위반 (city={cid}): {sorted(ranks)[:20]}")

    # opportunity_rank: 1..N per (city, cat) 중복 없이
    for (cid, code), ranks in cat_rank_groups.items():
        n = len(ranks)
        check(sorted(ranks) == list(range(1, n + 1)), f"opportunity_rank 1..N 위반 (city={cid},cat={code}): {sorted(ranks)[:20]}")

    print_result(meta, zlist, meta_size, zips_size)
    if errors:
        sys.exit(1)


def print_result(meta=None, zlist=None, meta_size=None, zips_size=None):
    print("=== VALIDATION RESULT ===")
    if meta_size is not None:
        print(f"meta.json size: {meta_size} bytes")
    if zips_size is not None:
        print(f"zips.json size: {zips_size} bytes ({zips_size/1024:.1f} KB)")
    if meta is not None:
        print(f"cities: {len(meta.get('cities', []))}")
    if zlist is not None:
        print(f"zips: {len(zlist)}")
        total_biz = sum(z["biz_count"] for z in zlist)
        total_review = sum(z["review_total"] for z in zlist)
        print(f"sum(zip.biz_count): {total_biz}")
        print(f"sum(zip.review_total): {total_review}")
        cat_zip_counts = defaultdict(int)
        for z in zlist:
            for code in z.get("cats", {}):
                cat_zip_counts[code] += 1
        for code in ("cafe", "restaurant", "bar", "grocery", "beauty", "fitness"):
            n = cat_zip_counts.get(code, 0)
            pct = (n / len(zlist) * 100) if zlist else 0
            print(f"  category coverage [{code}]: {n}/{len(zlist)} zips ({pct:.1f}%)")

    if errors:
        print(f"\nFAIL — {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
    else:
        print("\nPASS — all checks OK")
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  - {w}")


if __name__ == "__main__":
    main()
