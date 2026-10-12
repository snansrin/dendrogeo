import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PngCanvas } from '../scripts/lib/png.mjs';
import {
  drawReportMapScaleAndNorth,
  selectReportMapScaleMeters
} from '../scripts/lib/report-map-scale-orientation.mjs';

function pixel(canvas, x, y) {
  return Array.from(canvas.px.slice((y * canvas.w + x) * 4, (y * canvas.w + x) * 4 + 3));
}

test('report map scale selects the first distance above 90 pixels', () => {
  assert.equal(selectReportMapScaleMeters(1), 100);
  assert.equal(selectReportMapScaleMeters(0.9), 200);
  assert.equal(selectReportMapScaleMeters(0.5), 200);
  assert.equal(selectReportMapScaleMeters(0), 1000);
});

test('report map scale bar keeps alternating segments and the north arrow pixels', () => {
  const background = [240, 240, 240];
  const ink = [24, 36, 32];
  const canvas = new PngCanvas(420, 700, background);

  drawReportMapScaleAndNorth({
    canvas, width: 420, padding: 26, top: 96, mapHeight: 540, scale: 1, ink
  });

  assert.deepEqual(pixel(canvas, 300, 600), ink);
  assert.deepEqual(pixel(canvas, 325, 600), [255, 255, 255]);
  assert.deepEqual(pixel(canvas, 350, 600), ink);
  assert.deepEqual(pixel(canvas, 375, 600), [255, 255, 255]);
  assert.deepEqual(pixel(canvas, 380, 140), ink);
  assert.deepEqual(pixel(canvas, 380, 126), ink);
  assert.deepEqual(pixel(canvas, 370, 162), ink);
  assert.deepEqual(pixel(canvas, 0, 140), background);
});
