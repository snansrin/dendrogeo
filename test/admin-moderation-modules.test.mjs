import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'src/domain/admin/measurement-review-payload.js',
  'src/adapters/admin/measurement-moderation-store.js',
  'src/application/admin/review-measurement.js',
  'src/application/admin/override-measurement-geofence.js',
  'src/application/admin/delete-measurement.js',
];
function runtime() {
  const context = { window: {} };
  vm.createContext(context);
  for (const path of paths) vm.runInContext(readFileSync(join(ROOT, path), 'utf8'), context);
  return context.window;
}

test('review payload keeps approval and rejection status/share pairs', () => {
  const api = runtime();
  assert.deepEqual({ ...api.DG_ADMIN_MEASUREMENT_REVIEW_PAYLOAD.build('Onaylı', true) }, { status: 'Onaylı', shared: true });
  assert.deepEqual({ ...api.DG_ADMIN_MEASUREMENT_REVIEW_PAYLOAD.build('Red', false) }, { status: 'Red', shared: false });
});

test('review application updates only the selected measurement and returns PostgREST result', async () => {
  const api = runtime();
  const calls = [];
  const sb = { from: (table) => ({ update: (payload) => ({ eq: async (field, id) => { calls.push([table, payload, field, id]); return { error: null }; } }) }) };
  const result = await api.DG_ADMIN_REVIEW_MEASUREMENT.review(sb, 14, 'Onaylı', true, api.DG_ADMIN_MODERATION_STORE);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['measurements', { status: 'Onaylı', shared: true }, 'id', 14]]);
  assert.deepEqual({ ...result }, { error: null });
});

test('geofence override writes the acting administrator as the audit identity', async () => {
  const api = runtime();
  let write;
  const sb = { from: () => ({ update: (payload) => ({ eq: async (field, id) => { write = [payload, field, id]; return { error: null }; } }) }) };
  await api.DG_ADMIN_OVERRIDE_MEASUREMENT_GEOFENCE.execute(sb, 8, 'admin-2', api.DG_ADMIN_MODERATION_STORE);
  assert.deepEqual(JSON.parse(JSON.stringify(write)), [{ geo_override_by: 'admin-2' }, 'id', 8]);
});

test('delete use case removes a linked photo only after confirmed row deletion', async () => {
  const api = runtime();
  const order = [];
  const sb = { from: (table) => ({
    select: (columns) => ({ eq: (field, id) => ({ single: async () => { order.push(['read', table, columns, field, id]); return { data: { photo_url: 'public/tree.jpg' } }; } }) }),
    delete: () => ({ eq: (field, id) => ({select:async columns=>{order.push(['delete', table, field, id,columns]);return{data:[{id}],error:null};}}) }),
  }) };
  const result = await api.DG_ADMIN_DELETE_MEASUREMENT.execute(sb, 3, async (url) => order.push(['photo', url]), api.DG_ADMIN_MODERATION_STORE);
  assert.deepEqual(JSON.parse(JSON.stringify(order)), [
    ['read', 'measurements', 'photo_url', 'id', 3], ['delete', 'measurements', 'id', 3,'id'], ['photo', 'public/tree.jpg'],
  ]);
  assert.equal(result.error,null);
});

test('moderation store preserves direct Supabase method sequence and missing-photo behavior', async () => {
  const api = runtime();
  const order = [];
  const sb = { from: (table) => ({
    select: (columns) => ({ eq: (field, id) => ({ single: async () => { order.push([table, columns, field, id]); return { data: null }; } }) }),
    delete: () => ({ eq: (field, id) => ({select:async columns=>{order.push(['delete', table, field,id,columns]);return{data:[],error:null};}}) }),
  }) };
  let removed = false;
  await api.DG_ADMIN_DELETE_MEASUREMENT.execute(sb, 9, async () => { removed = true; }, api.DG_ADMIN_MODERATION_STORE);
  assert.equal(removed, false);
  assert.deepEqual(JSON.parse(JSON.stringify(order)), [['measurements', 'photo_url', 'id', 9], ['delete', 'measurements', 'id', 9,'id']]);
});
