import { PngCanvas, hex2rgb } from './png.mjs';
import { fmtDateDot } from './report-formatting.mjs';
import { fillSurfacePolygon } from './report-map-surface-fill.mjs';
import { fillRing, strokeRing, disc } from './report-map-primitives.mjs';
import { createReportMapProjection } from './report-map-projection.mjs';
import { createReportMapClassPresentation } from './report-map-class-presentation.mjs';
import { restoreOutsideRings } from './report-map-clipping.mjs';
import { drawReportMapScaleAndNorth } from './report-map-scale-orientation.mjs';

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
  /* Envanter noktaları YALNIZ harita çerçevesi içine çizilir: poligondan
   * çok uzak (eski/hatalı GNSS) bir kayıt lejant/altbilgi üzerine binemez. */
  for (const p of points) {
    const pxX = X(p.lon), pxY = Y(p.lat);
    if (pxX < fx0 || pxX > fx1 || pxY < fy0 || pxY > fy1) continue;
    disc(cv, pxX, pxY, 5, MAP_TONES.halo); disc(cv, pxX, pxY, 3, MAP_TONES.ink);
  }
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
  let ly = TOP + MAPH + 10;
  for (const key of legRows) {
    if (key === 'border') {
      cv.line(PAD + 2, ly + 11, PAD + 20, ly + 11, MAP_TONES.ink);
      T(PAD + 32, ly + 4, 'PARK SINIRI (OSM POLIGONU)', MAP_TONES.ink, 2);
    } else if (key === 'point') {
      disc(cv, PAD + 11, ly + 11, 5, MAP_TONES.halo); disc(cv, PAD + 11, ly + 11, 3, MAP_TONES.ink);
      T(PAD + 32, ly + 4, pointStat && pointStat.outside > 0
        ? `ENVANTER NOKTASI (ICINDE ${pointStat.inside} / DISINDA ${pointStat.outside})`
        : `ENVANTER NOKTASI (n=${points.length}, POLIGON ICINDE)`, MAP_TONES.ink, 2);
    } else if (key === 'outside') {
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, MAP_TONES.out);
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 2, [190, 194, 190]);
      T(PAD + 32, ly + 4, 'PARK DISI (BAGLAM)', MAP_TONES.mut, 2);
    } else if (key === 'masked') {
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, MAP_TONES.nodata);
      T(PAD + 32, ly + 4, `MASKELI (BULUT/GOLGE) ${maskHa.toFixed(2)} ha`, MAP_TONES.mut, 2);
    } else {
      const c = pngClass(key);
      const areaM2 = key === 'water'
        ? Number(classes.water?.areaM2 || 0) + Number(classes.pool?.areaM2 || 0)
        : Number(c?.areaM2 || 0);
      const label = key === 'water' ? (classes.water?.label || 'Su') : c.label;
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, hex2rgb(c.color));
      T(PAD + 32, ly + 4, `${label} ${(areaM2 / 10000).toFixed(2)} ha`, MAP_TONES.ink, 2);
    }
    ly += 28;
  }
  drawReportMapScaleAndNorth({
    canvas: cv, width: W, padding: PAD, top: TOP, mapHeight: MAPH, scale: k, ink: MAP_TONES.ink
  });
  /* ALT BİLGİ ŞERİDİ (kullanıcı standardı md. 10): belge kimliği, veri
   * kaynağı, çözünürlük, projeksiyon, analiz tarihi, motor sürümü ve telif.
   * Metin ASCII'ye translitere edilir (png.mjs glif kümesi); dar tuvallerde
   * punto otomatik küçülür (Tfit), taşma olmaz. */
  const fy = H - FOOT + 12;
  cv.line(PAD, fy - 8, W - PAD, fy - 8, FR);
  const Tfit = (x, y, txt, c) => T(x, y, txt, c, (12 * txt.length <= W - 2 * PAD) ? 2 : 1);
  const idLine = meta && meta.id ? ('DENDROGEO - ' + meta.id) : 'DENDROGEO - BILIMSEL ANALIZ HARITASI';
  T(PAD, fy, idLine, MAP_TONES.ink, 2);
  const brandMark = 'DENDROGEO 2026';
  if (W - PAD - 12 * brandMark.length > PAD + 12 * idLine.length + 8) T(W - PAD - 12 * brandMark.length, fy, brandMark, MAP_TONES.mut, 2);
  Tfit(PAD, fy + 20, 'VERI: ' + ((meta && meta.source) || DATASET_ASCII) + ' / COZUNURLUK: '+(meta?.resolution||'10 M') + (meta && meta.epsg ? ' / PROJEKSIYON: EPSG:' + meta.epsg : ''), MAP_TONES.mut);
  if (meta && (meta.dateStr || meta.engine)) {
    const l3 = (meta.dateStr ? 'ANALIZ TARIHI: ' + meta.dateStr : '') +
      (meta.dateStr && meta.engine ? ' / ' : '') +
      (meta.engine ? 'DENDROGEO LC ENGINE V' + meta.engine : '') + ' / CC BY-NC 4.0';
    Tfit(PAD, fy + 40, l3, MAP_TONES.mut);
  }
  return cv;
}
export function renderMapPNG(opts) { return mapCanvas(opts).encode(); }

