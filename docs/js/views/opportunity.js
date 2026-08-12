// views/opportunity.js — 추천 탭: 업종별 opportunity_score TOP 10 + 근거 문장 자동 생성

import { topOpportunity } from "../data.js";
import { fmtInt, fmtStars, fmtScore, fmtRank, isNil } from "../format.js";
import { zipHeadlineHtml } from "../summary.js";
import { renderOpportunityBreakdown } from "../charts.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pctile(v) {
  return isNil(v) ? null : Math.round(Number(v));
}

function reviewPhrase(normCatRpb, reviewPerBiz, catLabel) {
  const p = pctile(normCatRpb);
  const rpbTxt = isNil(reviewPerBiz) ? "" : `(점포당 리뷰 ${Math.round(Number(reviewPerBiz))}건) `;
  if (p === null) return `${catLabel} 점포당 수요 데이터가 충분하지 않음`;
  // 퍼센타일 100 = 도시 1위. 100 - p 가 0이 되면 "상위 0%"라는 이상한 문구가 되므로 최소 1%로 둔다.
  const topPct = Math.min(100, Math.max(1, 100 - p));
  if (p >= 99) return `${catLabel} 점포당 리뷰 활동량이 ${rpbTxt}도시 최상위권으로, 점포 하나가 감당하는 수요가 큼`;
  if (p >= 75) return `${catLabel} 점포당 리뷰 활동량이 ${rpbTxt}도시 상위 ${topPct}% 수준으로 점포당 수요가 뚜렷함`;
  if (p >= 50) return `${catLabel} 점포당 리뷰 활동량이 ${rpbTxt}도시 상위 ${topPct}% 수준으로 준수한 편`;
  if (p >= 25) return `${catLabel} 점포당 리뷰 활동량이 ${rpbTxt}도시 중위권(상위 ${topPct}%)`;
  return `${catLabel} 점포당 리뷰 활동량은 ${rpbTxt}아직 도시 하위 ${Math.max(1, p)}% 수준으로 점포당 수요가 크지 않음`;
}

function densityPhrase(normCatBiz, bizCount, catLabel) {
  const p = pctile(normCatBiz);
  const countTxt = isNil(bizCount) ? "—" : `${Math.round(bizCount)}개`;
  if (p === null) return `${catLabel} 업체는 ${countTxt}`;
  const topPct = Math.min(100, Math.max(1, 100 - p));
  const botPct = Math.min(100, Math.max(1, p));
  if (p < 25) return `${catLabel} 업체는 ${countTxt}로 경쟁 밀도는 하위 ${botPct}% 수준이라 진입 여지가 있음`;
  if (p < 50) return `${catLabel} 업체는 ${countTxt}로 경쟁 밀도는 중하위권(하위 ${botPct}%)`;
  if (p < 75) return `${catLabel} 업체는 ${countTxt}로 경쟁 밀도가 다소 높은 편(상위 ${topPct}%)`;
  if (p >= 99) return `${catLabel} 업체는 이미 ${countTxt}로 도시 내 경쟁 밀도가 가장 높은 축`;
  return `${catLabel} 업체는 이미 ${countTxt}로 경쟁 밀도가 높아 상위 ${topPct}% 수준`;
}

function vitalityPhrase(vitalityScore, vitalityRank, zipCountInCity) {
  if (isNil(vitalityScore)) return `상권 활력 점수 데이터가 없음`;
  const rankTxt = isNil(vitalityRank) ? "" : `(도시 ${Math.round(vitalityRank)}위${zipCountInCity ? ` / ${zipCountInCity}개 ZIP` : ""})`;
  return `상권 활력 점수 ${Number(vitalityScore).toFixed(1)}${rankTxt}`;
}

function starsPhrase(avgStars, catLabel) {
  if (isNil(avgStars)) return `기존 ${catLabel} 평점 데이터가 없음`;
  const s = Number(avgStars);
  if (s < 3.5) return `기존 ${catLabel} 평균 평점 ${s.toFixed(1)}★로 개선 여지가 있음`;
  if (s < 4.0) return `기존 ${catLabel} 평균 평점 ${s.toFixed(1)}★로 보통 수준`;
  return `기존 ${catLabel} 평균 평점 ${s.toFixed(1)}★로 안정적으로 운영 중`;
}

function buildReason(zip, cat, catLabel, zipCountInCity) {
  const parts = [
    reviewPhrase(cat.norm_cat_rpb, cat.review_per_biz, catLabel),
    densityPhrase(cat.norm_cat_biz, cat.biz_count, catLabel),
    vitalityPhrase(zip.vitality_score, zip.vitality_rank, zipCountInCity),
    starsPhrase(cat.avg_stars, catLabel),
  ];
  return parts.map((p) => `${p}.`).join(" ");
}

