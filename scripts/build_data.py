# -*- coding: utf-8 -*-
"""TradeZone v1 데이터 전처리.

입력: data/yelp_academic_dataset_business.json (JSON Lines) 단 하나.
출력: docs/data/meta.json, docs/data/zips.json

DATA_CONTRACT.md 스키마를 그대로 따른다. 표준 라이브러리만 사용.
"""
import json
import os
import re
import statistics
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
INPUT_PATH = os.path.join(ROOT, "data", "yelp_academic_dataset_business.json")
OUTPUT_DIR = os.path.join(ROOT, "docs", "data")

sys.path.insert(0, HERE)
from categories import CATEGORY_LABELS_KO, map_categories  # noqa: E402

GENERATED_AT = "2026-08-12"
MIN_BIZ_PER_ZIP = 20
TOP_N_CITIES = 12
ZIP_RE = re.compile(r"^\d{5}$")

CATEGORY_IDS = ["cafe", "restaurant", "bar", "grocery", "beauty", "fitness"]


def normalize_city(raw):
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    return s.title()


def load_records():
    """business.json을 읽어 유효 레코드만 yield.

    유효 조건: postal_code가 5자리 숫자, latitude/longitude가 not null.
    is_open 필터는 여기서 하지 않는다 (집계 단계에서 처리).
    """
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            postal = rec.get("postal_code")
            if not postal or not ZIP_RE.match(postal.strip()):
                continue
            lat = rec.get("latitude")
            lng = rec.get("longitude")
            if lat is None or lng is None:
                continue
            city = normalize_city(rec.get("city"))
            state = rec.get("state")
            if not city or not state:
                continue
            yield {
                "postal_code": postal.strip(),
                "latitude": float(lat),
                "longitude": float(lng),
                "city": city,
                "state": state,
                "stars": rec.get("stars") or 0.0,
                "review_count": rec.get("review_count") or 0,
                "is_open": rec.get("is_open"),
                "categories": rec.get("categories"),
            }


def weighted_avg_stars(items):
    """items: list of (stars, review_count). 리뷰수 가중 평균, 분모 0이면 단순평균, 그것도 불가하면 0."""
    total_w = sum(rc for _, rc in items)
    if total_w > 0:
        return sum(s * rc for s, rc in items) / total_w
    if items:
        return sum(s for s, _ in items) / len(items)
    return 0.0


