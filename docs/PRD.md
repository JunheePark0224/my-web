# PRD — TradeZone: 리테일 입지 상권 분석 대시보드

- **문서 버전**: v1.0
- **작성일**: 2026-08-12
- **작성**: 기획 Opus / 구현 Sonnet
- **배포 대상**: GitHub Pages (`https://JunheePark0224.github.io/my-web/`)

---

## 0. 릴리스 범위 — v1(MVP) vs v1.1 ⚠️ 먼저 읽을 것

본 문서의 §3~§7은 **완성형(=v1.1까지 포함)** 설계다.
구현 시간이 1시간으로 제한되어 있으므로 **v1에서 실제로 만드는 것은 아래 표의 v1 열뿐이다.**
구현 담당은 §0과 `docs/DATA_CONTRACT.md`를 우선하며, 충돌 시 §0이 이긴다.

| 항목 | v1 (MVP, 지금 구현) | v1.1 (이후) |
|---|---|---|
| 입력 데이터 | **`business.json` 만** | + `review.json`, `checkin.json` |
| 지표 | `biz_count`, `review_total`, `avg_stars`, `vitality_score`, `opportunity_score` | + `momentum`(CAGR), `churn_rate`, `demand_per_biz`, `saturation` |
| 업종 분류 | **6개** (cafe, restaurant, bar, grocery, beauty, fitness) | 12개 taxonomy |
| 화면 | **개요 / 지도 / 랭킹 / 추천 (4개)** | + A/B 비교, ZIP 상세 리포트 |
| 차트 | 없음 또는 최소 (바 차트 1개) | 라인·레이더·도넛, 연도별 트렌드 |
| 부가 기능 | 없음 | CSV 내보내기, 인쇄 레이아웃, URL 상태 공유, 대표 업체 TOP 10 |
| 산출 JSON | `meta.json`, `zips.json` | + `trends.json`, `top_biz/*.json` |

### v1 지표 산식 (단순화 확정판 — §3.5보다 우선)
```
vitality_score  = 0.40·norm(review_total) + 0.30·norm(biz_count) + 0.30·norm(avg_stars)
opportunity(c)  = 0.40·norm(업종 c 리뷰수) + 0.30·vitality_score + 0.30·(100 − norm(업종 c 업체수))
```
`norm()`은 **도시 내부 퍼센타일 랭크(0~100)**.

### v1 표현 규칙 (정직성)
- `review_total`은 유동인구가 **아니다**. UI에는 **"리뷰 활동량 (수요 proxy)"** 로 표기한다.
- 낮은 평점을 "경쟁자가 약함"으로 단정하지 않는다. **"기존 업체 평균 평점이 낮아 개선 여지가 있음"** 으로 서술한다.

### v1에서 명시적으로 버리는 것
`review.json` 5.3GB 처리 · 연도별 트렌드 · momentum · churn · 레이더 차트 · A/B 비교 · CSV · 인쇄 레이아웃 · URL 상태 공유 · 대표 업체 TOP 10 · 체크인 분석 · 12개 업종 taxonomy

---

## 1. 배경 & 페르소나

### 1.1 페르소나
> **박준희 / 리테일 입지 담당 (상권 분석가)**
> F&B·리테일 브랜드의 신규 출점 후보지를 검토한다. 주 업무는
> (1) 어느 동네에 출점할지 후보를 좁히고,
> (2) 후보지 2~3곳을 정량 비교해 내부 보고서를 쓰고,
> (3) "이 자리에 어떤 업종이 먹히는가"를 근거와 함께 답하는 것.
> 지도는 보되, 최종 산출물은 **숫자로 방어 가능한 순위표**여야 한다.

### 1.2 Pain Point
| # | 문제 | 대시보드가 답할 질문 |
|---|---|---|
| P1 | 후보 동네 리스트를 감으로 좁힘 | "이 도시에서 카페 출점하기 좋은 ZIP TOP 10은?" |
| P2 | 경쟁 밀도를 눈으로만 확인 | "이 ZIP에 이미 몇 개가 있고, 걔들 평점은 어떤가?" |
| P3 | 상권이 뜨는지 지는지 모름 | "최근 3년 리뷰량이 늘고 있나, 꺾였나?" |
| P4 | 후보지 비교가 엑셀 수작업 | "A ZIP vs B ZIP, 지표 나란히" |
| P5 | 보고서용 요약이 없음 | "이 ZIP 한 장 요약 리포트" |

