import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/count-grid-cell-measurements.js', import.meta.url), 'utf8'), context);
const count = context.window.DG_GRID_CELL_MEASUREMENTS.count;

test('approved measurements count only in the matching spatial cell and geometry', () => {
  const cells = [
    { baseId: '0_0', geometry: { id: 'outside' }, n: 0 },
    { baseId: '0_0', geometry: { id: 'inside' }, n: 0 },
    { baseId: '1_0', geometry: { id: 'other-row' }, n: 0 }
  ];
  const result = count(cells, [
    { lat: 5, lon: 5 },
    { lat: 5, lon: 6 },
    { lat: 15, lon: 5 },
    { lat: -15, lon: 5 }
  ], {
    size: 10,
    epsg: 32636,
    x0: 0,
    y0: 0,
    project: (lat, lon, epsg) => ({ x: lon, y: lat, epsg }),
    featureGeometry: feature => feature.geometry,
    pointDistance: (point, geometry) => geometry.id === 'outside' ? -1 : 0
  });

  assert.equal(result, cells);
  assert.deepEqual(cells.map(cell => cell.n), [0, 2, 1]);
});

test('missing measurement rows leave grid counts unchanged', () => {
  const cells = [{ baseId: '0_0', geometry: {}, n: 4 }];
  count(cells, null, {
    size: 10, epsg: 32636, x0: 0, y0: 0,
    project() { throw new Error('no measurements expected'); },
    featureGeometry: value => value.geometry,
    pointDistance: () => 0
  });
  assert.equal(cells[0].n, 4);
});
