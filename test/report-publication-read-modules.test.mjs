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

function fakeClient(response, calls, { throwAt = null } = {}) {
  return {
    from(table) {
      calls.push(['from', table]);
      if (throwAt === 'from') throw new Error('transport');
      const query = {
        select(...args) { calls.push(['select', ...args]); return query; },
        order(...args) { calls.push(['order', ...args]); return query; },
        limit(...args) { calls.push(['limit', ...args]); return Promise.resolve(response); },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      return query;
    },
  };
}

test('publication link accepts only the exact DGR identity and builds its canonical URL', () => {
  const api = loadModule('src/domain/reports/publication-link.js').DG_REPORT_PUBLICATION_LINK;
  assert.equal(api.url('DGR-2026-0001'), 'https://dendrogeo.org/rapor/DGR-2026-0001/');
  assert.equal(api.url('DGR-2026-0001', 'https://example.test'), 'https://example.test/rapor/DGR-2026-0001/');
  for (const bad of ['', null, 'DGR-2026-1', 'javascript:alert(1)', 'https://evil.example/x', 'DGR-2026-0001/../../', '<img src=x>']) {
    assert.equal(api.isReportId(bad), false);
    assert.equal(api.url(bad), '');
  }
});

test('publication log reads a cache-busted no-store URL and accepts only entries arrays', async () => {
  const api = loadModule('src/adapters/reports/publication-log-store.js').DG_REPORT_PUBLICATION_LOG_STORE;
  const calls = [];
  const expected = { entries: [{ report_id: 'DGR-2026-0001' }] };
  const value = await api.load({
    url: '/rapor/yayin-kuyrugu.json', now: () => 42,
    fetch: async (...args) => { calls.push(args); return { ok: true, json: async () => expected }; },
  });
  assert.equal(value, expected);
  assert.deepEqual(plain(calls), [[ '/rapor/yayin-kuyrugu.json?_=42', { cache: 'no-store' } ]]);
  assert.equal(await api.load({ url: '/x', fetch: async () => ({ ok: false }) }), null);
  assert.equal(await api.load({ url: '/x', fetch: async () => ({ ok: true, json: async () => ({ entries: {} }) }) }), null);
  assert.equal(await api.load({ url: '/x', fetch: async () => { throw Error('offline'); } }), null);
});

test('publication request store preserves the exact newest-first limited query', async () => {
  const api = loadModule('src/adapters/reports/publication-request-store.js').DG_REPORT_PUBLICATION_REQUEST_STORE;
  const calls = [];
  const response = { data: [{ id: 1 }], error: null };
  assert.equal(await api.load(fakeClient(response, calls)), response);
  assert.deepEqual(plain(calls), [
    ['from', 'report_requests'],
    ['select', 'id,park_id,with_lulc,status,note,created_at,cancelled_at'],
    ['order', 'created_at', { ascending: false }],
    ['limit', 50],
  ]);
});

test('park comparison store preserves sorting and excludes pending, missing and empty parks', async () => {
  const api = loadModule('src/adapters/reports/park-comparison-store.js').DG_REPORT_PARK_COMPARISON_STORE;
  const calls = [];
  const data = [
    { park_id: 2, park_pending: false, records: 3 },
    { park_id: 0, park_pending: false, records: 5 },
    { park_id: 3, park_pending: true, records: 5 },
    { park_id: 4, park_pending: false, records: 0 },
    { park_id: 5, records: 1 },
  ];
  const result = await api.load(fakeClient({ data, error: null }, calls));
  assert.deepEqual(plain(calls), [
    ['from', 'v_park_compare'], ['select', '*'],
    ['order', 'carbon_kg', { ascending: false }],
  ]);
  assert.deepEqual(plain(result), [data[0], data[4]]);
  assert.deepEqual(plain(await api.load(fakeClient({ data: null, error: null }, []))), []);
  assert.deepEqual(plain(await api.load(fakeClient({ data, error: Error('api') }, []))), []);
  assert.equal(data.length, 5);
});

test('retraction store keeps newest-first selection and silently returns empty on unavailable table', async () => {
  const api = loadModule('src/adapters/reports/retraction-store.js').DG_REPORT_RETRACTION_STORE;
  const calls = [];
  const response = { data: [{ id: 7 }], error: null };
  assert.equal(await api.load(fakeClient(response, calls)), response.data);
  assert.deepEqual(plain(calls), [
    ['from', 'report_retractions'],
    ['select', 'id,report_id,park_id,reason,status,requested_by,created_at'],
    ['order', 'created_at', { ascending: false }],
    ['limit', 50],
  ]);
  assert.deepEqual(plain(await api.load(fakeClient({ data: [{ id: 8 }], error: Error('missing') }, []))), []);
  assert.deepEqual(plain(await api.load(fakeClient(null, [], { throwAt: 'from' }))), []);
});

test('report publication service delegates link and all four reads to the new modules', () => {
  const service = read('src/services/report-publish.js');
  for (const name of [
    'DG_REPORT_PUBLICATION_LINK',
    'DG_REPORT_PUBLICATION_LOG_STORE',
    'DG_REPORT_PUBLICATION_REQUEST_STORE',
    'DG_REPORT_PARK_COMPARISON_STORE',
    'DG_REPORT_RETRACTION_STORE',
  ]) assert.match(service, new RegExp('window\\.' + name));
  assert.match(service, /function dgPubUrl\(reportId\)\{return window\.DG_REPORT_PUBLICATION_LINK\.url/);
  assert.match(service, /DG_REPORT_PUBLICATION_REQUEST_STORE\.load\(sb\)/);
  assert.match(service, /DG_REPORT_PARK_COMPARISON_STORE\.load\(sb\)/);
  assert.match(service, /DG_REPORT_RETRACTION_STORE\.load\(sb\)/);
});