---

## 2. 목표 / 비목표

### 2.1 목표 (Goals)
- G1. Yelp 실제 데이터로 **ZIP 단위 상권 지표**를 산출하고 신뢰 가능한 근거를 제시한다.
- G2. 업종을 고르면 **출점 추천 ZIP TOP N**을 이유와 함께 제시한다.
- G3. 지도·랭킹·비교·상세 4개 뷰가 **하나의 ZIP 선택 상태**로 이어진다.
- G4. 백엔드 없이 **GitHub Pages 정적 배포**로 동작한다.

### 2.2 비목표 (Non-Goals)
- 실거래가/임대료 등 실제 부동산 가격 데이터 (Yelp에 없음 — 대체 지표로 상권 활력을 사용)
- 사용자 계정, 저장, 협업 기능
- 실시간 데이터 갱신 (데이터는 빌드 타임 스냅샷)
- 모바일 전용 최적화 (반응형은 대응하되 데스크톱 우선)

---

## 3. 데이터

### 3.1 소스
`data/` (Yelp Academic Dataset, JSON Lines)

| 파일 | 크기 | 사용 |
|---|---|---|
| `business.json` | 119MB | **핵심**. ZIP·업종·평점·리뷰수·좌표·영업여부 |
| `review.json` | 5.3GB | 연도별 리뷰 수/평점 트렌드 (1-pass 스트리밍 스캔, 텍스트 폐기) |
| `checkin.json` | 287MB | (v1.1 후보) 요일·시간대 유동 패턴 |
| `tip.json` / `user.json` | — | v1 미사용 |

### 3.2 스키마 (핵심 필드)
```
business: business_id, name, address, city, state, postal_code,
          latitude, longitude, stars, review_count, is_open, categories
review:   business_id, stars, date
```

### 3.3 분석 단위
- **기본 단위 = `(state, city, postal_code)` 조합의 ZIP**
- 노이즈 컷: 사업체 **20개 미만 ZIP은 제외** (통계 불안정)
- 대상 도시: Yelp 커버리지 상위 도시 (Philadelphia, Tampa, Tucson, Indianapolis, Nashville, New Orleans, Reno, Edmonton, Saint Louis, Santa Barbara 등 — 전처리 시 사업체 수 기준 상위 N개 자동 선정)

### 3.4 업종 분류 (Category Taxonomy)
`categories` 문자열(쉼표 구분, 평균 4~6개 태그)을 **12개 상위 업종**으로 매핑:

| 코드 | 업종 | 대표 태그 |
|---|---|---|
| `cafe` | 카페·베이커리 | Coffee & Tea, Bakeries, Desserts |
| `restaurant` | 음식점 | Restaurants, Food |
| `bar` | 주점·나이트라이프 | Bars, Nightlife, Pubs |
| `grocery` | 식료품·편의 | Grocery, Convenience Stores |
| `retail_fashion` | 패션·잡화 | Fashion, Shoes, Accessories |
| `beauty` | 뷰티·미용 | Hair Salons, Nail Salons, Beauty & Spas |
| `health` | 헬스·의료 | Health & Medical, Doctors, Dentists |
| `fitness` | 피트니스 | Gyms, Fitness & Instruction, Yoga |
| `auto` | 자동차 | Automotive, Auto Repair |
| `home_service` | 홈서비스 | Home Services, Contractors |
| `entertainment` | 여가·문화 | Arts & Entertainment, Active Life |
| `professional` | 전문 서비스 | Professional Services, Financial Services |

한 사업체가 복수 업종에 속할 수 있음(다중 매핑 허용). 어디에도 안 걸리면 `other`.

### 3.5 파생 지표 (Metric Definitions)

