// views/overview.js — 개요 탭: KPI 카드, 상권 활력 TOP 10, 업종 구성 바 차트

import { topByVitality } from "../data.js";
import { fmtInt, fmtNum, fmtStars, fmtScore } from "../format.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderKpis(city) {
  if (!city) {
    return `<div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">분석 ZIP 수</div><div class="kpi-value">—</div></div>
      <div class="kpi-card"><div class="kpi-label">총 업체 수</div><div class="kpi-value">—</div></div>
      <div class="kpi-card"><div class="kpi-label">총 리뷰 활동량</div><div class="kpi-value">—</div></div>
      <div class="kpi-card"><div class="kpi-label">평균 평점</div><div class="kpi-value">—</div></div>
    </div>`;
  }
  return `<div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">분석 ZIP 수</div>
      <div class="kpi-value">${fmtInt(city.zip_count)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">총 업체 수</div>
      <div class="kpi-value">${fmtInt(city.biz_count)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">총 리뷰 활동량 <span class="muted">(수요 proxy)</span></div>
      <div class="kpi-value">${fmtInt(city.review_count)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">평균 평점</div>
      <div class="kpi-value">${fmtStars(city.avg_stars)}</div>
    </div>
  </div>`;
}

function renderTop10(cityZips, actions) {
  const top = topByVitality(cityZips, 10);
  if (top.length === 0) {
    return `<p class="muted">표시할 ZIP 데이터가 없습니다.</p>`;
  }
  const max = Math.max(...top.map((z) => Number(z.vitality_score) || 0), 1);
  return top
    .map((z, i) => {
      const pct = Math.max(2, ((Number(z.vitality_score) || 0) / max) * 100);
      return `<div class="bar-row clickable" data-zip-id="${escapeHtml(z.id)}" tabindex="0" role="button" aria-label="${escapeHtml(z.zip)} 지도에서 보기">
        <span class="bar-rank">${i + 1}위 ${escapeHtml(z.zip)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="num">${fmtScore(z.vitality_score)}</span>
      </div>`;
    })
    .join("");
}

function renderCategoryMix(city, categories) {
  if (!city || !city.category_mix) return `<p class="muted">업종 데이터가 없습니다.</p>`;
  const entries = categories
    .map((c) => ({ id: c.id, label: c.label_ko, count: city.category_mix[c.id] || 0 }))
    .sort((a, b) => b.count - a.count);
  const max = Math.max(...entries.map((e) => e.count), 1);
  return entries
    .map((e) => {
      const pct = Math.max(1, (e.count / max) * 100);
      return `<div class="cat-bar-row">
        <span>${escapeHtml(e.label)}</span>
        <span class="cat-bar-track"><span class="cat-bar-fill" style="width:${pct}%"></span></span>
        <span class="num">${fmtInt(e.count)}</span>
      </div>`;
    })
    .join("");
}

export function render(container, ctx) {
  const { city, cityZips, categories, actions } = ctx;

  container.innerHTML = `
    ${renderKpis(city)}
    <div class="panel">
      <h2>상권 활력 TOP 10 ZIP</h2>
      <div id="ov-top10">${renderTop10(cityZips, actions)}</div>
    </div>
    <div class="panel">
      <h2>업종 구성</h2>
      <div id="ov-catmix">${renderCategoryMix(city, categories)}</div>
    </div>
  `;

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
}