function renderCategorySelect(categories, current) {
  return categories
    .map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === current ? "selected" : ""}>${escapeHtml(c.label_ko)}</option>`)
    .join("");
}

function renderCards(top, catLabel, zipCountInCity, meta) {
  if (top.length === 0) {
    return `<p class="muted">이 업종에 대한 추천 ZIP 데이터가 없습니다.</p>`;
  }
  return `<div class="opp-grid">
    ${top
      .map(({ zip, cat }, i) => {
        const reason = buildReason(zip, cat, catLabel, zipCountInCity);
        const rankClass = i < 3 ? ` opp-card-top opp-card-top-${i + 1}` : "";
        // 1위 카드는 범례가 있는 전체판, 나머지는 막대만 있는 축소판.
        const breakdownChart = `<div class="chart-box ${i === 0 ? "chart-box-sm" : "chart-box-mini"}"><canvas id="opp-breakdown-chart-${i}"></canvas></div>`;
        return `<div class="opp-card${rankClass}" data-zip-id="${escapeHtml(zip.id)}" tabindex="0" role="button" aria-label="${escapeHtml(zip.zip)} 지도에서 보기">
          <div class="opp-card-head">
            <span class="opp-rank-badge">${i + 1}위</span>
            <span class="opp-score">${fmtScore(cat.opportunity_score)}</span>
          </div>
          <div class="opp-zip">${escapeHtml(zip.zip)}</div>
          <p class="zip-headline zip-headline-sm">${zipHeadlineHtml(zip, meta)}</p>
          ${breakdownChart}
          <p class="opp-reason">${escapeHtml(zip.zip)} — ${reason}</p>
        </div>`;
      })
      .join("")}
  </div>`;
}

function renderMethodology(meta) {
  const metrics = (meta && meta.metrics) || [];
  return `<details class="methodology">
    <summary>방법론 및 데이터 한계</summary>
    <dl>
      ${metrics
        .map(
          (m) => `<div class="metric-def"><dt>${escapeHtml(m.label_ko)}</dt><dd>${escapeHtml(m.desc_ko)}</dd></div>`
        )
        .join("")}
    </dl>
    <div class="metric-def">
      <dt>출점 적합도(opportunity_score)</dt>
      <dd>업종 c 점포당 리뷰수(review_per_biz) 퍼센타일 40% + 상권 활력 점수 30% + (100 − 업종 c 업체수 퍼센타일) 30%로 산출한 도시 내 0~100 점수. 수요는 있는데 아직 경쟁이 붐비지 않은 ZIP일수록 높게 나옵니다.
      리뷰 총량 대신 점포당 밀도를 쓰는 이유는, 리뷰 총량이 업체 수와 상관관계가 매우 높아(업종별 0.885~0.954) 그대로 쓰면 "수요"항과 "경쟁 여유"항이 서로 상쇄되어 업종 고유의 신호가 거의 사라지기 때문입니다.
      다만 점포당 지표는 분모가 작을수록 불안정해, 도시·업종 평균을 향해 끌어당기는 베이지안 축소(K=10)를 적용하고 <strong>해당 업종 업체가 3개 미만인 ZIP은 추천 후보에서 제외</strong>합니다(지도·랭킹에는 그대로 표시됩니다). 인기 점포 하나뿐인 ZIP이 "미개척 수요"로 오인되는 것을 막기 위한 장치입니다.</dd>
    </div>
    <div class="limits">
      데이터 한계: 본 대시보드는 Yelp Academic Dataset(미국 일부 도시, 2022년 스냅샷)을 기반으로 합니다.
      리뷰 활동량은 실제 유동인구가 아닌 온라인 리뷰 활동의 대리 지표(proxy)이며, 임대료·매출 등 실거래 데이터는 포함되어 있지 않습니다.
      평점이 낮다는 것은 "경쟁자가 약하다"는 뜻이 아니라 "기존 업체 평균 평점이 낮아 개선 여지가 있다"는 관찰로만 해석해야 합니다.
    </div>
  </details>`;
}

export function render(container, ctx) {
  const { cityZips, categories, meta, actions, state } = ctx;
  const categoryId = state.categoryId || (categories[0] && categories[0].id) || null;
  const catMeta = categories.find((c) => c.id === categoryId);
  const catLabel = catMeta ? catMeta.label_ko : categoryId || "업종";

  const top = categoryId ? topOpportunity(cityZips, categoryId, 10) : [];

  container.innerHTML = `
    <div class="panel">
      <h2>업종별 출점 추천</h2>
      <div class="opp-toolbar">
        <span class="field-label">업종</span>
        <select id="opp-cat-select" aria-label="업종 선택">${renderCategorySelect(categories, categoryId)}</select>
      </div>
      <div id="opp-cards">${renderCards(top, catLabel, cityZips.length, meta)}</div>
    </div>
    <div class="panel">
      ${renderMethodology(meta)}
    </div>
  `;

  container.querySelector("#opp-cat-select").addEventListener("change", (e) => {
    actions.setCategory(e.target.value);
  });

  container.querySelectorAll("[data-zip-id]").forEach((el) => {
    const go = () => actions.goToZipOnMap(el.dataset.zipId);
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });

  top.forEach(({ zip, cat }, i) => {
    renderOpportunityBreakdown(`opp-breakdown-chart-${i}`, cat, zip.vitality_score, i > 0);
  });
}
