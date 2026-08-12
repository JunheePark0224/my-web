// format.js — 숫자/평점/점수 포맷 헬퍼. 값 없음은 항상 '—'로 표기한다.

function isNil(v) {
  return v === null || v === undefined || Number.isNaN(v);
}

export function fmtInt(v) {
  if (isNil(v)) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("ko-KR");
}

export function fmtNum(v, digits = 1) {
  if (isNil(v)) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtStars(v) {
  if (isNil(v)) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}★`;
}

export function fmtScore(v) {
  if (isNil(v)) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function fmtPct(v, digits = 0) {
  if (isNil(v)) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtRank(v) {
  if (isNil(v)) return "—";
  return `${Math.round(v)}위`;
}

export function safe(v, fallback = "—") {
  return isNil(v) || v === "" ? fallback : v;
}

export { isNil };