ZIP `z`, 업종 `c` 기준. 모든 점수는 도시 내부에서 **0~100 정규화**(퍼센타일 랭크)한다.

| 지표 | 정의 | 의미 |
|---|---|---|
| `biz_count` | 영업 중(`is_open=1`) 사업체 수 | 상권 규모 |
| `demand` | ZIP 내 총 리뷰 수 | **수요/유동인구 프록시** |
| `demand_per_biz` | `demand / biz_count` | 점포당 수요 = 포화도의 역 |
| `avg_stars` | 리뷰수 가중 평균 평점 | 기존 사업자 경쟁력 |
| `saturation` | 해당 업종 점포수 / ZIP 전체 점포수 | 업종 포화도 |
| `momentum` | 최근 3년 리뷰수 CAGR (연도별 트렌드 기반) | **뜨는 상권 / 지는 상권** |
| `churn` | 폐업(`is_open=0`) 비율 | 리스크 |
| `vitality` | 종합 상권 활력 점수 (아래 식) | 히트맵 기본 지표 |

```
vitality = 0.35·norm(demand) + 0.25·norm(momentum) + 0.20·norm(demand_per_biz)
         + 0.15·norm(avg_stars) + 0.05·(1 − norm(churn))
```

**출점 적합도 (opportunity score)** — 업종 `c` 선택 시:
```
opportunity(z, c) = 0.30·norm(demand_c)            # 그 업종 수요가 있는가
                  + 0.25·(1 − norm(saturation_c))  # 아직 안 붐비는가
                  + 0.20·norm(momentum_c)          # 뜨고 있는가
                  + 0.15·(1 − norm(avg_stars_c))   # 기존 경쟁자가 약한가 (빈틈)
                  + 0.10·norm(demand_per_biz)      # 점포당 수요 여력
```
> `avg_stars`를 역방향으로 쓰는 이유: 수요는 큰데 기존 점포 평점이 낮은 곳 = "잘하면 먹을 수 있는 자리". 이 해석을 UI에 명시한다.

### 3.6 산출물 (정적 JSON, `web/data/`)
| 파일 | 내용 | 예상 크기 |
|---|---|---|
| `meta.json` | 도시 목록, 업종 목록, 생성일, 데이터 커버리지 | < 20KB |
| `zips.json` | ZIP × 전체 지표 + 좌표(중심점) + 업종별 지표 | 1~3MB |
| `trends.json` | ZIP × 연도 × (리뷰수, 평균평점) — 2010~2022 | 1~2MB |
| `top_biz/{city}.json` | 도시별 대표 사업체 상위 목록 (상세 리포트용) | 각 < 500KB |

> 원본 데이터(`data/`)는 **git에 커밋하지 않는다**(`.gitignore`). 커밋 대상은 전처리 산출 JSON만.

---

## 4. 정보 구조 (IA) & 화면 정의

단일 페이지(SPA, 해시 라우팅) + 상단 글로벌 컨트롤(도시 선택 / 업종 선택 / 지표 선택).

```
┌ Header: TradeZone | 도시▾ | 업종▾ | 지표▾ | 데이터 기준일
├ Tab: [개요] [지도] [랭킹] [비교] [추천]
└ Content
```

### S1. 개요 (Overview) — 진입 화면
- KPI 카드 5개: 분석 ZIP 수 / 총 사업체 / 총 리뷰 / 평균 평점 / 도시 모멘텀
- 상권 활력 TOP 5 ZIP 미니 랭킹 (클릭 → 상세)
- 도시 전체 연도별 리뷰 트렌드 라인차트
- 업종 구성 도넛/바 차트

### S2. 지도 (Map)
- Leaflet + OSM 타일, ZIP 중심점 **원형 마커**(반지름 = 사업체 수, 색 = 선택 지표 점수)
- 선택 지표 전환: `vitality` / `demand` / `momentum` / `avg_stars` / 선택 업종 `opportunity`
- 범례 + 마커 클릭 → 우측 사이드 패널에 ZIP 요약 → "상세 리포트" 버튼
- ZIP 폴리곤 대신 중심점 원형 사용 (폴리곤 GeoJSON은 용량·라이선스 이슈로 v1 제외)

