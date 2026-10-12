import { hex2rgb } from './png.mjs';
import { disc } from './report-map-primitives.mjs';

export function drawReportMapLegend({
  canvas, rows, y, padding, classFor, classes = {}, maskHa = 0,
  points = [], pointStat = null, tones, text
}) {
  let rowY = y;
  for (const key of rows) {
    if (key === 'border') {
      canvas.line(padding + 2, rowY + 11, padding + 20, rowY + 11, tones.ink);
      text(padding + 32, rowY + 4, 'PARK SINIRI (OSM POLIGONU)', tones.ink, 2);
    } else if (key === 'point') {
      disc(canvas, padding + 11, rowY + 11, 5, tones.halo);
      disc(canvas, padding + 11, rowY + 11, 3, tones.ink);
      text(padding + 32, rowY + 4, pointStat && pointStat.outside > 0
        ? `ENVANTER NOKTASI (ICINDE ${pointStat.inside} / DISINDA ${pointStat.outside})`
        : `ENVANTER NOKTASI (n=${points.length}, POLIGON ICINDE)`, tones.ink, 2);
    } else if (key === 'outside') {
      canvas.rect(padding + 1, rowY + 1, padding + 21, rowY + 21, tones.out);
      canvas.rect(padding + 1, rowY + 1, padding + 21, rowY + 2, [190, 194, 190]);
      text(padding + 32, rowY + 4, 'PARK DISI (BAGLAM)', tones.mut, 2);
    } else if (key === 'masked') {
      canvas.rect(padding + 1, rowY + 1, padding + 21, rowY + 21, tones.nodata);
      text(padding + 32, rowY + 4, `MASKELI (BULUT/GOLGE) ${maskHa.toFixed(2)} ha`, tones.mut, 2);
    } else {
      const c = classFor(key);
      const areaM2 = key === 'water'
        ? Number(classes.water?.areaM2 || 0) + Number(classes.pool?.areaM2 || 0)
        : Number(c?.areaM2 || 0);
      const label = key === 'water' ? (classes.water?.label || 'Su') : c.label;
      canvas.rect(padding + 1, rowY + 1, padding + 21, rowY + 21, hex2rgb(c.color));
      text(padding + 32, rowY + 4, `${label} ${(areaM2 / 10000).toFixed(2)} ha`, tones.ink, 2);
    }
    rowY += 28;
  }
}
