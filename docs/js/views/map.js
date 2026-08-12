// views/map.js — Leaflet 지도 탭: ZIP center에 circleMarker (반지름=업체수, 색=활력점수)

import { fmtInt, fmtStars, fmtScore, fmtRank } from "../format.js";

const SEQ_COLORS = ["#EEF3FB", "#CFE0F7", "#9CC0EE", "#5B92DF", "#1F5FD0"];

let mapInstance = null;
let markersLayer = null;
let builtContainer = null;
let lastCityId = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function colorForScore(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return SEQ_COLORS[0];
  if (s < 20) return SEQ_COLORS[0];
  if (s < 40) return SEQ_COLORS[1];
  if (s < 60) return SEQ_COLORS[2];
  if (s < 80) return SEQ_COLORS[3];
  return SEQ_COLORS[4];
}

function radiusForCount(count, allCounts) {
  const c = Number(count) || 0;
  const max = Math.max(...allCounts.filter((v) => Number.isFinite(v)), 1);
  const min = Math.min(...allCounts.filter((v) => Number.isFinite(v)), 0);
  const scale = (v) => Math.sqrt(Math.max(v, 0));
  const sMax = scale(max) || 1;
  const sMin = scale(min);
  const t = sMax === sMin ? 1 : (scale(c) - sMin) / (sMax - sMin);
  return 4 + t * (24 - 4);
}

function buildSkeleton(container) {
  container.innerHTML = `
    <div class="panel" style="margin-bottom:12px;">
      <h2>지도</h2>
      <p class="muted" style="margin:0;">원의 크기는 업체 수, 색은 상권 활력 점수를 나타냅니다. 마커를 클릭하면 상세 정보를 볼 수 있습니다.</p>
    </div>
    <div class="map-layout">
      <div id="map" role="application" aria-label="ZIP 상권 지도"></div>
      <div class="map-side-panel">
        <h3>범례</h3>
        <div class="legend">
          <div>
            <div class="legend-scale">
              ${SEQ_COLORS.map((c) => `<span style="background:${c}"></span>`).join("")}
            </div>
            <div class="legend-labels"><span>낮음</span><span>상권 활력 점수</span><span>높음</span></div>
          </div>
          <div>원 크기 = 업체 수 (작을수록 적음)</div>
        </div>
        <h3 style="margin-top:16px;">선택 ZIP</h3>
        <div id="map-zip-detail"><p class="muted" style="margin:0;">지도에서 마커를 클릭하세요.</p></div>
      </div>
    </div>
  `;
  builtContainer = container;
}

function renderZipDetail(z, cityZips) {
  const panel = document.getElementById("map-zip-detail");
  if (!panel) return;
  if (!z) {
    panel.innerHTML = `<p class="muted" style="margin:0;">지도에서 마커를 클릭하세요.</p>`;
    return;
  }
  panel.innerHTML = `
    <div><span class="badge">${escapeHtml(z.zip)}</span></div>
    <div class="zip-detail-grid">
      <div><div class="label">업체 수</div><div class="value">${fmtInt(z.biz_count)}</div></div>
      <div><div class="label">리뷰 활동량 (수요 proxy)</div><div class="value">${fmtInt(z.review_total)}</div></div>
      <div><div class="label">평균 평점</div><div class="value">${fmtStars(z.avg_stars)}</div></div>
      <div><div class="label">상권 활력 점수</div><div class="value">${fmtScore(z.vitality_score)}</div></div>
      <div><div class="label">도시 내 순위</div><div class="value">${fmtRank(z.vitality_rank)} / ${fmtInt(cityZips.length)}</div></div>
    </div>
  `;
}

function popupHtml(z) {
  return `<div style="font-size:13px;line-height:1.5;">
    <strong>${escapeHtml(z.zip)}</strong><br/>
    업체 수: ${fmtInt(z.biz_count)}<br/>
    리뷰 활동량(수요 proxy): ${fmtInt(z.review_total)}<br/>
    평균 평점: ${fmtStars(z.avg_stars)}<br/>
    상권 활력 점수: ${fmtScore(z.vitality_score)} (${fmtRank(z.vitality_rank)})
  </div>`;
}

export function render(container, ctx) {
  if (typeof L === "undefined") {
    container.innerHTML = `<div class="error-box">지도 라이브러리(Leaflet)를 불러오지 못했습니다.</div>`;
    return;
  }

  if (builtContainer !== container || !mapInstance) {
    buildSkeleton(container);
    mapInstance = L.map("map", { scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance);
    markersLayer = L.layerGroup().addTo(mapInstance);
    mapInstance.setView([39.5, -98.35], 4); // fallback US center
    lastCityId = null;
  }

  const { city, cityZips, state, actions } = ctx;

  if (city && city.id !== lastCityId) {
    lastCityId = city.id;
    if (Array.isArray(city.center) && city.center.length === 2) {
      mapInstance.setView(city.center, 12);
    }
  }

  markersLayer.clearLayers();
  const counts = cityZips.map((z) => Number(z.biz_count) || 0);

  cityZips.forEach((z) => {
    if (!Array.isArray(z.center) || z.center.length !== 2) return;
    const isSelected = z.id === state.selectedZipId;
    const marker = L.circleMarker(z.center, {
      radius: radiusForCount(z.biz_count, counts),
      fillColor: colorForScore(z.vitality_score),
      color: isSelected ? "#14181F" : "#1F5FD0",
      weight: isSelected ? 3 : 1,
      fillOpacity: 0.85,
    });
    marker.bindPopup(popupHtml(z));
    marker.on("click", () => {
      actions.selectZip(z.id);
    });
    marker.addTo(markersLayer);
  });

  const selected = cityZips.find((z) => z.id === state.selectedZipId) || null;
  renderZipDetail(selected, cityZips);

  // 탭 전환 시 컨테이너 크기가 0이었을 수 있으므로 표시 시점에 사이즈 재계산
  requestAnimationFrame(() => {
    if (mapInstance) mapInstance.invalidateSize();
  });
}
