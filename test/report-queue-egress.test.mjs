import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchUnprocessedRequests,
  REQUEST_COLUMNS_WITH_SURFACE,
  REQUEST_COLUMNS_NO_SURFACE
} from '../scripts/lib/report-queue-pending-fetch.mjs';

const response = (rows, status = 200) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => rows,
  text: async () => 'HTTP ' + status
});
const request = (id, extra = {}) => ({id, park_id: 25, status: 'Beklemede', ...extra});

test('empty queue uses only a narrow ID projection and no surface download', async () => {
  const calls = [];
  const rows = await fetchUnprocessedRequests(async (select, size, offset) => {
    calls.push({select,size,offset});
    return response([]);
  });
  assert.deepEqual(rows, []);
  assert.deepEqual(calls, [{select:'id',size:50,offset:0}]);
});

test('previously published snapshot rows never trigger a full read', async () => {
  const calls = [];
  const rows = await fetchUnprocessedRequests(async select => {
    calls.push(select);
    assert.equal(select, 'id', 'published queue rows must not download surface_snapshot');
    return response([request('published')]);
  }, {processedIds:['published']});
  assert.deepEqual(rows, []);
  assert.deepEqual(calls, ['id']);
});

test('new pending request fetches its detail with accepted surface snapshot intact', async () => {
  const calls = [];
  const snapshot = {classAreas:{water:12.05}};
  const rows = await fetchUnprocessedRequests(async select => {
    calls.push(select);
    if (select === 'id') return response([request('old'),request('new')]);
    assert.equal(select, REQUEST_COLUMNS_WITH_SURFACE);
    return response([request('old',{surface_snapshot:{old:true}}),request('new',{surface_snapshot:snapshot})]);
  }, {processedIds:['old']});
  assert.deepEqual(rows, [request('new',{surface_snapshot:snapshot})]);
  assert.deepEqual(calls, ['id', REQUEST_COLUMNS_WITH_SURFACE]);
});

test('legacy schema without surface_snapshot retains fallback for new work', async () => {
  const calls = [];
  const rows = await fetchUnprocessedRequests(async select => {
    calls.push(select);
    if(select==='id') return response([request('new')]);
    if(select===REQUEST_COLUMNS_WITH_SURFACE) return response([],400);
    assert.equal(select,REQUEST_COLUMNS_NO_SURFACE);
    return response([request('new')]);
  });
  assert.deepEqual(rows,[request('new')]);
  assert.deepEqual(calls,['id',REQUEST_COLUMNS_WITH_SURFACE,REQUEST_COLUMNS_NO_SURFACE]);
});

test('checks subsequent ID pages without fetching completed first page', async () => {
  const first = Array.from({length:50},(_,i)=>request('done-'+i));
  const calls = [];
  const rows = await fetchUnprocessedRequests(async (select, size, offset, cutoff) => {
    calls.push([select,size,offset,cutoff]);
    if(offset===0) {
      assert.equal(select,'id');
      return response(first);
    }
    if(select==='id') return response([request('new')]);
    return response([request('new',{surface_snapshot:{accepted:true}})]);
  }, {processedIds:first.map(r=>r.id),cutoff:'2026-10-04T08:26:48Z'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'new');
  assert.deepEqual(calls.map(c=>[c[0],c[2]]),[['id',0],['id',50],[REQUEST_COLUMNS_WITH_SURFACE,50]]);
  assert.ok(calls.every(c=>c[3]==='2026-10-04T08:26:48Z'));
});

test('missing queue fails closed without silently treating it as empty', async () => {
  await assert.rejects(
    fetchUnprocessedRequests(async()=>response([],404)),
    error=>error.code==='NO_TABLE'
  );
  await assert.rejects(fetchUnprocessedRequests(async()=>response([],503)),/metadata HTTP 503/);
  await assert.rejects(fetchUnprocessedRequests(async()=>response({unexpected:true})),/Invalid report request ID page/);
});
