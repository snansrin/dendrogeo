/* Report-owned geometry helpers. Coordinate order and historic calculations
 * are preserved exactly; this module performs no projection or I/O. */
/* Tek-çift kuralı ile nokta–poligon testi (derece uzayında; halka [lat,lon]). */
export function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const laI = ring[i][0], loI = ring[i][1], laJ = ring[j][0], loJ = ring[j][1];
    if ((laI > lat) !== (laJ > lat) && lon < (loJ - loI) * (lat - laI) / (laJ - laI) + loI) inside = !inside;
  }
  return inside;
}
export function pointInPolygon(lat, lon, outer, holes = []) {
  if (!outer || !pointInRing(lat, lon, outer)) return false;
  for (const h of holes) if (pointInRing(lat, lon, h)) return false;
  return true;
}
/* POLİGON KENDİNİ KESME TARAMASI (2026-09-28 · QA yıldızı): elle çizilen
 * park sınırları düğüm (bowtie) içerebilir. Shoelace/jeodezik alan düğüm
 * loplarını ÇIKARIR, raster hücre ayrışımı farklı sayar → LULC QA eşiği
 * (|kapsama−park|/park ≤ %0,5) haklı olarak takılır. Rapor bu takılmanın
 * NEDENİNİ beyan etmek zorundadır: sayı burada hesaplanır, snapshot'a
 * geometry_qa olarak girer (§2, §7, §9). O(n²) — 600 noktadan büyük
 * halkalarda koşulmaz (null = "taranmadı" demek, ASLA "temiz" demek değil). */
export function ringSelfIntersections(ring) {
  const n = (ring || []).length;
  if (n < 4) return 0;
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const segX = (a, b, c, d) => {
    const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  let c = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segX(ring[i], ring[i + 1], ring[j], ring[j + 1])) c++;
    }
  return c;
}
export function geometrySelfIntersections(outer, holes) {
  let total = ringSelfIntersections(outer);
  for (const h of holes || []) total += ringSelfIntersections(h);
  return total;
}

/* ---------- envanter QA yardımcıları (0011 · v2.1) ---------- */
/* Halka yalnız 2 benzersiz enlem + 2 benzersiz boylam taşıyorsa dikdörtgen
 * (bbox) demektir: gerçek park sınırı değil, arama kutusudur. */
export function bboxRing(ring) {
  const r = (ring || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (r.length < 4) return false;
  return new Set(r.map((p) => p[0])).size === 2 && new Set(r.map((p) => p[1])).size === 2;
}
/* Jeodezik alan (m²): yerel enlem ölçekli shoelace; QA beyanları için. */
export function ringGeodesicAreaM2(ring) {
  const r = (ring || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (r.length < 3) return 0;
  const R = 6371008.8, k = Math.PI / 180;
  const lat0 = r.reduce((a, p) => a + p[0], 0) / r.length, c = Math.cos(lat0 * k);
  const xy = r.map((p) => [p[1] * k * R * c, p[0] * k * R]);
  let s = 0;
  for (let i = 0; i < xy.length - 1; i++) s += xy[i][0] * xy[i + 1][1] - xy[i + 1][0] * xy[i][1];
  return Math.abs(s / 2);
}
