# DATA CONTRACT v1 (MVP) — `docs/data/*.json`

전처리(`scripts/build_data.py`)와 프론트엔드가 이 문서를 계약으로 삼는다.
**이 스키마는 변경 금지.**

- 입력은 **`business.json` 단 하나**. `review.json`(5.3GB)은 v1에서 사용하지 않는다.
- 모든 실수는 소수점 **2자리 반올림**.
- 모든 `norm_*` / `*_score`는 **도시 내부 퍼센타일 기준 0~100**.
- 산출 파일은 `meta.json`, `zips.json` **2개뿐**. (trends/top_biz 없음)

---

## 1. `meta.json`

```jsonc
{
  "generated_at": "2026-08-12",
  "source": "Yelp Academic Dataset (business.json)",
  "min_biz_per_zip": 20,
  "cities": [
    {
      "id": "PA-Philadelphia",         // `${state}-${city}` — 전역 유니크 키
      "city": "Philadelphia",
      "state": "PA",
      "zip_count": 42,
      "biz_count": 14569,              // is_open == 1
      "review_count": 812345,
      "avg_stars": 3.74,               // 리뷰수 가중 평균
      "center": [39.9526, -75.1652],   // [lat, lng]
      "category_mix": { "cafe": 410, "restaurant": 3120 }  // 업종코드 → 영업중 업체 수
    }
  ],
  "categories": [
    { "id": "cafe",       "label_ko": "카페·베이커리" },
    { "id": "restaurant", "label_ko": "음식점" },
    { "id": "bar",        "label_ko": "주점·나이트라이프" },
    { "id": "grocery",    "label_ko": "식료품·편의" },
    { "id": "beauty",     "label_ko": "뷰티·미용" },
    { "id": "fitness",    "label_ko": "피트니스·액티비티" }
  ],
  "metrics": [
    { "id": "vitality_score", "label_ko": "상권 활력 점수",
      "desc_ko": "리뷰 활동량 40% + 업체 수 30% + 평균 평점 30% 가중 합산 (도시 내 퍼센타일 기준 0~100)" },
    { "id": "review_total",   "label_ko": "리뷰 활동량",
      "desc_ko": "ZIP 내 영업 중 업체의 누적 리뷰 수. 유동인구 자체가 아니라 상권 활동량의 대리 지표(proxy)" },
    { "id": "biz_count",      "label_ko": "업체 수",     "desc_ko": "현재 영업 중인 업체 수" },
    { "id": "avg_stars",      "label_ko": "평균 평점",   "desc_ko": "리뷰 수로 가중한 평균 별점" }
  ]
}
```

## 2. `zips.json`

```jsonc
{
  "zips": [
    {
      "id": "PA-19147",                // `${state}-${zip}` — 전역 유니크 키
      "zip": "19147",
      "city_id": "PA-Philadelphia",
      "city": "Philadelphia",
      "state": "PA",
      "center": [39.9345, -75.1512],   // 해당 ZIP 업체 좌표의 중앙값 [lat, lng]

      "biz_count": 312,                // is_open == 1 만 집계
      "review_total": 41230,
      "avg_stars": 3.92,

      "norm_review": 88.1,             // 도시 내 퍼센타일 0~100
      "norm_biz": 74.2,
      "norm_stars": 66.0,
      "vitality_score": 78.5,          // 0.4*norm_review + 0.3*norm_biz + 0.3*norm_stars
      "vitality_rank": 3,              // 도시 내 순위 (1 = 최고)

      "cats": {                        // 해당 ZIP에 1개 이상 존재하는 업종만
        "cafe": {
          "biz_count": 8,
          "review_total": 2140,
          "avg_stars": 3.61,
          "review_per_biz": 267.5,     // review_total / biz_count — 점포당 수요 밀도 (표시용 원값)
          "review_per_biz_adj": 198.2, // 베이지안 축소 적용값 (아래 참고). 점수 산출용
          "opportunity_eligible": true,// 업체 3개 미만이면 false. false면 아래 5개 필드가 전부 null
          "norm_cat_review": 76.0,     // 도시 내 해당 업종 리뷰 총량 퍼센타일 (표시용)
          "norm_cat_biz": 21.0,        // 도시 내 해당 업종 업체수 퍼센타일 (=경쟁 밀도)
          "norm_cat_rpb": 88.0,        // 도시 내 review_per_biz_adj 퍼센타일 (점수 산출용)
          "opportunity_score": 79.4,   // 아래 산식
          "opportunity_rank": 2        // 도시·업종 내 순위
        }
      }
    }
  ]
}
```