### S3. 랭킹 (Ranking Table)
- 컬럼: ZIP / 지역명 / 사업체수 / 리뷰수 / 평균평점 / 모멘텀 / 폐업률 / 활력점수
- 정렬(모든 컬럼), 필터(최소 사업체 수 슬라이더, 업종), 검색(ZIP)
- 행 클릭 → 상세, 체크박스 2개 선택 → "비교하기"
- CSV 내보내기 (보고서 작업용)

### S4. 비교 (A vs B)
- ZIP 2개 선택 → 좌우 대칭 레이아웃
- 지표 8종 나란히 + 우세한 쪽 하이라이트
- 레이더 차트(정규화 지표 6축) + 연도별 트렌드 겹쳐 그리기
- 업종 구성 비교 바차트

### S5. 추천 (Opportunity Finder) — 핵심 기능
- 상단: **업종 선택** + 도시 선택 + (선택) 최소 사업체 수
- 출력: `opportunity` 상위 10개 ZIP 카드
- 각 카드에 **선정 이유 자동 문장 생성**:
  > "19147 — 리뷰 수요는 도시 상위 12%인데 카페 점포는 8개뿐(포화도 하위 20%). 최근 3년 리뷰 +34%. 기존 카페 평균 3.6★로 경쟁 강도 낮음."
- 카드 클릭 → 상세 리포트

### S6. ZIP 상세 리포트 (모달 또는 라우트 `#/zip/{state}-{zip}`)
- 헤더: ZIP, 도시/주, 활력 점수 + 도시 내 순위 뱃지
- 지표 그리드 8종 (도시 평균 대비 델타 표시)
- 연도별 리뷰/평점 트렌드 차트
- 업종 구성 바차트 + 업종별 opportunity 미니 테이블
- 대표 사업체 TOP 10 (이름/업종/평점/리뷰수)
- **인쇄 가능 레이아웃** (보고서 첨부용, `@media print`)

---

## 5. 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| F1 | 도시 전환 시 모든 뷰 데이터 동기 갱신 | Must |
| F2 | 업종 전환 시 지도/랭킹/추천 지표가 업종 기준으로 재계산 | Must |
| F3 | 지도 마커 색상·크기 인코딩 + 범례 | Must |
| F4 | 랭킹 테이블 정렬/필터/검색 | Must |
| F5 | ZIP 2개 비교 뷰 | Must |
| F6 | 업종별 추천 TOP N + 자동 생성 근거 문장 | Must |
| F7 | ZIP 상세 리포트 | Must |
| F8 | URL 해시로 상태 공유 (`#/rank?city=Philadelphia&cat=cafe`) | Should |
| F9 | CSV 내보내기 | Should |
| F10 | 인쇄용 리포트 스타일 | Should |
| F11 | 지표 산식 설명 툴팁/방법론 페이지 | Should |
| F12 | 체크인 기반 시간대 분석 | Could (v1.1) |

---

## 6. 비기능 요구사항

- **성능**: 초기 로드 3초 이내(3G Fast 제외), 초기 페이로드 gzip 후 1MB 미만 목표. `trends.json`·`top_biz`는 지연 로드.
- **호환성**: 최신 Chrome/Edge/Safari/Firefox. IE 미지원.
- **접근성**: 색상만으로 정보 전달 금지(수치 병기), 대비 4.5:1 이상, 키보드 포커스 표시.
- **정직성**: Yelp 데이터의 한계(리뷰 = 유동인구의 프록시일 뿐, 미국 일부 도시만 커버, 2022년 스냅샷)를 **방법론 섹션에 명시**한다.

---

## 7. 기술 스택 & 배포

> 로컬에 Node/npm 없음 → **빌드 스텝 없는 순수 정적 사이트**로 간다. GitHub Pages와 궁합이 가장 좋음.

