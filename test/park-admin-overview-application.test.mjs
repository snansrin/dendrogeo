import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/build-park-admin-overview.js', import.meta.url), 'utf8'), context);
const build = context.window.DG_PARK_ADMIN_OVERVIEW.build;
const normalizeLoose = value => String(value || '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
const normalizeName = value => String(value || '').toLocaleLowerCase('tr-TR');
const parkRows = [
  { id: 1, name: 'Göksu Parkı' },
  { id: 2, name: 'Göksu Parkı ' },
  { id: 3, name: 'İsimsiz Park' },
  { id: 4, name: 'Sessiz Bahçe' }
];

const result = overrides => build({
  rows: parkRows,
  projects: [{ id: 8, park_id: 1 }, { id: 9, park_id: 1 }, { id: 10, park_id: 3 }],
  measurements: [{ park_id: 2 }, { park_id: 2 }, { park_id: null }],
  showEmpty: false, normalizeLoose, normalizeName, ...overrides
});

test('counts references and hides empty rows while preserving input order', () => {
  const overview = result({});
  assert.deepEqual(JSON.parse(JSON.stringify(overview.projByPark)), { 1: 2, 3: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(overview.measByPark)), { 2: 2 });
  assert.deepEqual(overview.shown.map(park => park.id), [1, 2, 3]);
  assert.deepEqual(overview.emptyRows.map(park => park.id), [4]);
});

test('show-empty option reveals empty rows without removing the empty count', () => {
  const overview = result({ showEmpty: true });
  assert.deepEqual(overview.shown.map(park => park.id), [1, 2, 3, 4]);
  assert.equal(overview.emptyRows.length, 1);
});

test('duplicate and unnamed groups use the existing normalized-name rules', () => {
  const overview = result({});
  assert.deepEqual(JSON.parse(JSON.stringify(overview.dupGroups.map(group => group.map(park => park.id)))), [[1, 2]]);
  assert.deepEqual(overview.unnamed.map(park => park.id), [3]);
});
