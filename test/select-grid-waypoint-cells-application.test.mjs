import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/select-grid-waypoint-cells.js', import.meta.url), 'utf8'), context);
const select = context.window.DG_GRID_WAYPOINT_SELECTION.select;

test('automatic mode chooses only unmeasured cells in the original order', () => {
  const cells = [{ id: 'a', n: 1 }, { id: 'b', n: 0 }, { id: 'c', n: 0 }];
  assert.deepEqual(Array.from(select(cells, 'auto', new Set(['a']))), [cells[1], cells[2]]);
});

test('manual mode chooses only explicitly selected cells, including measured cells', () => {
  const cells = [{ id: 'a', n: 1 }, { id: 'b', n: 0 }, { id: 'c', n: 2 }];
  assert.deepEqual(Array.from(select(cells, 'manual', new Set(['a', 'c', 'missing']))), [cells[0], cells[2]]);
});
