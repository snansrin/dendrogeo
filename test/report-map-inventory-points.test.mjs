import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawReportMapInventoryPoints } from '../scripts/lib/report-map-inventory-points.mjs';

test('inventory points stay inside the map frame and preserve halo then ink order', () => {
  const calls = [];
  const tones = { halo: 'white', ink: 'dark' };
  drawReportMapInventoryPoints({
    canvas: 'canvas',
    points: [{ lon: 4, lat: 5 }, { lon: -1, lat: 5 }, { lon: 9, lat: 5 }, { lon: 4, lat: 11 }],
    project: (lon, lat) => [lon, lat],
    frame: { left: 0, right: 8, top: 0, bottom: 10 },
    disc: (...args) => calls.push(args),
    tones
  });

  assert.deepEqual(calls, [
    ['canvas', 4, 5, 5, 'white'], ['canvas', 4, 5, 3, 'dark']
  ]);
});

test('points on the map-frame edge remain visible', () => {
  const calls = [];
  drawReportMapInventoryPoints({
    canvas: null, points: [{ lon: 0, lat: 10 }], project: (lon, lat) => [lon, lat],
    frame: { left: 0, right: 8, top: 0, bottom: 10 },
    disc: (...args) => calls.push(args), tones: { halo: 'h', ink: 'i' }
  });
  assert.deepEqual(calls.map(call => call.slice(1, 4)), [[0, 10, 5], [0, 10, 3]]);
});
