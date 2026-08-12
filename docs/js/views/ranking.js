// views/ranking.js — 랭킹 탭: 정렬 가능한 테이블 + ZIP 검색

import { sortZips, filterZipsBySearch } from "../data.js";
import { fmtInt, fmtStars, fmtScore } from "../format.js";

const COLUMNS = [
  { key: "vitality_rank", label: "순위", num: true },
  { key: "zip", label: "ZIP", num: false },
  { key: "biz_count", label: "업체 수", num: true },
  { key: "review_total", label: "리뷰 활동량", num: true },
  { key: "avg_stars", label: "평균 평점", num: true },
  { key: "vitality_score", label: "상권 활력 점수", num: true },
];

let sortKey = "vitality_score";
let sortDir = "desc";
let searchQuery = "";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cellValue(z, key, maxScore) {
  switch (key) {
    case "vitality_rank":
      return `<td class="num">${fmtInt(z.vitality_rank)}</td>`;
    case "zip":
      return `<td>${escapeHtml(z.zip || "—")}</td>`;
    case "biz_count":
      return `<td class="num">${fmtInt(z.biz_count)}</td>`;
    case "review_total":
      return `<td class="num">${fmtInt(z.review_total)}</td>`;
    case "avg_stars":
      return `<td class="num">${fmtStars(z.avg_stars)}</td>`;
    case "vitality_score": {
      const pct = maxScore > 0 ? Math.max(2, ((Number(z.vitality_score) || 0) / maxScore) * 100) : 0;
      return `<td class="num"><span class="mini-bar"><span class="mini-bar-fill" style="width:${pct}%"></span></span>${fmtScore(z.vitality_score)}</td>`;
    }
    default:
      return `<td>—</td>`;
  }
}

function renderTable(rows) {
  const maxScore = Math.max(...rows.map((z) => Number(z.vitality_score) || 0), 1);
  const headerCells = COLUMNS.map((col) => {
    const active = col.key === sortKey;
    const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
    return `<th class="${col.num ? "num" : ""}">
      <button data-sort-key="${col.key}" aria-label="${escapeHtml(col.label)} 기준 정렬">
        ${escapeHtml(col.label)} <span class="sort-indicator">${arrow}</span>
      </button>
    </th>`;
  }).join("");

  const bodyRows = rows
    .map((z) => {
      const cells = COLUMNS.map((col) => cellValue(z, col.key, maxScore)).join("");
      return `<tr data-zip-id="${escapeHtml(z.id)}" tabindex="0" role="button" aria-label="${escapeHtml(z.zip)} 지도에서 보기">${cells}</tr>`;
    })
    .join("");

  return `<table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows || `<tr><td colspan="${COLUMNS.length}" class="muted">데이터가 없습니다.</td></tr>`}</tbody>
  </table>`;
}

export function render(container, ctx) {
  const { cityZips, actions } = ctx;

  container.innerHTML = `
    <div class="panel">
      <h2>ZIP 랭킹</h2>
      <div class="table-toolbar">
        <input type="search" id="rank-search" placeholder="ZIP 검색" value="${escapeHtml(searchQuery)}" aria-label="ZIP 검색" />
        <span class="muted" id="rank-count"></span>
      </div>
      <div id="rank-table-wrap" style="overflow-x:auto;"></div>
    </div>
  `;

  const wrap = container.querySelector("#rank-table-wrap");
  const countEl = container.querySelector("#rank-count");

  function draw() {
    let rows = filterZipsBySearch(cityZips, searchQuery);
    rows = sortZips(rows, sortKey, sortDir);
    wrap.innerHTML = renderTable(rows);
    countEl.textContent = `${rows.length}개 ZIP`;

    wrap.querySelectorAll("th button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sortKey;
        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = key === "zip" ? "asc" : "desc";
        }
        draw();
      });
    });

    wrap.querySelectorAll("tbody tr[data-zip-id]").forEach((row) => {
      const go = () => actions.goToZipOnMap(row.dataset.zipId);
      row.addEventListener("click", go);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    });
  }

  container.querySelector("#rank-search").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    draw();
  });

  draw();
}
