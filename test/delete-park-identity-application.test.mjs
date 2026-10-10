import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/delete-park-identity.js', import.meta.url), 'utf8'), context);
const create = context.window.DG_PARK_ADMIN_DELETE_APPLICATION.create;
const park = { id: 7, name: 'Göksu Parkı' };

function setup(overrides = {}) {
  const events = [];
  const deps = {
    isAdmin: () => true,
    getPark: id => id === park.id ? park : null,
    confirmDelete: row => { events.push(`confirm:${row.id}`); return true; },
    deletePark: async id => { events.push(`delete:${id}`); return { error: null }; },
    clearSession: () => events.push('clear-session'),
    ...overrides
  };
  return { remove: create(deps), events };
}

test('delete requires confirmation, then clears identity session only after success', async () => {
  const { remove, events } = setup();
  const result = await remove(7);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: 'deleted', id: 7 });
  assert.deepEqual(events, ['confirm:7', 'delete:7', 'clear-session']);
});

test('authorization, missing park, and cancellation stop before writes', async () => {
  const forbidden = setup({ isAdmin: () => false });
  assert.equal((await forbidden.remove(7)).status, 'forbidden');
  assert.deepEqual(forbidden.events, []);

  const missing = setup({ getPark: () => null });
  assert.equal((await missing.remove(7)).status, 'park-missing');
  assert.deepEqual(missing.events, []);

  const cancelled = setup({ confirmDelete: () => false });
  assert.equal((await cancelled.remove(7)).status, 'cancelled');
  assert.deepEqual(cancelled.events, []);
});

test('database failure keeps the identity session intact', async () => {
  const error = { message: 'delete unavailable' };
  const { remove, events } = setup({ deletePark: async id => { events.push(`delete:${id}`); return { error }; } });
  const result = await remove(7);
  assert.equal(result.status, 'write-failed');
  assert.equal(result.error, error);
  assert.deepEqual(events, ['confirm:7', 'delete:7']);
});
