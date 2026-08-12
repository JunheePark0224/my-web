// summary.js — ZIP 한 줄 요약 생성. zip이 화면에 등장하는 모든 지점(지도/랭킹/추천)에서 공용으로 사용.

import { isNil } from "./format.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 도시 내 순위 구간 문구
function rankPhrase(rank, zipCount) {
  if (isNil(rank) || !zipCount) return null;
  const r = Math.round(rank);
  const ratio = r / zipCount;
  if (ratio <= 1 / zipCount || r === 1) return "최상위 상권";
  if (ratio <= 0.2) return "상위권 상권";
  if (ratio <= 0.5) return "중상위권 상권";
  if (ratio <= 0.8) return "중하위권 상권";
  return "하위권 상권";
}

// 업체 수 규모 문구 (도시 평균 대비가 아니라 절대 규모 구간으로 단순화)
function sizePhrase(bizCount) {
  if (isNil(bizCount)) return "규모 정보 없음";
  const n = Number(bizCount);
  if (n >= 300) return `업체 ${Math.round(n)}개가 모인 대형 상권`;
  if (n >= 100) return `업체 ${Math.round(n)}개의 중대형 상권`;
  if (n >= 40) return `업체 ${Math.round(n)}개의 중형 상권`;
  return `업체 ${Math.round(n)}개의 소규모 상권`;
}

// 평균 평점 수준 문구
function starsPhrase(avgStars) {
  if (isNil(avgStars)) return null;
  const s = Number(avgStars);
  if (s >= 4.2) return `평균 평점 ${s.toFixed(1)}★로 만족도가 매우 높습니다`;
  if (s >= 3.8) return `평균 평점 ${s.toFixed(1)}★로 만족도가 높습니다`;
  if (s >= 3.4) return `평균 평점 ${s.toFixed(1)}★로 만족도는 보통입니다`;
  return `평균 평점 ${s.toFixed(1)}★로 개선 여지가 있습니다`;
}

// 꼬리 문장의 논조. 접속사를 "으로,"(순접) / "이지만"(역접) 중 무엇으로 쓸지 결정하는 데 쓴다.
function starsTone(avgStars) {
  if (isNil(avgStars)) return "neutral";
  const s = Number(avgStars);
  if (s >= 3.8) return "positive";
  if (s >= 3.4) return "neutral";
  return "negative";
}

// cats에서 업체 수가 가장 많은 업종 라벨
function topCategoryLabel(zip, meta) {
  if (!zip || !zip.cats) return null;
  const entries = Object.entries(zip.cats);
  if (entries.length === 0) return null;
  entries.sort((a, b) => (Number(b[1].biz_count) || 0) - (Number(a[1].biz_count) || 0));
  const [catId] = entries[0];
  const catMeta = meta && Array.isArray(meta.categories) ? meta.categories.find((c) => c.id === catId) : null;
  return catMeta ? catMeta.label_ko : catId;
}

/**
 * ZIP 한 줄 요약 문장을 생성한다.
 * @param {object} zip - zips.json의 ZIP 레코드
 * @param {object} meta - meta.json (categories, cities 참조용)
 * @returns {string} 조건에 따라 실제로 달라지는 한 문장 (plain text, HTML escape는 호출부 책임)
 */
export function zipHeadline(zip, meta) {
  if (!zip) return "선택된 ZIP이 없습니다.";

  const city = meta && Array.isArray(meta.cities) ? meta.cities.find((c) => c.id === zip.city_id) : null;
  const cityName = (city && city.city) || zip.city || "이 도시";
  const zipCount = (city && city.zip_count) || null;
  const rank = zip.vitality_rank;

  const rankPart =
    !isNil(rank) && zipCount
      ? `${cityName} ${zipCount}개 ZIP 중 ${Math.round(rank)}위`
      : `${cityName} 소속 ZIP`;
  const rankTier = rankPhrase(rank, zipCount);

  const sizePart = sizePhrase(zip.biz_count); // "...상권" 으로 끝나는 명사구
  const starsPart = starsPhrase(zip.avg_stars); // "평균 평점 X★로 ~합니다" 완결형 문장
  const catLabel = topCategoryLabel(zip, meta);
  const catPart = catLabel ? `${catLabel} 비중이 가장 높습니다` : null;

  const isUpperTier = rankTier === "최상위 상권" || rankTier === "상위권 상권";

  // 꼬리 문장: 상위권은 업종 비중을 우선 강조, 하위권은 평점(만족도)을 우선 강조해
  // 규모는 작아도 다른 강점이 있을 수 있음을 보여준다. 둘 다 없으면 데이터 부족 문구.
  const tailParts = [];
  let tailTone = "neutral";
  if (isUpperTier) {
    if (catPart) tailParts.push(catPart);
    else if (starsPart) {
      tailParts.push(starsPart);
      tailTone = starsTone(zip.avg_stars);
    }
  } else {
    if (starsPart) {
      tailParts.push(starsPart);
      tailTone = starsTone(zip.avg_stars);
    } else if (catPart) tailParts.push(catPart);
  }

  // 접속사는 앞뒤 논조가 어긋날 때만 역접("이지만")을 쓴다.
  // 큰 상권인데 평점이 낮거나, 작은 상권인데 평점이 좋은 경우가 역접에 해당한다.
  const isBigMarket = !isNil(zip.biz_count) && Number(zip.biz_count) >= 100;
  const contrast =
    (isBigMarket && tailTone === "negative") || (!isBigMarket && tailTone === "positive");
  const connector = contrast ? "이지만" : "으로,";

  let tail = tailParts.join(" ");
  if (!tail) tail = "세부 지표 데이터가 충분하지 않습니다.";
  if (!tail.endsWith(".") && !tail.endsWith("니다")) tail += ".";
  if (!tail.endsWith(".")) tail += ".";

  return `${rankPart} — ${sizePart}${connector} ${tail}`;
}

export function zipHeadlineHtml(zip, meta) {
  return escapeHtml(zipHeadline(zip, meta));
}
