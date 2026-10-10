import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/create-backfill-park.js', import.meta.url), 'utf8'), context);
const create = context.window.DG_PARK_BACKFILL_MANUAL_APPLICATION.create;
const row = { project: { id: 1, name: '  Göksu  ' }, lat: 39.9, lon: 32.6 };

function setup(overrides = {}) {
  const events = [];
  const operation = create({
    isAdmin: () => true,
    getPlanRow: id => id === 1 ? row : null,
    confirmCreate: details => { events.push(`confirm:${details.name}:${details.lat}`); return true; },
    createPark: async name => { events.push(`create:${name}`); return { id: 8, name }; },
    linkProject: async project => { events.push(`link:${project.id}`); return true; },
    ...overrides
  });
  return { operation, events };
}

test('manual backfill creation validates, confirms, registers, and links in order', async () => {
  const { operation, events } = setup();
  const result = await operation(1);
  assert.equal(result.status, 'created');
  assert.equal(result.park.name, 'Göksu');
  assert.deepEqual(events, ['confirm:Göksu:39.9', 'create:Göksu', 'link:1']);
});

test('forbidden, missing-center, cancellation, and create failure stop safely', async () => {
  const forbidden = setup({ isAdmin: () => false });
  assert.equal((await forbidden.operation(1)).status, 'forbidden');
  assert.deepEqual(forbidden.events, []);

  const missing = setup({ getPlanRow: () => null });
  assert.equal((await missing.operation(1)).status, 'measurement-center-missing');
  assert.deepEqual(missing.events, []);

  const cancelled = setup({ confirmCreate: () => false });
  assert.equal((await cancelled.operation(1)).status, 'cancelled');
  assert.deepEqual(cancelled.events, []);

  const failed = setup({ createPark: async () => null });
  assert.equal((await failed.operation(1)).status, 'park-create-failed');
  assert.deepEqual(failed.events, ['confirm:Göksu:39.9']);
});

test('failed project linking is reported and does not claim completion', async () => {
  const { operation, events } = setup({ linkProject: async project => {
    events.push(`link:${project.id}`);
    return false;
  } });
  const result = await operation(1);
  assert.equal(result.status, 'project-link-failed');
  assert.equal(result.park.id, 8);
  assert.deepEqual(events, ['confirm:Göksu:39.9', 'create:Göksu', 'link:1']);
});
