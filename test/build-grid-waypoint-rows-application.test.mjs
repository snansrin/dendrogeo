import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/build-grid-waypoint-rows.js', import.meta.url), 'utf8'), context);
const build = context.window.DG_GRID_WAYPOINT_ROWS.build;

test('waypoint rows preserve safe interior coordinates and advance IDs in cell order', () => {
  const rows = build([
    { id: 'a', lat: 39.12345678, lon: 32.87654321, s0: 39, s1: 40, w0: 32, w1: 33 },
    { id: 'b', s0: 39.2, s1: 39.4, w0: 32.2, w1: 32.6 }
  ], 17, 'owner-1', 42);

  assert.deepEqual(Array.from(rows, row => ({
    owner: row.owner,
    project_id: row.project_id,
    wp_id: row.wp_id,
    lat: row.lat,
    lon: row.lon,
    visited: row.visited
  })), [
    { owner: 'owner-1', project_id: 42, wp_id: 17, lat: 39.123457, lon: 32.876543, visited: false },
    { owner: 'owner-1', project_id: 42, wp_id: 18, lat: 39.3, lon: 32.4, visited: false }
  ]);
});

test('empty selection produces no rows and does not mutate the input cells', () => {
  const cells = [{ id: 'c', s0: 1, s1: 3, w0: 2, w1: 4 }];
  const rows = build([], 1, 'owner', 9);
  assert.equal(rows.length, 0);
  build(cells, 1, 'owner', 9);
  assert.equal(cells[0].lat, undefined);
});
