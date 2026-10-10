import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/rename-park-identity.js', import.meta.url), 'utf8'), context);
const create = context.window.DG_PARK_ADMIN_RENAME_APPLICATION.create;
const parks = [{ id: 7, name: 'Göksu Parkı' }];

function setup(overrides = {}) {
  const events = [];
  const deps = {
    isAdmin: () => true,
    getParks: () => parks,
    promptName: park => { events.push(`prompt:${park.id}`); return 'Yeni Park Adı'; },
    normalizeName: name => name.toLocaleLowerCase('tr-TR'),
    updatePark: async (id, patch) => { events.push(`update:${id}:${patch.name}:${patch.name_norm}`); return { error: null }; },
    resyncProjectNames: async (id, name) => events.push(`resync:${id}:${name}`),
    ...overrides
  };
  return { rename: create(deps), events };
}

test('rename writes the canonical name then synchronizes project names', async () => {
  const { rename, events } = setup();
  const result = await rename(7);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: 'renamed', id: 7, name: 'Yeni Park Adı' });
  assert.deepEqual(events, ['prompt:7', 'update:7:Yeni Park Adı:yeni park adı', 'resync:7:Yeni Park Adı']);
});

test('authorization and missing park stop before prompting or writes', async () => {
  const forbidden = setup({ isAdmin: () => false });
  assert.equal((await forbidden.rename(7)).status, 'forbidden');
  assert.deepEqual(forbidden.events, []);

  const missing = setup({ getParks: () => [] });
  assert.equal((await missing.rename(7)).status, 'park-missing');
  assert.deepEqual(missing.events, []);
});

test('prompt cancellation and blank names preserve the current identity', async () => {
  const cancelled = setup({ promptName: () => null });
  assert.equal((await cancelled.rename(7)).status, 'cancelled');
  assert.deepEqual(cancelled.events, []);

  const blank = setup({ promptName: () => '   ' });
  assert.equal((await blank.rename(7)).status, 'empty-name');
  assert.deepEqual(blank.events, []);
});

test('park update failure stops before project name synchronization', async () => {
  const error = { message: 'park update unavailable' };
  const { rename, events } = setup({ updatePark: async () => { events.push('update'); return { error }; } });
  const result = await rename(7);
  assert.equal(result.status, 'write-failed');
  assert.equal(result.error, error);
  assert.deepEqual(events, ['prompt:7', 'update']);
});
