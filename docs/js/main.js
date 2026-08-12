// main.js — 부트스트랩 + 라우팅/탭 전환 + 전역 상태

import { loadData, getCities, getCategories, getCityById, getZipsForCity, findZipById } from "./data.js";
import { safe } from "./format.js";
import * as overviewView from "./views/overview.js";
import * as mapView from "./views/map.js";
import * as rankingView from "./views/ranking.js";
import * as opportunityView from "./views/opportunity.js";

const TABS = ["overview", "map", "ranking", "opportunity"];
const DEFAULT_TAB = "overview";

const state = {
  meta: null,
  zips: [],
  cityId: null,
  categoryId: null,
  tab: DEFAULT_TAB,
  selectedZipId: null,
};

const views = {
  overview: overviewView,
  map: mapView,
  ranking: rankingView,
  opportunity: opportunityView,
};

const els = {};

function q(sel) {
  return document.querySelector(sel);
}

function buildCtx() {
  const cityZips = state.cityId ? getZipsForCity(state.zips, state.cityId) : [];
  return {
    meta: state.meta,
    allZips: state.zips,
    cityZips,
    city: state.cityId ? getCityById(state.meta, state.cityId) : null,
    categories: getCategories(state.meta),
    state: {
      cityId: state.cityId,
      categoryId: state.categoryId,
      tab: state.tab,
      selectedZipId: state.selectedZipId,
    },
    actions: {
      goToZipOnMap,
      setCity,
      setCategory,
      selectZip,
      setTab,
    },
  };
}

function setTab(tab, opts = {}) {
  if (!TABS.includes(tab)) tab = DEFAULT_TAB;
  state.tab = tab;
  if (!opts.skipHash) {
    if (location.hash !== `#${tab}`) location.hash = `#${tab}`;
  }
  renderTabs();
  renderActiveView();
}

function goToZipOnMap(zipId) {
  state.selectedZipId = zipId;
  setTab("map");
}

function selectZip(zipId) {
  state.selectedZipId = zipId;
  renderActiveView();
}

function setCity(cityId) {
  if (cityId === state.cityId) return;
  state.cityId = cityId;
  state.selectedZipId = null;
  els.cityAsOf && updateDataAsOf();
  renderAllForCityChange();
}

function setCategory(categoryId) {
  state.categoryId = categoryId;
  if (state.tab === "opportunity") renderActiveView();
}

function renderTabs() {
  const buttons = els.tabbar.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    const active = btn.dataset.tab === state.tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("active", v.id === `view-${state.tab}`);
  });
}

function renderActiveView() {
  const view = views[state.tab];
  const container = q(`#view-${state.tab}`);
  if (view && container) {
    try {
      view.render(container, buildCtx());
    } catch (err) {
      console.error(`[${state.tab}] render error`, err);
      container.innerHTML = `<div class="error-box">화면을 표시하는 중 오류가 발생했습니다: ${escapeHtml(String(err && err.message || err))}</div>`;
    }
  }
}

function renderAllForCityChange() {
  // 도시가 바뀌면 모든 뷰가 다음 활성화 시 최신 데이터로 그려지도록, 활성 뷰만 즉시 갱신하고
  // 나머지는 lazily 다시 그려지게 한다(각 view.render는 매번 전체를 다시 그리므로 안전).
  renderActiveView();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function updateDataAsOf() {
  if (!els.dataAsOf) return;
  const genAt = state.meta && state.meta.generated_at;
  els.dataAsOf.textContent = genAt ? `데이터 기준: Yelp Academic Dataset · ${genAt}` : "";
}

function populateCitySelect() {
  const cities = getCities(state.meta);
  els.citySelect.innerHTML = cities
    .map((c) => `<option value="${c.id}">${escapeHtml(c.city)} (${escapeHtml(c.state)})</option>`)
    .join("");
  if (cities.length > 0) {
    state.cityId = cities[0].id;
    els.citySelect.value = state.cityId;
  }
  els.citySelect.addEventListener("change", () => {
    setCity(els.citySelect.value);
  });
}

function populateCategorySelectPlaceholder() {
  // 업종 선택 드롭다운은 추천 탭 안에 위치. 여기서는 기본 카테고리만 세팅.
  const cats = getCategories(state.meta);
  if (cats.length > 0) {
    state.categoryId = cats[0].id;
  }
}

function buildHeaderAndTabs() {
  const app = q("#app");
  app.innerHTML = `
    <header class="app-header">
      <h1 class="app-title">TradeZone <small>리테일 입지 상권 분석</small></h1>
      <div class="header-controls">
        <span class="field-label">도시</span>
        <select id="city-select" aria-label="도시 선택"></select>
      </div>
      <span class="data-asof" id="data-asof"></span>
    </header>
    <nav class="tabbar" id="tabbar" role="tablist">
      <button class="tab-btn" data-tab="overview" role="tab">개요</button>
      <button class="tab-btn" data-tab="map" role="tab">지도</button>
      <button class="tab-btn" data-tab="ranking" role="tab">랭킹</button>
      <button class="tab-btn" data-tab="opportunity" role="tab">추천</button>
    </nav>
    <main>
      <div class="view" id="view-overview"></div>
      <div class="view" id="view-map"></div>
      <div class="view" id="view-ranking"></div>
      <div class="view" id="view-opportunity"></div>
    </main>
  `;
  els.citySelect = q("#city-select");
  els.dataAsOf = q("#data-asof");
  els.tabbar = q("#tabbar");

  els.tabbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    setTab(btn.dataset.tab);
  });
}

function renderSkeleton() {
  const app = q("#app");
  app.innerHTML = `
    <header class="app-header">
      <h1 class="app-title">TradeZone <small>리테일 입지 상권 분석</small></h1>
    </header>
    <main>
      <div class="panel">
        <div class="skeleton" style="width:40%;margin-bottom:10px;"></div>
        <div class="skeleton" style="width:80%;margin-bottom:10px;"></div>
        <div class="skeleton" style="width:60%;"></div>
      </div>
    </main>
  `;
}

function renderFatalError(err) {
  const app = q("#app");
  app.innerHTML = `
    <header class="app-header">
      <h1 class="app-title">TradeZone <small>리테일 입지 상권 분석</small></h1>
    </header>
    <main>
      <div class="error-box">
        데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.<br/>
        (${escapeHtml(String(err && err.message || err))})
      </div>
    </main>
  `;
}

function initialTabFromHash() {
  const h = (location.hash || "").replace(/^#/, "");
  return TABS.includes(h) ? h : DEFAULT_TAB;
}

async function bootstrap() {
  renderSkeleton();
  try {
    const { meta, zips } = await loadData();
    state.meta = meta;
    state.zips = zips;

    buildHeaderAndTabs();
    populateCitySelect();
    populateCategorySelectPlaceholder();
    updateDataAsOf();

    window.addEventListener("hashchange", () => {
      setTab(initialTabFromHash(), { skipHash: true });
    });

    state.tab = initialTabFromHash();
    renderTabs();
    renderActiveView();
  } catch (err) {
    console.error("bootstrap failed", err);
    renderFatalError(err);
  }
}

bootstrap();
