import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PngCanvas } from '../scripts/lib/png.mjs';
import { drawReportMapSurfaceLayers } from '../scripts/lib/report-map-surface-layers.mjs';

const px = (canvas, x, y) => Array.from(canvas.px.slice((y * canvas.w + x) * 4, (y * canvas.w + x) * 4 + 3));
const project = (lon, lat) => [lon, lat];

test('report map surface layers retain fill, cell, feature, clipping, and frame order', () => {
  const context = [238, 240, 238], noData = [212, 212, 208];
  const cell = [30, 120, 60], feature = [190, 40, 50], frameTone = [206, 210, 206];
  const canvas = new PngCanvas(40, 48, context);
  const outer = [[10, 10], [30, 10], [30, 28], [10, 28], [10, 10]];
  const hole = [[16, 15], [20, 15], [20, 19], [16, 19], [16, 15]];
  const { ring, frame } = drawReportMapSurfaceLayers({
    canvas, outer, holes: [hole], wruns: [{ lo0: 22, lo1: 26, la0: 14, la1: 18, key: 'green' }],
    surfaceFeatures: [{ geometry: { coordinates: [[[[12, 20], [15, 20], [15, 23], [12, 23], [12, 20]]]] }, properties: { class: 'building' } }],
    project, classFor: key => key === 'green' ? { color: '#1e783c' } : { color: '#be2832' },
    contextTone: context, noDataTone: noData, frameTone, padding: 14, top: 16, mapHeight: 12
  });

  assert.deepEqual(ring[0], [10, 10]);
  assert.deepEqual(frame, { left: 2, top: 4, right: 38, bottom: 40 });
  assert.deepEqual(px(canvas, 11, 12), noData);
  assert.deepEqual(px(canvas, 24, 16), cell);
  assert.deepEqual(px(canvas, 13, 21), feature);
  assert.deepEqual(px(canvas, 18, 17), context);
  assert.deepEqual(px(canvas, 4, 12), context);
  assert.deepEqual(px(canvas, 3, 10), frameTone);
});
