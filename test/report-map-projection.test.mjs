import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReportMapProjection } from '../scripts/lib/report-map-projection.mjs';

test('report map projection keeps the fixed canvas size and centered local coordinates', () => {
  const ring = [[0, 0], [0, 0.01], [0.01, 0.01], [0.01, 0], [0, 0]];
  const projection = createReportMapProjection({
    outer: ring,
    padding: 26,
    top: 96,
    mapHeight: 540
  });

  assert.equal(projection.width, 543);
  assert.equal(projection.scale, 0.4410707886000624);
  assert.equal(projection.x(0.005), 271.5);
  assert.equal(projection.y(0.005), 340);
  assert.equal(projection.x(0), 26);
  assert.equal(projection.y(0.01), 96.22017514074551);
});

test('report map projection includes every outer ring in the bounds', () => {
  const first = [[0, 0], [0, 0.005], [0.005, 0.005], [0.005, 0], [0, 0]];
  const second = [[0.005, 0.005], [0.005, 0.015], [0.015, 0.015], [0.015, 0.005], [0.005, 0.005]];
  const projection = createReportMapProjection({
    outer: first,
    outers: [first, second],
    padding: 26,
    top: 96,
    mapHeight: 540
  });

  assert.equal(projection.width, 543);
  assert.equal(projection.x(0.0075), 271.5);
  assert.equal(projection.y(0.0075), 340);
});
