import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/plan-park-backfill.js', import.meta.url), 'utf8'), context);
const create = context.window.DG_PARK_BACKFILL_PLAN_APPLICATION.create;

function setup(overrides = {}) {
  const calls = [];
  const deps = {
    isAdmin: () => true,
    isOnline: () => true,
    fetchProjects: async () => ({ data: [{ id: 1, name: 'Göksu Parkı', park_id: null }, { id: 2, name: 'Bağlı proje', park_id: 9 }] }),
    fetchMeasurements: async id => ({ data: id === 1 ? [{ lat: '39.9', lon: '32.6' }, { lat: 39.7, lon: 32.8 }] : [] }),
    detectPark: async (lat, lon, name) => { calls.push(['detect', lat, lon, name]); return { cands: [{ name: '', area: 3000 }], yol: 'osm' }; },
    sleep: async ms => calls.push(['sleep', ms]),
    suggestParkName: name => `Öneri: ${name}`,
    projectName: (park, label) => `${park} - ${label}`,
    labelFromLegacy: () => 'etiket',
    onProgress: (i, n, name) => calls.push(['progress', i, n, name]),
    ...overrides
  };
  return { plan: create(deps), calls };
}

test('plans only unlinked projects using their measurement center and first park candidate', async () => {
  const { plan, calls } = setup();
  const result = await plan();
  assert.equal(result.status, 'planned');
  assert.equal(result.plan.length, 1);
  assert.equal(result.plan[0].durum, 'eşleşti');
  assert.equal(result.plan[0].lat, 39.8);
  assert.equal(result.plan[0].lon, 32.7);
  assert.equal(result.plan[0].parkName, 'Öneri: Göksu Parkı');
  assert.equal(result.plan[0].newName, 'Öneri: Göksu Parkı - etiket');
  assert.deepEqual(calls.filter(call => call[0] === 'sleep'), [['sleep', 2100]]);
});

test('authorization, connectivity, and missing targets stop before migration queries', async () => {
  const forbidden = setup({ isAdmin: () => false });
  assert.equal((await forbidden.plan()).status, 'forbidden');

  const offline = setup({ isOnline: () => false });
  assert.equal((await offline.plan()).status, 'offline');

  const empty = setup({ fetchProjects: async () => ({ data: [{ id: 3, park_id: 8 }] }) });
  assert.equal((await empty.plan()).status, 'no-targets');
});

test('projects without valid measurements remain in the plan; query errors are surfaced', async () => {
  const noMeasurements = setup({ fetchMeasurements: async () => ({ data: [{ lat: null, lon: 'bad' }] }) });
  const result = await noMeasurements.plan();
  assert.equal(result.plan[0].durum, 'ölçüm yok');
  assert.equal(noMeasurements.calls.some(call => call[0] === 'detect'), false);

  const error = { message: 'project query failed' };
  const failed = setup({ fetchProjects: async () => ({ error }) });
  const failure = await failed.plan();
  assert.equal(failure.status, 'projects-load-failed');
  assert.equal(failure.error, error);
});
