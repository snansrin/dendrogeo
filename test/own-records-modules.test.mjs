import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = [
  'src/domain/users/record-status-meta.js',
  'src/domain/users/group-own-records.js',
  'src/ui/record-item.js',
  'src/ui/record-project.js',
  'src/adapters/users/own-records-store.js',
];
function runtime() {
  const context = { window: {} };
  vm.createContext(context);
  for (const path of modules) vm.runInContext(readFileSync(join(ROOT, path), 'utf8'), context);
  return context.window;
}

test('own-record modules preserve status labels and classes', () => {
  const api = runtime();
  assert.deepEqual({ ...api.DG_RECORD_STATUS_META.resolve('Beklemede') }, { label: 'Onay Bekliyor', cls: 'admin' });
  assert.deepEqual({ ...api.DG_RECORD_STATUS_META.resolve('Onaylı') }, { label: 'Onaylı', cls: 'on' });
  assert.deepEqual({ ...api.DG_RECORD_STATUS_META.resolve('Red') }, { label: 'Red', cls: 'off' });
});
test('own records group in Turkish project order and then point/measurement order', () => {
  const api = runtime();
  const rows = [
    { id: 1, point_id: 3, measurement_no: 1, projects: { name: 'İzmir' } },
    { id: 2, point_id: 2, measurement_no: 2, projects: { name: 'Ankara' } },
    { id: 3, point_id: 2, measurement_no: 1, projects: { name: 'Ankara' } },
  ];
  const grouped = api.DG_GROUP_OWN_RECORDS.group(rows);
  const normalized = JSON.parse(JSON.stringify(Array.from(grouped, ([name, records]) => [name, records.map((row) => row.id)])));
  assert.deepEqual(normalized, [
    ['Ankara', [3, 2]], ['İzmir', [1]],
  ]);
});

test('record item escapes content and preserves measurement values and actions', () => {
  const api = runtime();
  const html = api.DG_RECORD_ITEM_UI.render({
    id: 7, point_id: '<P>', species: '<script>', grp: 'Yapraklı', girth_cm: 20, dbh_cm: 6.4,
    height_m: 4, carbon_kg: 2.5, status: 'Onaylı', photo_url: '/photo.jpg',
  }, {
    escape: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    thumbnail: (url) => `<img src="${url}">`,
    statusMeta: api.DG_RECORD_STATUS_META.resolve,
  });
  assert.match(html, /P&lt;P&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /20\.0 cm/);
  assert.match(html, /6\.4 cm/);
  assert.match(html, /data-record-action="edit" data-record-id="7"/);
  assert.match(html, /data-record-action="delete" data-record-id="7"/);
  assert.doesNotMatch(html,/\bonclick\s*=/i);
});

test('record action delegation validates ids and invokes edit/delete ports',()=>{
  const api=runtime(),listeners={},calls=[],element={addEventListener:(name,handler)=>{listeners[name]=handler;},contains:()=>true};
  api.DG_RECORD_ITEM_UI.bind(element,{edit:id=>calls.push(['edit',id]),delete:id=>calls.push(['delete',id])});
  for(const [action,id] of [['edit','7'],['delete','8'],['edit','0']]){
    const button={dataset:{recordAction:action,recordId:id}};
    listeners.click({target:{closest:selector=>selector==='[data-record-action]'?button:null}});
  }
  assert.deepEqual(calls,[['edit',7],['delete',8]]);
});

test('project renderer escapes the name and includes totals, statuses, and rows', () => {
  const api = runtime();
  const html = api.DG_RECORD_PROJECT_UI.render('<b>Park</b>', [
    { carbon_kg: 3, status: 'Onaylı' }, { carbon_kg: 2, status: 'Beklemede' },
  ], {
    escape: (value) => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    renderItem: (row) => `<article>${row.carbon_kg}</article>`,
  });
  assert.match(html, /&lt;b&gt;Park&lt;\/b&gt;/);
  assert.match(html, /2 kayıt · 1 onaylı · 1 bekliyor/);
  assert.match(html, /<b>5\.0<\/b>/);
  assert.match(html, /<article>3<\/article><article>2<\/article>/);
});

test('own-record adapter preserves the owner scoped, newest-first Supabase query', async () => {
  const api = runtime();
  const calls = [];
  const query = {
    select(value) { calls.push(['select', value]); return this; },
    eq(field, value) { calls.push(['eq', field, value]); return this; },
    order(field, options) { calls.push(['order', field, options]); return Promise.resolve({ data: [] }); },
  };
  const result = await api.DG_OWN_RECORDS_STORE.load({ from: (table) => { calls.push(['from', table]); return query; } }, 'user-1');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['from', 'measurements'], ['select', '*,projects(name)'], ['eq', 'owner', 'user-1'],
    ['order', 'created_at', { ascending: false }],
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { data: [] });
});

test('own-record adapter falls back to owner-scoped rows if the projects join is unavailable', async () => {
  const api = runtime(), calls = [], replies = [
    { data: null, error: { code: 'PGRST200', message: 'relationship not in schema cache' } },
    { data: [{ id: 8, owner: 'user-1' }], error: null },
  ];
  const client = { from(table) { calls.push(['from', table]); return {
    select(value) { calls.push(['select', value]); return this; },
    eq(field, value) { calls.push(['eq', field, value]); return this; },
    order(field, options) { calls.push(['order', field, options]); return Promise.resolve(replies.shift()); },
  }; } };
  const result = await api.DG_OWN_RECORDS_STORE.load(client, 'user-1');
  assert.equal(result.data[0].id, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['from', 'measurements'], ['select', '*,projects(name)'], ['eq', 'owner', 'user-1'], ['order', 'created_at', { ascending: false }],
    ['from', 'measurements'], ['select', '*'], ['eq', 'owner', 'user-1'], ['order', 'created_at', { ascending: false }],
  ]);
});
