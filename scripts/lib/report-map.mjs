import { createReportMapCanvas } from './report-map-resolution.mjs';
import { fmtDateDot } from './report-formatting.mjs';
import { strokeRing, disc } from './report-map-primitives.mjs';
import { drawReportMapInventoryPoints } from './report-map-inventory-points.mjs';
import { createReportMapProjection } from './report-map-projection.mjs';
import { createReportMapClassPresentation } from './report-map-class-presentation.mjs';
import { drawReportMapSurfaceLayers } from './report-map-surface-layers.mjs';
import { drawReportMapHeading } from './report-map-heading.mjs';
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

export function mapCanvas({ outer, outers = null, surfaceFeatures = [], holes = [], wruns = [], classes = {}, parkName = '', sub = '', sub2 = '', maskHa = 0, points = [], pointStat = null, meta = null, pixelRatio = 1 }) {
  const PAD = 26, TOP = 96, MAPH = 540, FOOT = 70;
  const { width: W, scale: k, x: X, y: Y } = createReportMapProjection({
    outer, outers, padding: PAD, top: TOP, mapHeight: MAPH
  });
  const { classFor: pngClass, rows: legRows } = createReportMapClassPresentation({ classes, maskHa });
  const H = TOP + MAPH + 16 + legRows.length * 28 + 18 + FOOT;
  const {canvas:cv,view,ratio}=createReportMapCanvas({width:W,height:H,background:MAP_TONES.out,pixelRatio});
  const FR = [206, 210, 206];
  const physical = drawReportMapSurfaceLayers({
    canvas: cv, outer, outers, surfaceFeatures, holes, wruns,
    project: (lon, lat) => [X(lon)*ratio, Y(lat)*ratio], classFor: pngClass,
    contextTone: MAP_TONES.out, noDataTone: MAP_TONES.nodata,
    frameTone: FR, padding: PAD*ratio, top: TOP*ratio, mapHeight: MAPH*ratio, frameInset:12*ratio
  });
  const ring=physical.ring.map(point=>point.map(value=>value/ratio));
  const frame=Object.fromEntries(Object.entries(physical.frame).map(([key,value])=>[key,value/ratio]));
  strokeRing(view, ring, MAP_TONES.halo, 2);                    /* halo: sınır her zeminde okunur */
  strokeRing(view, ring, MAP_TONES.ink, 1);
  /* Eski/hatalı GNSS konumları lejant ve altbilgiye taşmasın. */
  drawReportMapInventoryPoints({
    canvas: view, points, project: (lon, lat) => [X(lon), Y(lat)],
    frame,
    disc, tones: MAP_TONES
  });
  const T = (x, y, t, c, sc) => view.text(x, y, t, c, sc);
  drawReportMapHeading({
    text: T, width: W, padding: PAD, parkName, sub, sub2, meta,
    ink: MAP_TONES.ink, muted: MAP_TONES.mut
  });
  drawReportMapLegend({
    canvas: view, rows: legRows, y: TOP + MAPH + 10, padding: PAD,
    classFor: pngClass, classes, maskHa, points, pointStat, tones: MAP_TONES, text: T
  });
  drawReportMapScaleAndNorth({
    canvas: view, width: W, padding: PAD, top: TOP, mapHeight: MAPH, scale: k, ink: MAP_TONES.ink
  });
  drawReportMapFooter({
    canvas: view, width: W, height: H, padding: PAD, footerHeight: FOOT,
    frameTone: FR, tones: MAP_TONES, dataset: DATASET_ASCII, meta
  });
  return cv;
}
export function renderMapPNG(opts) { return mapCanvas({...opts,pixelRatio:opts.pixelRatio??3}).encode(); }

