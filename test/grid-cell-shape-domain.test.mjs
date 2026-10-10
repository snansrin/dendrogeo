import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/domain/parks/grid-cell-shape.js', import.meta.url), 'utf8'), context);
const resolve = context.window.DG_GRID_CELL_SHAPE.resolve;

test('GeoJSON polygons and holes convert every [LON,LAT] point for Leaflet', () => {
  const shape = resolve({ geometry: { coordinates: [
    [[[31, 40], [32, 40], [32, 41], [31, 40]], [[31.2, 40.2], [31.3, 40.2], [31.2, 40.2]]],
    [[[33, 42], [34, 42], [33, 42]]]
  ] } });
  assert.deepEqual(JSON.parse(JSON.stringify(shape)), [
    [[[40, 31], [40, 32], [41, 32], [40, 31]], [[40.2, 31.2], [40.2, 31.3], [40.2, 31.2]]],
    [[[42, 33], [42, 34], [42, 33]]]
  ]);
});

test('legacy cells without geometry keep the existing four [LAT,LON] corners', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(resolve({ s0: 40, s1: 41, w0: 31, w1: 32 }))), [
    [40, 31], [40, 32], [41, 32], [41, 31]
  ]);
});
