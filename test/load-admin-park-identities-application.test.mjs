import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/load-admin-park-identities.js', import.meta.url), 'utf8'), context);
const create = context.window.DG_PARK_ADMIN_LOAD_APPLICATION.create;

test('admin load returns park rows with project and measurement context', async () => {
  const calls = [];
  const load = create({
    isAdmin: () => true,
    showLoading: () => calls.push('loading'),
    fetchParks: async () => { calls.push('parks'); return { data: [{ id: 3 }] }; },
    fetchProjects: async () => { calls.push('projects'); return { data: [{ id: 8, park_id: 3 }] }; },
    fetchMeasurements: async () => { calls.push('measurements'); return { data: [{ park_id: 3 }] }; }
  });
  const result = await load();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    status: 'loaded', parks: [{ id: 3 }], projects: [{ id: 8, park_id: 3 }], measurements: [{ park_id: 3 }]
  });
  assert.equal(calls[0], 'loading');
  assert.deepEqual(calls.slice(1).sort(), ['measurements', 'parks', 'projects']);
});

test('forbidden load makes no data requests', async () => {
  let requested = false;
  const load = create({
    isAdmin: () => false,
    showLoading: () => { requested = true; },
    fetchParks: async () => { requested = true; },
    fetchProjects: async () => { requested = true; },
    fetchMeasurements: async () => { requested = true; }
  });
  assert.equal((await load()).status, 'forbidden');
  assert.equal(requested, false);
});

test('park query error is returned while empty secondary data defaults to arrays', async () => {
  const error = { message: 'parks unavailable' };
  const failed = create({ isAdmin: () => true, showLoading: () => {}, fetchParks: async () => ({ error }), fetchProjects: async () => ({}), fetchMeasurements: async () => ({}) });
  const failure = await failed();
  assert.equal(failure.status, 'park-load-failed');
  assert.equal(failure.error, error);

  const loaded = create({ isAdmin: () => true, showLoading: () => {}, fetchParks: async () => ({}), fetchProjects: async () => ({}), fetchMeasurements: async () => ({}) });
  assert.deepEqual(JSON.parse(JSON.stringify(await loaded())), { status: 'loaded', parks: [], projects: [], measurements: [] });
});