| 레이어 | 선택 | 비고 |
|---|---|---|
| 전처리 | Python 3.12 표준 라이브러리 (`json`, `csv`) | 5.3GB 스트리밍 처리, 외부 의존성 0 |
| 프론트 | Vanilla JS (ES Modules) + HTML + CSS | 번들러 없음 |
| 지도 | Leaflet 1.9 (CDN) + OpenStreetMap 타일 | |
| 차트 | Chart.js 4 (CDN) | 라인/바/도넛/레이더 전부 커버 |
| 스타일 | 자체 CSS (CSS 변수 기반 디자인 토큰) | 라이트 테마 비즈니스 리포트 톤 |
| 배포 | GitHub Pages — `main` 브랜치 `/docs` 폴더 | Actions 불필요 |

### 7.1 디자인 시스템 (라이트 / 비즈니스 리포트)
```
--bg:        #F7F8FA   배경
--surface:   #FFFFFF   카드
--border:    #E3E6EB
--text:      #14181F   본문
--text-mut:  #616B7A   보조
--accent:    #1F5FD0   주 액션 / 링크
--pos:       #17795E   상승·우세
--neg:       #C0392B   하락·열세
--seq:       #EEF3FB → #1F5FD0  (히트맵 5단계 순차 스케일)
```
- 폰트: system-ui 스택 / 숫자는 `font-variant-numeric: tabular-nums`
- 라운드 8px, 그림자는 최소, 표는 얇은 경계선 위주
- 차트 색: 범주형 6색 팔레트 고정, 색 + 라벨 병기

### 7.2 저장소 구조
```
/docs                 ← GitHub Pages 루트 (사이트 본체)
  index.html
  css/app.css
  js/  main.js, state.js, views/*.js, charts.js, map.js, format.js
  data/  meta.json, zips.json, trends.json, top_biz/*.json
/scripts
  build_data.py       ← 전처리 (data/ → docs/data/)
  categories.py       ← 업종 매핑 테이블
/docs/PRD.md          ← 본 문서
README.md
.gitignore            ← data/ 제외
```
> 주의: PRD 문서와 사이트가 같은 `/docs`에 있으므로, Pages 배포 시 `PRD.md`는 정적 파일로 함께 노출된다(문제 없음, 오히려 방법론 링크로 활용).

---

## 8. 성공 기준 (Acceptance Criteria)

- [ ] AC1. `python scripts/build_data.py` 실행 시 `docs/data/*.json`이 생성되고, 총 용량 6MB 이하
- [ ] AC2. 5개 탭이 모두 렌더링되고 도시/업종 전환 시 오류 없이 갱신
- [ ] AC3. 지도에서 마커 클릭 → 상세 리포트 도달 가능
- [ ] AC4. 랭킹에서 ZIP 2개 선택 → 비교 뷰 정상 동작
- [ ] AC5. 업종 선택 시 추천 카드에 **수치가 채워진 근거 문장**이 나옴
- [ ] AC6. 콘솔 에러 0건
- [ ] AC7. GitHub Pages URL에서 동일하게 동작 (상대경로 확인)
- [ ] AC8. 방법론 섹션에 지표 산식과 데이터 한계가 기술됨

---

## 9. 리스크

| 리스크 | 대응 |
|---|---|
| review.json 5.3GB 처리 시간/메모리 | 라인 단위 스트리밍, 필요한 3개 필드만 파싱, business_id→ZIP 딕셔너리 선적재 |
| ZIP 좌표가 없음 | 해당 ZIP 사업체 좌표의 중앙값을 중심점으로 사용 (이상치에 강함) |
| 리뷰 수 = 유동인구가 아님 | 방법론에 프록시임을 명시, 절대값 대신 상대 순위로 표현 |
| 데이터가 2022년 스냅샷 | 헤더에 "데이터 기준: Yelp Academic Dataset (~2022)" 상시 표기 |
| 정적 JSON 용량 초과 | 상위 도시만 포함, 소수점 절삭, 키 축약 |

---

## 10. 범위 밖 / 다음 버전
- v1.1: 체크인 기반 요일·시간대 히트맵, ZIP 폴리곤 경계, 도시 간 비교
- v1.2: 사용자 가중치 조절 슬라이더(내 기준으로 opportunity 재계산)
