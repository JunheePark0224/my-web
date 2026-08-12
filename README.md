# TradeZone — 리테일 입지 상권 분석 대시보드

Yelp Academic Dataset을 ZIP(우편번호) 단위 상권 지표로 가공해, **"어느 동네에 어떤 업종을 출점할 것인가"** 에 답하는 정적 대시보드입니다.

🔗 **배포**: https://JunheePark0224.github.io/my-web/

## 무엇을 하는가

리테일 입지 담당자 관점에서 4개 화면을 제공합니다.

| 화면 | 내용 |
|---|---|
| 개요 | 도시 KPI 4종 + 상권 활력 TOP 10 + 업종 구성 |
| 지도 | ZIP 중심점 마커 — 크기=업체 수, 색=상권 활력 점수 |
| 랭킹 | ZIP 순위표, 전 컬럼 정렬·검색 |
| 추천 | 업종 선택 → 출점 적합도 상위 ZIP + 수치 기반 근거 |

## 지표 산식

도시 **내부** 퍼센타일 랭크(0~100)로 정규화한 뒤 가중 합산합니다.

```
vitality_score = 0.40·norm(리뷰 활동량) + 0.30·norm(업체 수) + 0.30·norm(평균 평점)

opportunity(업종 c)
  = 0.40·norm(업종 c 리뷰 활동량)      # 그 업종 수요가 있는가
  + 0.30·vitality_score                # 상권 자체가 살아있는가
  + 0.30·(100 − norm(업종 c 업체 수))  # 아직 경쟁이 덜 붐비는가
```

## 데이터와 그 한계

- 출처: Yelp Academic Dataset `business.json` (약 2022년 스냅샷)
- 대상: 영업 중 업체 수 상위 **12개 미국 도시**, 업체 20개 이상인 **257개 ZIP**
- 업종 6종: 카페·베이커리 / 음식점 / 주점 / 식료품·편의 / 뷰티·미용 / 피트니스

> ⚠️ **리뷰 수는 유동인구가 아닙니다.** 상권 활동량의 대리 지표(proxy)로만 사용하며, UI에도 "리뷰 활동량 (수요 proxy)"으로 표기합니다. 마찬가지로 기존 업체의 낮은 평점은 "경쟁자가 약하다"는 뜻이 아니라 "개선 여지가 있다"는 관찰로만 서술합니다.

## 구조

```
docs/                  ← GitHub Pages 루트
  index.html
  css/app.css
  js/                  main.js, data.js, format.js, views/*.js
  data/                meta.json, zips.json  (전처리 산출물, 커밋 대상)
  PRD.md               제품 요구사항 (§0에 v1/v1.1 범위 분리)
  DATA_CONTRACT.md     전처리 ↔ 프론트 JSON 계약
scripts/
  build_data.py        business.json → docs/data/*.json
  categories.py        업종 매핑 테이블
  validate_data.py     산출물 스키마·범위 검증
data/                  ← 원본 Yelp 데이터셋 (gitignore, 커밋 안 함)
```

## 로컬 실행

원본 데이터셋(`data/`)은 저장소에 포함되지 않습니다. 사이트만 볼 경우 전처리 없이 바로 실행할 수 있습니다.

```bash
python -m http.server 8000 --directory docs
```

데이터를 다시 만들려면 [Yelp Dataset](https://www.yelp.com/dataset)을 `data/`에 두고:

```bash
python scripts/build_data.py && python scripts/validate_data.py
```

빌드 도구·외부 패키지 없이 동작합니다 (Python 표준 라이브러리 + 순수 정적 HTML/CSS/JS, 지도만 Leaflet CDN).

## 향후 (v1.1)

`review.json` 기반 연도별 트렌드·모멘텀(CAGR), 폐업률, A/B 지역 비교, ZIP 상세 리포트, CSV 내보내기.
