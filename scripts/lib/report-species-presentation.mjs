const GROUP_TR = { 'İBRELİ': 'ibreli', 'IBRELI': 'ibreli', 'YAPRAKLI': 'yapraklı', 'DİĞER': 'diğer', 'DIGER': 'diğer' };
/* Şekil 1 bar renkleri (kullanıcı isteği 2026-09-28): ibreli = yeşil,
 * yapraklı = turuncu, diğer = gri. CSS varsayılanı yaprak yeşili kalır. */
const GRP_COLORS = { 'İBRELİ': '#2f9e44', 'IBRELI': '#2f9e44', 'YAPRAKLI': '#e8590c', 'DİĞER': '#8a928c', 'DIGER': '#8a928c' };
const grpColor = (g) => GRP_COLORS[String(g || '')] || '#8a928c';
export const grpTr = (g) => GROUP_TR[String(g || '')] || String(g || '').toLowerCase();

export const sw = (c) => `<span class="sw" style="background:${c}"></span>`;

export function createReportSpeciesPresentation({esc, trNum}) {
  return function renderSpeciesPresentation(species) {
  /* ---- Şekil 1: grup renkli barlar ---- */
  const maxShare = Math.max(...species.map((s) => s.share_pct), 1);
  const bars = species.map((s) => `<div class="brow"><span class="bl">${esc(s.species)}</span><div class="bar"><i style="width:${(s.share_pct / maxShare * 100).toFixed(1)}%;background:${grpColor(s.grp)}"></i></div><span class="bv">%${trNum(s.share_pct, 1)}</span></div>`).join('');

  /* ---- tür tablosu ---- */
  const spRows = species.map((s) => `<tr><td class="tr">${esc(s.species)}</td><td><span class="grp">${sw(grpColor(s.grp))}${esc(s.grp)}</span></td><td>${s.n}</td><td>${trNum(s.mean_dbh, 1)}</td><td>${trNum(s.mean_h, 1)}</td><td>${trNum(s.carbon_kg, 1)}</td><td>%${trNum(s.share_pct, 1)}</td></tr>`).join('');

    return {bars, spRows};
  };
}
