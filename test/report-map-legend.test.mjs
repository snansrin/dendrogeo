import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PngCanvas } from '../scripts/lib/png.mjs';
import { drawReportMapLegend } from '../scripts/lib/report-map-legend.mjs';

function pixel(canvas, x, y) {
  return Array.from(canvas.px.slice((y * canvas.w + x) * 4, (y * canvas.w + x) * 4 + 3));
}

test('report map legend preserves row symbols, colors, and labels', () => {
  const background = [240, 240, 240];
  const tones = {
    out: [238, 240, 238], nodata: [212, 212, 208],
    ink: [24, 36, 32], mut: [104, 118, 110], halo: [255, 255, 255]
  };
  const canvas = new PngCanvas(180, 220, background);
  const classes = {
    water: { label: 'Su', areaM2: 10000 },
    pool: { areaM2: 20000 }
  };
  const classRows = {
    forest: { label: 'Orman', color: '#147846', areaM2: 12345 },
    water: { label: 'Su', color: '#2468AC', areaM2: 10000 }
  };
  const labels = [];
  drawReportMapLegend({
    canvas, rows: ['border', 'point', 'outside', 'masked', 'forest', 'water'],
    y: 10, padding: 5, classFor: key => classRows[key], classes, maskHa: 12.345,
    points: [{}, {}], pointStat: { inside: 1, outside: 1 }, tones,
    text: (x, y, value, color, size) => labels.push({ x, y, value, color, size })
  });

  assert.deepEqual(pixel(canvas, 10, 21), tones.ink);
  assert.deepEqual(pixel(canvas, 16, 49), tones.ink);
  assert.deepEqual(pixel(canvas, 20, 49), tones.halo);
  assert.deepEqual(pixel(canvas, 8, 70), tones.out);
  assert.deepEqual(pixel(canvas, 8, 98), tones.nodata);
  assert.deepEqual(pixel(canvas, 8, 126), [20, 120, 70]);
  assert.deepEqual(pixel(canvas, 8, 154), [36, 104, 172]);
  assert.deepEqual(labels.map(label => label.value), [
    'PARK SINIRI (OSM POLIGONU)',
    'ENVANTER NOKTASI (ICINDE 1 / DISINDA 1)',
    'PARK DISI (BAGLAM)',
    'MASKELI (BULUT/GOLGE) 12.35 ha',
    'Orman 1.23 ha',
    'Su 3.00 ha'
  ]);
  assert.ok(labels.every(label => label.x === 37 && label.size === 2));
});

test('report map point legend falls back to the current inventory count', () => {
  const labels = [];
  drawReportMapLegend({
    canvas: new PngCanvas(120, 60), rows: ['point'], y: 0, padding: 0,
    classFor: () => null, points: [{}, {}, {}],
    tones: { ink: [24, 36, 32], halo: [255, 255, 255], mut: [104, 118, 110], out: [238, 240, 238], nodata: [212, 212, 208] },
    text: (_x, _y, value) => labels.push(value)
  });
  assert.deepEqual(labels, ['ENVANTER NOKTASI (n=3, POLIGON ICINDE)']);
});
