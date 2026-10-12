import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PngCanvas } from '../scripts/lib/png.mjs';
import { disc, fillRing, strokeRing } from '../scripts/lib/report-map-primitives.mjs';

function pixel(canvas, x, y) {
  return Array.from(canvas.px.slice((y * canvas.w + x) * 4, (y * canvas.w + x) * 4 + 3));
}

test('report map ring fill colors the interior and leaves the exterior unchanged', () => {
  const background = [0, 0, 0];
  const fill = [20, 120, 70];
  const canvas = new PngCanvas(8, 8, background);
  fillRing(canvas, [[1, 1], [6, 1], [6, 6], [1, 6]], fill);

  assert.deepEqual(pixel(canvas, 3, 3), fill);
  assert.deepEqual(pixel(canvas, 0, 3), background);
});

test('report map ring stroke preserves thin and halo offsets', () => {
  const background = [0, 0, 0];
  const ink = [10, 20, 30];
  const canvas = new PngCanvas(8, 8, background);
  const ring = [[2, 2], [5, 2], [5, 5], [2, 5]];

  strokeRing(canvas, ring, ink);
  assert.deepEqual(pixel(canvas, 2, 2), ink);
  assert.deepEqual(pixel(canvas, 4, 4), background);

  strokeRing(canvas, ring, [80, 90, 100], 2);
  assert.deepEqual(pixel(canvas, 3, 2), [80, 90, 100]);
});

test('report map disc keeps its circular pixel mask', () => {
  const background = [0, 0, 0];
  const fill = [230, 240, 250];
  const canvas = new PngCanvas(9, 9, background);

  disc(canvas, 4, 4, 2, fill);

  assert.deepEqual(pixel(canvas, 4, 4), fill);
  assert.deepEqual(pixel(canvas, 6, 4), fill);
  assert.deepEqual(pixel(canvas, 6, 6), background);
});
