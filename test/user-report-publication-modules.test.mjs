import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function loadModule(path) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read(path), context);
  return context.window;
}

function fakeClient(response, calls) {
  return {
    from(table) {
      calls.push(['from', table]);
      const query = {
        select(...args) { calls.push(['select', ...args]); return query; },
        eq(...args) { calls.push(['eq', ...args]); return query; },
        is(...args) { calls.push(['is', ...args]); return query; },
        order(...args) { calls.push(['order', ...args]); return query; },
        limit(...args) { calls.push(['limit', ...args]); return Promise.resolve(response); },
        update(...args) { calls.push(['update', ...args]); return query; },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      return query;
    },
  };
}

test('publication cancellation store writes the existing status/timestamp and filters by request ID', async () => {
  const api = loadModule('src/adapters/reports/publication-cancel-store.js').DG_REPORT_PUBLICATION_CANCEL_STORE;
  const calls = [];
  const response = { error: null };
  assert.equal(await api.cancel(fakeClient(response, calls), 'r-1', '2026-10-13T10:00:00Z'), response);
  assert.deepEqual(plain(calls), [
    ['from', 'report_requests'],
    ['update', { status: 'Vazgeçildi', cancelled_at: '2026-10-13T10:00:00Z' }],
    ['eq', 'id', 'r-1'],
  ]);
});

test('user publication store keeps park scope, fields, descending order and ten-row limit', async () => {
  const api = loadModule('src/adapters/reports/user-publication-request-store.js').DG_USER_PUBLICATION_REQUEST_STORE;
  const calls = [];
  const response = { data: [{ id: 'mine' }], error: null };
  assert.equal(await api.load(fakeClient(response, calls), 7), response);
  assert.deepEqual(plain(calls), [
    ['from', 'report_requests'],
    ['select', 'id,park_id,with_lulc,status,requested_by,created_at,cancelled_at'],
    ['eq', 'park_id', 7],
    ['order', 'created_at', { ascending: false }],
    ['limit', 10],
  ]);
});

test('own approved count remains exact, head-only and user/project scoped', async () => {
  const api = loadModule('src/adapters/reports/own-approved-measurements-store.js').DG_OWN_APPROVED_MEASUREMENTS_STORE;
  const calls = [];
  assert.equal(await api.count(fakeClient({ count: 3 }, calls), 12, 'u-1'), 3);
  assert.deepEqual(plain(calls), [
    ['from', 'measurements'],
    ['select', '*', { count: 'exact', head: true }],
    ['eq', 'project_id', 12], ['eq', 'owner', 'u-1'],
    ['eq', 'status', 'Onaylı'], ['is', 'deleted_at', null],
  ]);
  assert.equal(await api.count(fakeClient({ count: null }, []), 12, 'u-1'), 0);
});

test('user retraction store keeps park scope and empty fallback for unavailable table', async () => {
  const api = loadModule('src/adapters/reports/user-retraction-store.js').DG_USER_RETRACTION_STORE;
  const calls = [];
  const response = { data: [{ id: 3 }], error: null };
  assert.equal(await api.load(fakeClient(response, calls), 9), response.data);
  assert.deepEqual(plain(calls), [
    ['from', 'report_retractions'],
    ['select', 'id,report_id,park_id,reason,status,requested_by,created_at'],
    ['eq', 'park_id', 9],
    ['order', 'created_at', { ascending: false }],
    ['limit', 10],
  ]);
  assert.deepEqual(plain(await api.load(fakeClient({ data: null, error: Error('missing') }, []), 9)), []);
  assert.deepEqual(plain(await api.load(fakeClient(null, []), 9)), []);
});

test('user publication workflow reads requests before parallel supporting reads, then renders and schedules', async () => {
  const api = loadModule('src/application/reports/load-user-publication.js').DG_LOAD_USER_PUBLICATION;
  const events = [];
  const state = { parkId: 9, queue: { entries: ['old'] } };
  await api.execute(state, {
    loadRequests: async parkId => { events.push(['requests', parkId]); return { data: [{ id: 'r' }], error: null }; },
    loadQueue: async () => { events.push(['queue']); return null; },
    loadOwnApproved: async () => { events.push(['count']); return 2; },
    loadRetractions: async () => { events.push(['retractions']); return [{ id: 'x' }]; },
    requestError: () => 'error',
    render: () => events.push(['render']),
    schedulePoll: () => events.push(['schedule']),
  });
  assert.deepEqual(plain(events), [['requests', 9], ['queue'], ['count'], ['retractions'], ['render'], ['schedule']]);
  assert.equal(state.error, '');
  assert.deepEqual(state.requests, [{ id: 'r' }]);
  assert.deepEqual(state.queue, { entries: ['old'] });
  assert.equal(state.ownApproved, 2);
  assert.deepEqual(state.retracts, [{ id: 'x' }]);
});

test('user publication workflow preserves request errors and skips all reads without a park', async () => {
  const api = loadModule('src/application/reports/load-user-publication.js').DG_LOAD_USER_PUBLICATION;
  const events = [];
  const state = { parkId: 4, requests: [{ id: 'old' }] };
  await api.execute(state, {
    loadRequests: async () => { throw Error('offline'); },
    loadQueue: async () => { events.push('queue'); return null; },
    loadOwnApproved: async () => null,
    loadRetractions: async () => [],
    requestError: (error, transport) => `${transport}:${error.message}`,
    render: () => events.push('render'),
    schedulePoll: () => events.push('schedule'),
  });
  assert.equal(state.error, 'true:offline');
  assert.deepEqual(plain(state.requests), []);
  assert.deepEqual(events, ['queue', 'render', 'schedule']);

  let called = false;
  await api.execute({ parkId: 0 }, { loadRequests: () => { called = true; } });
  assert.equal(called, false);
});

test('report publication service delegates the user reads, refresh workflow and both cancellations', () => {
  const service = read('src/services/report-publish.js');
  for (const name of [
    'DG_REPORT_PUBLICATION_CANCEL_STORE',
    'DG_USER_PUBLICATION_REQUEST_STORE',
    'DG_OWN_APPROVED_MEASUREMENTS_STORE',
    'DG_USER_RETRACTION_STORE',
    'DG_LOAD_USER_PUBLICATION',
  ]) assert.match(service, new RegExp('window\\.' + name));
  assert.equal((service.match(/REPORT_PUBLICATION_CANCEL_STORE\.cancel\(sb,id,new Date\(\)\.toISOString\(\)\)/g) || []).length, 2);
});
