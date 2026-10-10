import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/prepare-grid-waypoint-batch.js', import.meta.url), 'utf8'), context);
const prepare = context.window.DG_GRID_WAYPOINT_BATCH.prepare;

test('batch starts after the latest project waypoint and delegates row construction', () => {
  const cells = [{ id: 'a' }, { id: 'b' }];
  const rows = [{ wp_id: 26 }];
  const calls = [];
  const result = prepare(cells, rows, 'owner', 9, (...args) => {
    calls.push(args);
    return [{ wp_id: 27 }, { wp_id: 28 }];
  });

  assert.equal(result.firstWpId, 27);
  assert.deepEqual(calls, [[cells, 27, 'owner', 9]]);
  assert.deepEqual(Array.from(result.rows, row => row.wp_id), [27, 28]);
});

test('empty latest query starts IDs at one and still builds an empty batch', () => {
  let start;
  const result = prepare([], null, 'owner', 9, (cells, firstWpId) => {
    start = firstWpId;
    return [];
  });

  assert.equal(start, 1);
  assert.equal(result.firstWpId, 1);
  assert.deepEqual(Array.from(result.rows), []);
});
