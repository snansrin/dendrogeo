import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/apply-park-backfill.js', import.meta.url), 'utf8'), context);
const create = context.window.DG_PARK_BACKFILL_APPLY_APPLICATION.create;

function setup(overrides = {}) {
  const events = [];
  const deps = {
    isAdmin: () => true,
    confirmApply: count => { events.push(`confirm:${count}`); return true; },
    onProgress: (i, count, label) => events.push(`progress:${i}/${count}:${label}`),
    registerPark: async (candidate, options) => { events.push(`register:${candidate.name}:${options.lat}`); return { id: 8, name: candidate.name }; },
    linkProject: async project => { events.push(`link:${project.id}`); return true; },
    ...overrides
  };
  return { apply: create(deps), events };
}

const plan = [
  { durum: 'eşleşti', project: { id: 1, name: 'Göksu Parkı' }, cand: { name: '' }, parkName: 'Göksu Parkı', lat: 39.9, lon: 32.6 },
  { durum: 'ölçüm yok', project: { id: 2 }, cand: null }
];

test('applies only matched rows in order and counts failed links without stopping', async () => {
  const { apply, events } = setup({ linkProject: async project => { events.push(`link:${project.id}`); return project.id !== 1; } });
  const result = await apply(plan);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: 'applied', successes: 0, failures: 1 });
  assert.deepEqual(events, ['confirm:1', 'progress:0/1:Göksu Parkı → bağlanıyor', 'register:Göksu Parkı:39.9', 'link:1']);
});

test('authorization, empty plans, and cancellation do not write', async () => {
  const forbidden = setup({ isAdmin: () => false });
  assert.equal((await forbidden.apply(plan)).status, 'forbidden');
  assert.deepEqual(forbidden.events, []);

  const empty = setup();
  assert.equal((await empty.apply([{ durum: 'ölçüm yok' }])).status, 'empty-plan');
  assert.deepEqual(empty.events, []);

  const cancelled = setup({ confirmApply: () => false });
  assert.equal((await cancelled.apply(plan)).status, 'cancelled');
  assert.deepEqual(cancelled.events, []);
});
