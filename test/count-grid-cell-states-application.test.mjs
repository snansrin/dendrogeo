import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/count-grid-cell-states.js', import.meta.url), 'utf8'), context);

test('grid cells with zero measurements are empty; all other counts are measured', () => {
  const cells = [{ n: 0 }, { n: 2 }, { n: 1 }, { n: 0 }];
  const result = context.window.DG_GRID_CELL_STATES.count(cells);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { measured: 2, empty: 2, total: 4 });
});

test('empty grids return zero counts without changing the source array', () => {
  const cells = [];
  const result = context.window.DG_GRID_CELL_STATES.count(cells);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { measured: 0, empty: 0, total: 0 });
  assert.deepEqual(cells, []);
});