def percentile_ranks(values):
    """값 리스트 -> 동일 순서의 percentile(0~100, midrank, 소수 2자리) 리스트.

    n==1 이면 50.0. 동점은 평균 순위(0-indexed) 사용.
    """
    n = len(values)
    if n == 0:
        return []
    if n == 1:
        return [50.0]
    order = sorted(range(n), key=lambda i: values[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg_rank = (i + j) / 2.0  # 0-indexed average rank across tie group
        for k in range(i, j + 1):
            ranks[order[k]] = avg_rank
        i = j + 1
    return [round(r / (n - 1) * 100.0, 2) for r in ranks]


def competition_rank(keys):
    """keys: list of sort tuples (already includes tie-break) descending by first element(s).
    Returns list of 1..N ranks matching input order, no duplicates.
    `keys` items are (primary_desc_sort_key, tiebreak_sort_key...) where caller pre-negates
    values that should sort descending.
    """
    n = len(keys)
    order = sorted(range(n), key=lambda i: keys[i])
    ranks = [0] * n
    for rank, idx in enumerate(order, start=1):
        ranks[idx] = rank
    return ranks


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # city_key = (state, normalized_city) -> list of records (postal/latlng valid, any is_open)
    city_records = defaultdict(list)
    for rec in load_records():
        city_records[(rec["state"], rec["city"])].append(rec)

    # City-level aggregation (is_open == 1 only) to pick top 12 cities
    city_stats = {}
    for key, recs in city_records.items():
        open_recs = [r for r in recs if r["is_open"] == 1]
        if not open_recs:
            continue
        biz_count = len(open_recs)
        review_count = sum(r["review_count"] for r in open_recs)
        avg_stars = weighted_avg_stars([(r["stars"], r["review_count"]) for r in open_recs])
        lat_med = statistics.median(r["latitude"] for r in open_recs)
        lng_med = statistics.median(r["longitude"] for r in open_recs)
        cat_mix = defaultdict(int)
        for r in open_recs:
            for c in map_categories(r["categories"]):
                cat_mix[c] += 1
        city_stats[key] = {
            "state": key[0],
            "city": key[1],
            "open_recs": open_recs,
            "biz_count": biz_count,
            "review_count": review_count,
            "avg_stars": avg_stars,
            "center": [lat_med, lng_med],
            "category_mix": dict(cat_mix),
        }

    top_cities = sorted(city_stats.values(), key=lambda c: -c["biz_count"])[:TOP_N_CITIES]
    top_city_keys = {(c["state"], c["city"]) for c in top_cities}

    # Build city id map
    def city_id(state, city):
        return f"{state}-{city}"

    meta_cities = []
    zips_out = []

    for c in top_cities:
        cid = city_id(c["state"], c["city"])

        # Group open records by postal_code within this city
        zip_groups = defaultdict(list)
        for r in c["open_recs"]:
            zip_groups[r["postal_code"]].append(r)

        # Apply ZIP filter: >= MIN_BIZ_PER_ZIP open businesses
        valid_zip_codes = [z for z, recs in zip_groups.items() if len(recs) >= MIN_BIZ_PER_ZIP]

        # Per-zip base stats
        zip_stats = {}
        for z in valid_zip_codes:
            recs = zip_groups[z]
            biz_count = len(recs)
            review_total = sum(r["review_count"] for r in recs)
            avg_stars = weighted_avg_stars([(r["stars"], r["review_count"]) for r in recs])
            lat_med = statistics.median(r["latitude"] for r in recs)
            lng_med = statistics.median(r["longitude"] for r in recs)

            cat_recs = defaultdict(list)
            for r in recs:
                for code in map_categories(r["categories"]):
                    cat_recs[code].append(r)

            zip_stats[z] = {
                "zip": z,
                "biz_count": biz_count,
                "review_total": review_total,
                "avg_stars": avg_stars,
                "center": [lat_med, lng_med],
                "cat_recs": cat_recs,
            }

        zlist = sorted(zip_stats.values(), key=lambda zs: zs["zip"])  # deterministic base order

        # Percentile normalization across zips in this city
        biz_vals = [zs["biz_count"] for zs in zlist]
        rev_vals = [zs["review_total"] for zs in zlist]
        star_vals = [zs["avg_stars"] for zs in zlist]
        norm_biz_l = percentile_ranks(biz_vals)
        norm_rev_l = percentile_ranks(rev_vals)
        norm_star_l = percentile_ranks(star_vals)

        vitality_scores = []
        for zs, nb, nr, ns in zip(zlist, norm_biz_l, norm_rev_l, norm_star_l):
            zs["norm_biz"] = nb
            zs["norm_review"] = nr
            zs["norm_stars"] = ns
            vs = round(0.40 * nr + 0.30 * nb + 0.30 * ns, 2)
            zs["vitality_score"] = vs
            vitality_scores.append(vs)

        # vitality_rank: competition rank desc by vitality_score, tie-break review_total desc, zip asc
        rank_keys = [(-zs["vitality_score"], -zs["review_total"], zs["zip"]) for zs in zlist]
        vranks = competition_rank(rank_keys)
        for zs, vr in zip(zlist, vranks):
            zs["vitality_rank"] = vr

        # Per-category percentile normalization (only among zips where category present)
        for code in CATEGORY_IDS:
            zips_with_cat = [zs for zs in zlist if zs["cat_recs"].get(code)]
            if not zips_with_cat:
                continue
            cat_biz_vals = []
            cat_rev_vals = []
            cat_star_vals = []
            cat_rpb_vals = []

            # 점포당 리뷰수는 분모가 작을수록 불안정하다. 업체 1개짜리 ZIP에 인기 점포가
            # 하나 있으면 "미개척 수요"처럼 보여 추천 상위를 점령한다. 그래서 도시·업종
            # 전체 평균(prior)을 향해 끌어당기는 베이지안 축소를 적용한다.
            #   rpb_adj = (리뷰합 + K*prior) / (업체수 + K)
            # 업체가 많은 ZIP은 prior의 영향이 미미하고, 1~2개짜리는 강하게 보정된다.
            # 그래도 업체가 1~2개면 표본이 너무 작아 추천 후보로 쓸 수 없다(인기 점포 하나가
            # ZIP 전체를 '미개척 수요'로 보이게 만든다). 아래 기준 미만은 추천 후보에서 제외하고,
            # 퍼센타일도 후보 집합 안에서만 계산한다. 제외된 ZIP도 지도·랭킹에는 그대로 나온다.
            SHRINK_K = 10
            MIN_CAT_BIZ_FOR_OPP = 3

            eligible = [zs for zs in zips_with_cat if len(zs["cat_recs"][code]) >= MIN_CAT_BIZ_FOR_OPP]
            city_cat_reviews = 0
            city_cat_biz = 0
            for zs in eligible:
                recs = zs["cat_recs"][code]
                city_cat_biz += len(recs)
                city_cat_reviews += sum(r["review_count"] for r in recs)
            prior_rpb = (city_cat_reviews / city_cat_biz) if city_cat_biz else 0.0

            for zs in zips_with_cat:
                recs = zs["cat_recs"][code]
                cb = len(recs)
                cr = sum(r["review_count"] for r in recs)
                cs = weighted_avg_stars([(r["stars"], r["review_count"]) for r in recs])
                rpb = round(cr / cb, 2) if cb else 0.0
                rpb_adj = round((cr + SHRINK_K * prior_rpb) / (cb + SHRINK_K), 2)
                zs.setdefault("cats", {})[code] = {
                    "biz_count": cb,
                    "review_total": cr,
                    "avg_stars": cs,
                    "review_per_biz": rpb,
                    "review_per_biz_adj": rpb_adj,
                }
                entry = zs["cats"][code]
                entry["opportunity_eligible"] = cb >= MIN_CAT_BIZ_FOR_OPP
                if entry["opportunity_eligible"]:
                    cat_biz_vals.append(cb)
                    cat_rev_vals.append(cr)
                    cat_star_vals.append(cs)
                    cat_rpb_vals.append(rpb_adj)

            # 퍼센타일은 후보(eligible) 집합 안에서만 계산한다. 1~2개짜리 ZIP을 섞으면
            # 분포가 왜곡되어 나머지 ZIP의 점수까지 흔들린다.
            norm_cb = percentile_ranks(cat_biz_vals)
            norm_cr = percentile_ranks(cat_rev_vals)
            norm_rpb = percentile_ranks(cat_rpb_vals)
            for zs, ncb, ncr, nrpb in zip(eligible, norm_cb, norm_cr, norm_rpb):
                entry = zs["cats"][code]
                entry["norm_cat_biz"] = ncb
                entry["norm_cat_review"] = ncr
                entry["norm_cat_rpb"] = nrpb
                opp = 0.40 * nrpb + 0.30 * zs["vitality_score"] + 0.30 * (100 - ncb)
                opp = max(0.0, min(100.0, opp))
                entry["opportunity_score"] = round(opp, 2)

            for zs in zips_with_cat:
                entry = zs["cats"][code]
                if not entry["opportunity_eligible"]:
                    entry["norm_cat_biz"] = None
                    entry["norm_cat_review"] = None
                    entry["norm_cat_rpb"] = None
                    entry["opportunity_score"] = None
                    entry["opportunity_rank"] = None

            opp_rank_keys = [
                (-zs["cats"][code]["opportunity_score"], -zs["cats"][code]["review_total"], zs["zip"])
                for zs in eligible
            ]
            oranks = competition_rank(opp_rank_keys)
            for zs, orank in zip(eligible, oranks):
                zs["cats"][code]["opportunity_rank"] = orank

        # Emit zip records
        for zs in zlist:
            cats_out = {}
            for code, entry in sorted(zs.get("cats", {}).items()):
                cats_out[code] = {
                    "biz_count": entry["biz_count"],
                    "review_total": entry["review_total"],
                    "avg_stars": round(entry["avg_stars"], 2),
                    "review_per_biz": entry["review_per_biz"],
                    "review_per_biz_adj": entry["review_per_biz_adj"],
                    "opportunity_eligible": entry["opportunity_eligible"],
                    "norm_cat_review": entry["norm_cat_review"],
                    "norm_cat_biz": entry["norm_cat_biz"],
                    "norm_cat_rpb": entry["norm_cat_rpb"],
                    "opportunity_score": entry["opportunity_score"],
                    "opportunity_rank": entry["opportunity_rank"],
                }
            zips_out.append({
                "id": f"{c['state']}-{zs['zip']}",
                "zip": zs["zip"],
                "city_id": cid,
                "city": c["city"],
                "state": c["state"],
                "center": [round(zs["center"][0], 6), round(zs["center"][1], 6)],
                "biz_count": zs["biz_count"],
                "review_total": zs["review_total"],
                "avg_stars": round(zs["avg_stars"], 2),
                "norm_review": zs["norm_review"],
                "norm_biz": zs["norm_biz"],
                "norm_stars": zs["norm_stars"],
                "vitality_score": zs["vitality_score"],
                "vitality_rank": zs["vitality_rank"],
                "cats": cats_out,
            })

        meta_cities.append({
            "id": cid,
            "city": c["city"],
            "state": c["state"],
            "zip_count": len(zlist),
            "biz_count": c["biz_count"],
            "review_count": c["review_count"],
            "avg_stars": round(c["avg_stars"], 2),
            "center": [round(c["center"][0], 6), round(c["center"][1], 6)],
            "category_mix": c["category_mix"],
        })

    # Deterministic ordering
    meta_cities_sorted = sorted(meta_cities, key=lambda c: -c["biz_count"])
    zips_out_sorted = sorted(zips_out, key=lambda z: (z["city_id"], z["zip"]))

    meta = {
        "generated_at": GENERATED_AT,
        "source": "Yelp Academic Dataset (business.json)",
        "min_biz_per_zip": MIN_BIZ_PER_ZIP,
        "cities": meta_cities_sorted,
        "categories": [
            {"id": code, "label_ko": CATEGORY_LABELS_KO[code]} for code in CATEGORY_IDS
        ],
        "metrics": [
            {
                "id": "vitality_score",
                "label_ko": "상권 활력 점수",
                "desc_ko": "리뷰 활동량 40% + 업체 수 30% + 평균 평점 30% 가중 합산 (도시 내 퍼센타일 기준 0~100)",
            },
            {
                "id": "review_total",
                "label_ko": "리뷰 활동량",
                "desc_ko": "ZIP 내 영업 중 업체의 누적 리뷰 수. 유동인구 자체가 아니라 상권 활동량의 대리 지표(proxy)",
            },
            {"id": "biz_count", "label_ko": "업체 수", "desc_ko": "현재 영업 중인 업체 수"},
            {"id": "avg_stars", "label_ko": "평균 평점", "desc_ko": "리뷰 수로 가중한 평균 별점"},
        ],
    }

    zips_json = {"zips": zips_out_sorted}

    meta_path = os.path.join(OUTPUT_DIR, "meta.json")
    zips_path = os.path.join(OUTPUT_DIR, "zips.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    with open(zips_path, "w", encoding="utf-8") as f:
        json.dump(zips_json, f, ensure_ascii=False, separators=(",", ":"))

    print(f"cities: {len(meta_cities_sorted)}")
    print(f"zips: {len(zips_out_sorted)}")
    print(f"total_biz: {sum(c['biz_count'] for c in meta_cities_sorted)}")
    print(f"total_review: {sum(c['review_count'] for c in meta_cities_sorted)}")
    print(f"meta.json size: {os.path.getsize(meta_path)} bytes")
    print(f"zips.json size: {os.path.getsize(zips_path)} bytes")


if __name__ == "__main__":
    main()
