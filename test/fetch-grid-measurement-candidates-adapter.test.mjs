import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/adapters/parks/fetch-grid-measurement-candidates.js', import.meta.url), 'utf8'), context);

test('grid measurement query filters approved rows by bbox and returns the exact count', async () => {
  const calls = [];
  const response = { data: [{ lat: 39.2, lon: 32.7 }], count: 1, error: null };
  const query = {
    select(...args) { calls.push(['select', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    gte(...args) { calls.push(['gte', ...args]); return this; },
    lte(...args) { calls.push(['lte', ...args]); return this; },
    limit(value) { calls.push(['limit', value]); return Promise.resolve(response); }
  };
  const client = { from(table) { calls.push(['from', table]); return query; } };

  assert.equal(await context.window.DG_GRID_MEASUREMENT_STORE.fetchCandidates(client, {
    minLat: 39, maxLat: 40, minLon: 32, maxLon: 33
  }), response);
  assert.equal(calls[0][1], 'measurements');
  assert.equal(calls[1][1], 'lat,lon');
  assert.equal(calls[2][1], 'status');
  assert.equal(calls[2][2], 'Onaylı');
  assert.deepEqual(calls.filter(call => call[0] === 'gte' || call[0] === 'lte').map(call => [call[0], call[1], call[2]]), [
    ['gte', 'lat', 39], ['lte', 'lat', 40], ['gte', 'lon', 32], ['lte', 'lon', 33]
  ]);
  assert.equal(calls.at(-1)[1], 5000);
});
