import { PngCanvas, hex2rgb } from './png.mjs';
import { fmtDateDot } from './report-formatting.mjs';
import { fillSurfacePolygon } from './report-map-surface-fill.mjs';
import { fillRing, strokeRing, disc } from './report-map-primitives.mjs';
import { drawReportMapInventoryPoints } from './report-map-inventory-points.mjs';
import { createReportMapProjection } from './report-map-projection.mjs';
import { createReportMapClassPresentation } from './report-map-class-presentation.mjs';
import { restoreOutsideRings } from './report-map-clipping.mjs';
import { drawReportMapScaleAndNorth } from './report-map-scale-orientation.mjs';
import { drawReportMapLegend } from './report-map-legend.mjs';
import { drawReportMapFooter } from './report-map-footer.mjs';

export const DATASET_ASCII = 'ESA WORLDCOVER 2021 V200';

/* Şekil 2 — park sahası haritası.
 * Katman sırası (bilinçli): (1) park dışı bağlam dokusu, (2) park poligonu
 * taban boyası (maskeli/veri yok tonu → poligon içinde beyaz dilim fiziken
 * imkânsız), (3) çözümleme motorunun kesintisiz run-length hücreleri,
 * (4) park sınırı (beyaz halo + koyu mürekkep), (5) envanter noktaları,
 * (6) lejant / ölçek / kuzey oku. */
export const MAP_TONES = { out: [238, 240, 238], nodata: [212, 212, 208], ink: [24, 36, 32], mut: [104, 118, 110], halo: [255, 255, 255] };

export function mapCanvas({ outer, outers = null, surfaceFeatures = [], holes = [], wruns = [], classes = {}, parkName = '', sub = '', sub2 = '', maskHa = 0, points = [], pointStat = null, meta = null }) {
  const PAD = 26, TOP = 96, MAPH = 540, FOOT = 70;
  const { width: W, scale: k, x: X, y: Y } = createReportMapProjection({
    outer, outers, padding: PAD, top: TOP, mapHeight: MAPH
  });
  const { classFor: pngClass, rows: legRows } = createReportMapClassPresentation({ classes, maskHa });
  const H = TOP + MAPH + 16 + legRows.length * 28 + 18 + FOOT;
  const cv = new PngCanvas(W, H, MAP_TONES.out);
  const ring = outer.map(([la, lo]) => [X(lo), Y(la)]);
  fillRing(cv, ring, MAP_TONES.nodata);                       /* taban: veri yok tonu */
  for (const h of holes) fillRing(cv, h.map(([la, lo]) => [X(lo), Y(la)]), MAP_TONES.out);
  for (const r of wruns)                                      /* kesintisiz hücre örtüsü */
    cv.rect(X(r.lo0), Y(r.la1), X(r.lo1), Y(r.la0), hex2rgb((pngClass(r.key) && pngClass(r.key).color) || '#94a3b8'));
  for(const f of surfaceFeatures)for(const poly of f.geometry.coordinates){
    const rings=poly.map(r=>r.map(([lo,la])=>[X(lo),Y(la)]));
    fillSurfacePolygon(cv,rings,hex2rgb(pngClass(f.properties.class)?.color||'#94a3b8'));
  }
  /* KRIPMA GEÇİŞİ: sınıf bantlarının poligon dışına taşan piksellerini bağlam tonuna döndür. */
  const allRings = [...(outers||[outer]).map(r=>r.map(([la,lo])=>[X(lo),Y(la)])), ...holes.map((h) => h.map(([la, lo]) => [X(lo), Y(la)]))];
  restoreOutsideRings(cv, allRings, Math.min(cv.h - 1, TOP + MAPH), MAP_TONES.out);
  /* İNCE ÇERÇEVE (2026-09-28): harita alanı kartografik çerçeve alır; kırpma
   * geçişinden SONRA çizilir (aksi hâlde bağlam dokusu çerçeveyi silerdi). */
  const FR = [206, 210, 206];
  const fx0 = PAD - 12, fy0 = TOP - 12, fx1 = W - PAD + 12, fy1 = TOP + MAPH + 12;
  cv.line(fx0, fy0, fx1, fy0, FR); cv.line(fx0, fy1, fx1, fy1, FR);
  cv.line(fx0, fy0, fx0, fy1, FR); cv.line(fx1, fy0, fx1, fy1, FR);
  strokeRing(cv, ring, MAP_TONES.halo, 2);                    /* halo: sınır her zeminde okunur */
  strokeRing(cv, ring, MAP_TONES.ink, 1);
  /* Eski/hatalı GNSS konumları lejant ve altbilgiye taşmasın. */
  drawReportMapInventoryPoints({
    canvas: cv, points, project: (lon, lat) => [X(lon), Y(lat)],
    frame: { left: fx0, right: fx1, top: fy0, bottom: fy1 },
    disc, tones: MAP_TONES
  });
  const T = (x, y, t, c, sc) => cv.text(x, y, t, c, sc);
  T(PAD, 12, parkName, MAP_TONES.ink, 3);
  T(PAD, 44, sub, MAP_TONES.mut, 2);
  if (sub2) T(PAD, 66, sub2, MAP_TONES.mut, 2);
  /* Belge kimliği sağ üstte: harita tek başına dolaşıma girse bile hangi
   * DGR'ye ait olduğu üzerinde yazılıdır (kullanıcı standardı md. 10). */
  if (meta && meta.id) {
    const tid = String(meta.id);
    T(Math.max(PAD, W - PAD - 12 * tid.length), 12, tid, MAP_TONES.mut, 2);
  }
  drawReportMapLegend({
    canvas: cv, rows: legRows, y: TOP + MAPH + 10, padding: PAD,
    classFor: pngClass, classes, maskHa, points, pointStat, tones: MAP_TONES, text: T
  });
  drawReportMapScaleAndNorth({
    canvas: cv, width: W, padding: PAD, top: TOP, mapHeight: MAPH, scale: k, ink: MAP_TONES.ink
  });
  drawReportMapFooter({
    canvas: cv, width: W, height: H, padding: PAD, footerHeight: FOOT,
    frameTone: FR, tones: MAP_TONES, dataset: DATASET_ASCII, meta
  });
  return cv;
}
export function renderMapPNG(opts) { return mapCanvas(opts).encode(); }

