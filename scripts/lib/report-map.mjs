import { PngCanvas } from './png.mjs';
import { fmtDateDot } from './report-formatting.mjs';
import { strokeRing, disc } from './report-map-primitives.mjs';
import { drawReportMapInventoryPoints } from './report-map-inventory-points.mjs';
import { createReportMapProjection } from './report-map-projection.mjs';
import { createReportMapClassPresentation } from './report-map-class-presentation.mjs';
import { drawReportMapSurfaceLayers } from './report-map-surface-layers.mjs';
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
  const FR = [206, 210, 206];
  const { ring, frame } = drawReportMapSurfaceLayers({
    canvas: cv, outer, outers, surfaceFeatures, holes, wruns,
    project: (lon, lat) => [X(lon), Y(lat)], classFor: pngClass,
    contextTone: MAP_TONES.out, noDataTone: MAP_TONES.nodata,
    frameTone: FR, padding: PAD, top: TOP, mapHeight: MAPH
  });
  strokeRing(cv, ring, MAP_TONES.halo, 2);                    /* halo: sınır her zeminde okunur */
  strokeRing(cv, ring, MAP_TONES.ink, 1);
  /* Eski/hatalı GNSS konumları lejant ve altbilgiye taşmasın. */
  drawReportMapInventoryPoints({
    canvas: cv, points, project: (lon, lat) => [X(lon), Y(lat)],
    frame,
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

