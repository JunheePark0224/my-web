// charts.js — Chart.js 4 렌더 헬퍼. 도시/업종/ZIP 전환 시 기존 인스턴스를 destroy() 하고 다시 그린다.

const SEQ = ["#1F5FD0", "#5B92DF", "#9CC0EE", "#CFE0F7", "#EEF3FB", "#17795E"];
const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Malgun Gothic", sans-serif';

const _instances = new Map(); // canvasId -> Chart instance

function destroyChart(canvasId) {
  const existing = _instances.get(canvasId);
  if (existing) {
    existing.destroy();
    _instances.delete(canvasId);
  }
}

function baseFont() {
  return { family: FONT_FAMILY, size: 12 };
}

function hasChart() {
  return typeof Chart !== "undefined";
}

// ① 업종 구성 도넛 차트 — meta.cities[].category_mix
export function renderCategoryMixDonut(canvasId, entries) {
  if (!hasChart()) return;
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const chart = new Chart(el, {
    type: "doughnut",
    data: {
      labels: entries.map((e) => e.label),
      datasets: [
        {
          data: entries.map((e) => e.count),
          backgroundColor: entries.map((_, i) => SEQ[i % SEQ.length]),
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
      ],
    },
    options: {
      animation: { duration: 300 },
      plugins: {
        legend: { position: "right", labels: { font: baseFont(), color: "#14181F", boxWidth: 12 } },
        tooltip: {
          bodyFont: baseFont(),
          titleFont: baseFont(),
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString("ko-KR")}개`,
          },
        },
      },
      cutout: "60%",
    },
  });
  _instances.set(canvasId, chart);
  return chart;
}

// ② 상권 활력 TOP 10 가로 막대
export function renderVitalityTop10Bar(canvasId, top) {
  if (!hasChart()) return;
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const chart = new Chart(el, {
    type: "bar",
    data: {
      labels: top.map((z) => z.zip),
      datasets: [
        {
          label: "상권 활력 점수",
          data: top.map((z) => Number(z.vitality_score) || 0),
          backgroundColor: "#1F5FD0",
          borderRadius: 4,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      animation: { duration: 300 },
      scales: {
        x: { beginAtZero: true, max: 100, ticks: { font: baseFont(), color: "#616B7A" }, grid: { color: "#E3E6EB" } },
        y: { ticks: { font: baseFont(), color: "#14181F" }, grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { bodyFont: baseFont(), titleFont: baseFont() },
      },
    },
  });
  _instances.set(canvasId, chart);
  return chart;
}

// ③ 선택 ZIP의 업종별 업체 수 가로 막대 — zip.cats[].biz_count
export function renderZipCatBar(canvasId, zip, categories) {
  if (!hasChart()) return;
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const cats = zip && zip.cats ? zip.cats : {};
  const entries = Object.entries(cats)
    .map(([id, c]) => {
      const meta = categories.find((cc) => cc.id === id);
      return { label: meta ? meta.label_ko : id, count: Number(c.biz_count) || 0 };
    })
    .sort((a, b) => b.count - a.count);
  if (entries.length === 0) return;
  const chart = new Chart(el, {
    type: "bar",
    data: {
      labels: entries.map((e) => e.label),
      datasets: [
        {
          label: "업체 수",
          data: entries.map((e) => e.count),
          backgroundColor: "#5B92DF",
          borderRadius: 4,
          maxBarThickness: 16,
        },
      ],
    },
    options: {
      indexAxis: "y",
      animation: { duration: 300 },
      scales: {
        x: { beginAtZero: true, ticks: { font: baseFont(), color: "#616B7A" }, grid: { color: "#E3E6EB" } },
        y: { ticks: { font: baseFont(), color: "#14181F" }, grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { bodyFont: baseFont(), titleFont: baseFont() },
      },
    },
  });
  _instances.set(canvasId, chart);
  return chart;
}

// ④ opportunity_score 구성 분해 스택 바
// opportunity = 0.4*norm_cat_review + 0.3*vitality_score + 0.3*(100-norm_cat_biz)
// compact = true 이면 카드 목록용 축소판(범례·축 눈금 생략). 범례는 1위 카드에서 한 번만 보여준다.
export function renderOpportunityBreakdown(canvasId, cat, vitalityScore, compact = false) {
  if (!hasChart()) return;
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const demand = 0.4 * (Number(cat.norm_cat_review) || 0);
  const vitality = 0.3 * (Number(vitalityScore) || 0);
  const openness = 0.3 * (100 - (Number(cat.norm_cat_biz) || 0));
  const chart = new Chart(el, {
    type: "bar",
    data: {
      labels: ["점수 구성"],
      datasets: [
        { label: "수요 (0.4×리뷰 활동량 퍼센타일)", data: [demand], backgroundColor: "#1F5FD0", borderRadius: 4 },
        { label: "상권 활력 (0.3×vitality)", data: [vitality], backgroundColor: "#5B92DF", borderRadius: 4 },
        { label: "경쟁 여유 (0.3×(100−업체수 퍼센타일))", data: [openness], backgroundColor: "#9CC0EE", borderRadius: 4 },
      ],
    },
    options: {
      indexAxis: "y",
      animation: { duration: 300 },
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: 100,
          ticks: { display: !compact, font: baseFont(), color: "#616B7A" },
          grid: { display: !compact, color: "#E3E6EB" },
          border: { display: !compact },
        },
        y: { stacked: true, ticks: { display: !compact }, grid: { display: false }, border: { display: false } },
      },
      plugins: {
        legend: {
          display: !compact,
          position: "bottom",
          labels: { font: { family: FONT_FAMILY, size: 10 }, color: "#14181F", boxWidth: 10 },
        },
        tooltip: {
          bodyFont: baseFont(),
          titleFont: baseFont(),
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}점` },
        },
      },
    },
  });
  _instances.set(canvasId, chart);
  return chart;
}

export function destroyAll() {
  _instances.forEach((c) => c.destroy());
  _instances.clear();
}
