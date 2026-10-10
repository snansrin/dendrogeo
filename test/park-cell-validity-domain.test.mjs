import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/domain/parks/cell-validity.js', import.meta.url), 'utf8'), context);
const isCellValid = context.window.DG_PARK_CELL_VALIDITY.isCellValid;

function dependencies(overrides = {}) {
  const calls = { inside: 0, green: [], intersections: [], lineIntersections: [] };
  return {
    calls,
    value: {
      cellInsidePark() { calls.inside++; return true; },
      greenOnly: false,
      landcover: null,
      ringBBox: (ring, refLat) => ({ ring, refLat }),
      geometryIntersectsRect: (geometry, rect, refLat, buffer) => { calls.intersections.push({ geometry, buffer }); return false; },
      geometryLineIntersectsRect: (geometry, rect, refLat, buffer) => { calls.lineIntersections.push({ geometry, buffer }); return false; },
      waterRings: [], waterLines: [], imperviousRings: [], imperviousLines: [], gridBlockLines: [],
      waterClearanceM: 4,
      imperviousClearanceM: 3,
      ...overrides
    }
  };
}

test('park and green gates run before geometry checks using the cell center', () => {
  const outside = dependencies({ cellInsidePark: () => false });
  assert.equal(isCellValid(39, 39.002, 32, 32.002, outside.value), false);
  assert.equal(outside.calls.inside, 0);

  const green = dependencies({ greenOnly: true, landcover: {
    hasGreen: () => true,
    isGreen: (lat, lon) => { greenPoint = [lat, lon]; return false; }
  } });
  let greenPoint;
  assert.equal(isCellValid(39, 39.002, 32, 32.004, green.value), false);
  assert.ok(Math.abs(greenPoint[0] - 39.001) < 1e-12);
  assert.ok(Math.abs(greenPoint[1] - 32.002) < 1e-12);
  assert.equal(green.calls.intersections.length, 0);
});

test('water and impervious geometries use their existing clearance values', () => {
  const state = dependencies({
    waterRings: ['water-ring'],
    waterLines: ['water-line'],
    imperviousRings: ['hard-ring']
  });
  assert.equal(isCellValid(39, 39.002, 32, 32.002, state.value), true);
  assert.deepEqual(state.calls.intersections.map(call => call.buffer), [4, 3]);
  assert.deepEqual(state.calls.lineIntersections.map(call => call.buffer), [4]);

  const blocked = dependencies({
    geometryLineIntersectsRect: (geometry, rect, lat, buffer) => geometry === 'water-line'
  });
  blocked.value.waterLines = ['water-line'];
  assert.equal(isCellValid(39, 39.002, 32, 32.002, blocked.value), false);
});

test('line features retain nonnegative widths and default missing widths to impervious clearance', () => {
  const state = dependencies({
    imperviousLines: [{ pts: [[1, 2], [2, 3]], w: -2 }, { pts: [[1, 2], [2, 3]], w: NaN }, { pts: [[1, 2]], w: 9 }],
    gridBlockLines: [{ pts: [[1, 2], [2, 3]], w: 1.5 }]
  });
  assert.equal(isCellValid(39, 39.002, 32, 32.002, state.value), true);
  assert.deepEqual(state.calls.lineIntersections.map(call => call.buffer), [0, 3, 1.5]);
});
