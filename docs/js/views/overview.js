// views/overview.js — 개요 탭: KPI 카드, 상권 활력 TOP 10, 업종 구성 바 차트

import { topByVitality } from "../data.js";
import { fmtInt, fmtNum, fmtStars, fmtScore } from "../format.js";
import { renderCategoryMixDonut, renderVitalityTop10Bar } from "../charts.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const ZIP_EXPLAINER_KEY = "tz-zip-explainer-collapsed";

function renderZipExplainer(cityZips, city) {
  const collapsed = localStorage.getItem(ZIP_EXPLAINER_KEY) === "1";
  const top1 = topByVitality(cityZips, 1)[0];
  const exampleZip = top1 ? top1.zip : "19147";
  const cityName = city ? city.city : "Philadelphia";
  return `<div class="info-callout${collapsed ? " collapsed" : ""}" id="zip-explainer">
    <button class="info-callout-toggle" id="zip-explainer-toggle" aria-expanded="${collapsed ? "false" : "true"}" aria-controls="zip-explainer-body">
      <span class="info-callout-title">ZIP Code란?</span>
      <span class="info-callout-caret" aria-hidden="true">${collapsed ? "▸" : "▾"}</span>
    </button>
    <div class="info-callout-body" id="zip-explainer-body">
      <p>미국의 우편번호(Postal ZIP Code)를 의미합니다. 이 대시보드에서는 하나의 ZIP을 하나의 상권 분석 단위로 사용합니다.</p>
      <p>예: <strong>${escapeHtml(exampleZip)}</strong> = ${escapeHtml(cityName)}의 ZIP Code 지역</p>
    </div>
  </div>`;
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
      <div class="kpi-label">분석 <abbr title="미국 우편번호(Postal ZIP Code). 이 대시보드의 상권 분석 단위입니다.">ZIP</abbr> 수</div>
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
    ${renderZipExplainer(cityZips, city)}
    ${renderKpis(city)}
    <div class="panel">
      <h2>상권 활력 TOP 10 ZIP</h2>
      <div class="chart-box chart-box-tall"><canvas id="ov-vitality-chart"></canvas></div>
      <div id="ov-top10">${renderTop10(cityZips, actions)}</div>
    </div>
    <div class="panel">
      <h2>업종 구성</h2>
      <div class="chart-box"><canvas id="ov-catmix-chart"></canvas></div>
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

  const toggleBtn = container.querySelector("#zip-explainer-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const box = container.querySelector("#zip-explainer");
      const nowCollapsed = !box.classList.contains("collapsed");
      box.classList.toggle("collapsed", nowCollapsed);
      toggleBtn.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
      toggleBtn.querySelector(".info-callout-caret").textContent = nowCollapsed ? "▸" : "▾";
      localStorage.setItem(ZIP_EXPLAINER_KEY, nowCollapsed ? "1" : "0");
    });
  }

  const top10 = topByVitality(cityZips, 10);
  renderVitalityTop10Bar("ov-vitality-chart", top10);

  if (city && city.category_mix && categories.length) {
    const entries = categories
      .map((c) => ({ id: c.id, label: c.label_ko, count: city.category_mix[c.id] || 0 }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
    renderCategoryMixDonut("ov-catmix-chart", entries);
  }
}
