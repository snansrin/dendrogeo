import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/adapters/parks/fetch-latest-grid-waypoint.js', import.meta.url), 'utf8'), context);

test('latest waypoint lookup scopes to the project, sorts descending, and limits to one row', async () => {
  const calls = [];
  const response = { data: [{ wp_id: 28 }], error: null };
  const query = {
    select(value) { calls.push(['select', value]); return this; },
    eq(field, value) { calls.push(['eq', field, value]); return this; },
    order(field, options) { calls.push(['order', field, options]); return this; },
    limit(value) { calls.push(['limit', value]); return Promise.resolve(response); }
  };
  const client = {
    from(table) { calls.push(['from', table]); return query; }
  };

  assert.equal(await context.window.DG_GRID_WAYPOINT_STORE.fetchLatest(client, 42), response);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['from', 'waypoints'],
    ['select', 'wp_id'],
    ['eq', 'project_id', 42],
    ['order', 'wp_id', { ascending: false }],
    ['limit', 1]
  ]);
});

test('latest waypoint lookup preserves database errors for the existing caller behavior', async () => {
  const response = { data: null, error: { message: 'offline' } };
  const client = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => response }) }) }) }) };
  assert.equal(await context.window.DG_GRID_WAYPOINT_STORE.fetchLatest(client, 7), response);
});
