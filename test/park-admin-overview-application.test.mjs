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

test('search matches recorded creators, city and identity without mutating park records',()=>{
 const rows=[{id:1,name:'Göksu',city:'Ankara',osm_key:'way/123',creator:{full_name:'Nagihan Şirin'}},{id:2,name:'Diğer',city:'Bursa',created_by:'user-id'}];
 const before=JSON.stringify(rows);
 for(const query of ['Nagihan','Ankara','way/123'])assert.deepEqual(result({rows,query,showEmpty:true}).shown.map(park=>park.id),[1]);
 assert.equal(result({rows,query:'olmayan',showEmpty:true}).shown.length,0);
 assert.equal(JSON.stringify(rows),before);
});

test('all displayed sort choices use values, stable ties and missing dates safely',()=>{
 const rows=[{id:1,name:'B',created_at:'2026-01-01',creator:{full_name:'Z'},area_m2:30},{id:2,name:'A',created_at:'2026-10-01',creator:{full_name:'A'},area_m2:10},{id:3,name:'C'}];
 for(const [sort,expected] of [['name-asc',[2,1,3]],['name-desc',[3,1,2]],['created-desc',[2,1,3]],['created-asc',[3,1,2]],['area-desc',[1,2,3]],['measurements-desc',[2,1,3]],['projects-desc',[1,3,2]]])assert.deepEqual(result({rows,sort,showEmpty:true}).shown.map(park=>park.id),expected);
 assert.deepEqual(result({rows,sort:'creator-asc',showEmpty:true}).shown.map(park=>park.id),[3,2,1]);
});
