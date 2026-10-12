import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PngCanvas } from '../scripts/lib/png.mjs';
import { restoreOutsideRings } from '../scripts/lib/report-map-clipping.mjs';

function pixel(canvas, x, y) {
  return Array.from(canvas.px.slice((y * canvas.w + x) * 4, (y * canvas.w + x) * 4 + 3));
}

test('map clipping restores outside, gaps, and holes while preserving polygon interiors', () => {
  const context = [238, 240, 238];
  const classColor = [30, 120, 60];
  const canvas = new PngCanvas(18, 8, classColor);
  const outer = [[2, 1], [8, 1], [8, 6], [2, 6], [2, 1]];
  const hole = [[4, 2], [6, 2], [6, 5], [4, 5], [4, 2]];
  const island = [[12, 1], [15, 1], [15, 4], [12, 4], [12, 1]];

  restoreOutsideRings(canvas, [outer, hole, island], 6, context);

  assert.deepEqual(pixel(canvas, 0, 3), context);
  assert.deepEqual(pixel(canvas, 10, 3), context);
  assert.deepEqual(pixel(canvas, 17, 3), context);
  assert.deepEqual(pixel(canvas, 5, 3), context);
  assert.deepEqual(pixel(canvas, 3, 3), classColor);
  assert.deepEqual(pixel(canvas, 7, 3), classColor);
  assert.deepEqual(pixel(canvas, 13, 3), classColor);
  assert.deepEqual(pixel(canvas, 3, 7), classColor);
});
