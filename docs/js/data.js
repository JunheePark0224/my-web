// data.js — fetch/cache 데이터 및 필터·정렬 헬퍼

let _cache = null; // { meta, zips }
let _loadPromise = null;

export function loadData() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const [metaRes, zipsRes] = await Promise.all([
      fetch("./data/meta.json"),
      fetch("./data/zips.json"),
    ]);
    if (!metaRes.ok) throw new Error(`meta.json 로드 실패 (HTTP ${metaRes.status})`);
    if (!zipsRes.ok) throw new Error(`zips.json 로드 실패 (HTTP ${zipsRes.status})`);
    const meta = await metaRes.json();
    const zipsPayload = await zipsRes.json();
    const zips = Array.isArray(zipsPayload) ? zipsPayload : zipsPayload.zips || [];
    _cache = { meta, zips };
    return _cache;
  })();
  return _loadPromise;
}

export function getCache() {
  return _cache;
}

export function getCities(meta) {
  return (meta && meta.cities) || [];
}

export function getCategories(meta) {
  return (meta && meta.categories) || [];
}

export function getCityById(meta, cityId) {
  return getCities(meta).find((c) => c.id === cityId) || null;
}

export function getZipsForCity(zips, cityId) {
  if (!cityId) return [];
  return zips.filter((z) => z.city_id === cityId);
}

export function sortZips(list, key, dir = "desc") {
  const sorted = [...list];
  sorted.sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === "zip") {
      av = String(av || "");
      bv = String(bv || "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    }
    av = av === undefined || av === null || Number.isNaN(av) ? -Infinity : Number(av);
    bv = bv === undefined || bv === null || Number.isNaN(bv) ? -Infinity : Number(bv);
    const cmp = av - bv;
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export function filterZipsBySearch(list, query) {
  if (!query) return list;
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((z) => String(z.zip || "").toLowerCase().includes(q));
}

export function topByVitality(list, n = 10) {
  return sortZips(list, "vitality_score", "desc").slice(0, n);
}

// 업종 c 기준 opportunity_score 상위 N ZIP 반환. 각 항목에 편의상 cat 데이터를 펼쳐 붙인다.
export function topOpportunity(list, categoryId, n = 10) {
  // 업체 수가 너무 적은 ZIP은 점포당 수요 추정이 불안정해 전처리에서 후보 제외(opportunity_eligible=false)된다.
  const withCat = list
    .filter((z) => z.cats && z.cats[categoryId] && z.cats[categoryId].opportunity_eligible)
    .map((z) => ({ zip: z, cat: z.cats[categoryId] }));
  withCat.sort((a, b) => {
    const av = Number.isFinite(a.cat.opportunity_score) ? a.cat.opportunity_score : -Infinity;
    const bv = Number.isFinite(b.cat.opportunity_score) ? b.cat.opportunity_score : -Infinity;
    return bv - av;
  });
  return withCat.slice(0, n);
}

export function findZipById(zips, id) {
  return zips.find((z) => z.id === id) || null;
}