### opportunity_score 산식 v2 (프론트는 재계산하지 않고 그대로 사용)
```
opportunity = 0.40 · norm_cat_rpb             // 점포 하나당 수요가 큰가 (밀도)
            + 0.30 · vitality_score           // 상권 자체가 살아있는가
            + 0.30 · (100 − norm_cat_biz)     // 아직 경쟁이 덜 붐비는가
```
0~100으로 클램프.

> **v1에서 v2로 바꾼 이유.** 처음에는 첫 항이 `norm_cat_review`(리뷰 **총량**)였다.
> 그런데 리뷰 총량과 업체 수의 상관계수가 업종별로 0.885~0.954로 거의 1에 가까워,
> `0.4·x + 0.3·(100−x) = 30 + 0.1·x` 로 상쇄되어 업종 고유 신호가 0~10점으로 눌렸다.
> 반면 `0.3·vitality`는 0~30점을 움직여 3배 강했고, 그 결과 어떤 업종을 골라도
> 상권 활력 순위와 같은 ZIP이 나왔다(Philadelphia 기준 TOP10 중 8~10개 일치).
> 총량을 **점포당 밀도**로 바꾸면 업체 수와의 상관이 끊어져 상쇄가 사라지고,
> "수요는 몰리는데 점포는 적은 곳"이 위로 올라온다.
> (상관계수: `review_total`↔`biz_count` 0.856~0.961 → `review_per_biz`↔`biz_count` 0.489~0.714)

### 소표본 보정 — 점포당 지표를 그대로 쓰면 생기는 문제
점포당 리뷰수는 **분모가 작을수록 불안정**하다. 업체가 1개뿐인 ZIP에 리뷰 378건짜리
인기 카페가 하나 있으면 그 ZIP 전체가 "미개척 수요"처럼 보여 추천 1위를 차지한다.
실제로 v2 최초 적용 시 6개 업종 중 4개에서 **업체 1개짜리 ZIP이 1위**로 올라왔다. 두 가지로 보정한다.

1. **베이지안 축소** — 도시·업종 평균(`prior`)을 향해 끌어당긴다. K=10.
   ```
   review_per_biz_adj = (리뷰합 + K · prior) / (업체수 + K)
   ```
   업체가 많은 ZIP은 거의 영향이 없고, 1~2개짜리만 강하게 보정된다.
2. **최소 표본 기준** — 업종 업체 **3개 미만인 ZIP은 추천 후보에서 제외**한다
   (`opportunity_eligible: false`). 퍼센타일도 후보 집합 안에서만 계산한다 —
   1~2개짜리를 섞으면 분포가 왜곡되어 나머지 ZIP 점수까지 흔들리기 때문이다.
   제외된 ZIP도 **지도·랭킹·상세에는 그대로 나온다.** 추천 목록에서만 빠진다.

---

## 3. 표현 규칙 (UI 문구 — 정직성)
- `review_total`은 **"리뷰 활동량 (수요 proxy)"** 로 표기한다. "유동인구"라고 단정하지 않는다.
- 평점이 낮은 것을 "경쟁자가 약하다"로 단정하지 않는다. 필요 시 **"기존 업체 평균 평점이 낮아 개선 여지가 있음"** 으로 표현한다.
- 추천 근거 문장은 실제 수치를 채워 넣되, 단정 대신 관찰 서술로 쓴다.

## 4. 프론트엔드 로딩 규칙
1. 최초 1회 `./data/meta.json`, `./data/zips.json` 로드 후 메모리 보관. 추가 fetch 없음.
2. 모든 경로는 **상대 경로** (`./data/...`) — GitHub Pages 서브패스 대응.
3. 값 없음은 `—`로 표기. `undefined`/`NaN` 노출 금지.

## 5. 개발용 목업
전처리 완료 전 프론트가 막히지 않도록, 프론트 담당은 스크래치 디렉터리에 이 스키마를 따르는 소형 목업을 만들어 개발하고,
실제 `docs/data/*.json`이 생기면 그것으로 교체 검증한다. **`docs/data/`에는 프론트가 파일을 쓰지 않는다.**
