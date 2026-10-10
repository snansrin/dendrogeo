import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/merge-park-identities.js', import.meta.url), 'utf8'), context);
const create = context.window.DG_PARK_ADMIN_MERGE_APPLICATION.create;
const parks = [{ id: 1, name: 'Eski kimlik' }, { id: 2, name: 'Göksu Parkı' }];

function setup(overrides = {}) {
  const events = [];
  const deps = {
    isAdmin: () => true,
    getParks: () => parks,
    confirmMerge: (source, destination) => { events.push(`confirm:${source.id}:${destination.id}`); return true; },
    moveProjects: async (source, destination) => { events.push(`projects:${source}:${destination}`); return { error: null }; },
    moveMeasurements: async (source, destination) => { events.push(`measurements:${source}:${destination}`); return { error: null }; },
    resyncProjectNames: async id => { events.push(`resync:${id}`); },
    deletePark: async id => { events.push(`delete:${id}`); return { error: null }; },
    clearSession: () => events.push('clear-session'),
    ...overrides
  };
  return { merge: create(deps), events };
}

test('merge moves project and measurement references before resync and source deletion', async () => {
  const { merge, events } = setup();
  const result = await merge('1', '2');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: 'merged', sourceId: 1, destinationId: 2, measurementError: null });
  assert.deepEqual(events, ['confirm:1:2', 'projects:1:2', 'measurements:1:2', 'resync:2', 'delete:1', 'clear-session']);
});

test('authorization, invalid ids, missing identities, and cancellation do not write', async () => {
  const forbidden = setup({ isAdmin: () => false });
  assert.equal((await forbidden.merge(1, 2)).status, 'forbidden');
  assert.deepEqual(forbidden.events, []);

  const invalid = setup();
  assert.equal((await invalid.merge(1, 1)).status, 'invalid');
  assert.equal((await invalid.merge(1, 0)).status, 'invalid');
  assert.deepEqual(invalid.events, []);

  const missing = setup({ getParks: () => parks.slice(0, 1) });
  assert.equal((await missing.merge(1, 2)).status, 'park-missing');
  assert.deepEqual(missing.events, []);

  const cancelled = setup({ confirmMerge: () => false });
  assert.equal((await cancelled.merge(1, 2)).status, 'cancelled');
  assert.deepEqual(cancelled.events, []);
});

test('project move failure stops before moving measurements or deleting source', async () => {
  const error = { message: 'projects unavailable' };
  const { merge, events } = setup({ moveProjects: async () => ({ error }) });
  const result = await merge(1, 2);
  assert.equal(result.status, 'projects-failed');
  assert.equal(result.error, error);
  assert.deepEqual(events, ['confirm:1:2', 'measurements:1:2'].slice(0, 1));
});

test('measurement move failure is reported but preserves the existing delete sequence', async () => {
  const error = { message: 'measurements unavailable' };
  const { merge, events } = setup({ moveMeasurements: async (source, destination) => { events.push(`measurements:${source}:${destination}`); return { error }; } });
  const result = await merge(1, 2);
  assert.equal(result.status, 'merged');
  assert.equal(result.measurementError, error);
  assert.deepEqual(events, ['confirm:1:2', 'projects:1:2', 'measurements:1:2', 'resync:2', 'delete:1', 'clear-session']);
});

test('source delete failure keeps the session and reports the write error', async () => {
  const error = { message: 'delete unavailable' };
  const { merge, events } = setup({ deletePark: async () => ({ error }) });
  const result = await merge(1, 2);
  assert.equal(result.status, 'delete-failed');
  assert.equal(result.error, error);
  assert.ok(!events.includes('clear-session'));
});
