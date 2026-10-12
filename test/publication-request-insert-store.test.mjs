import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ctx = vm.createContext({ window: null, Object, Number, String, JSON, Promise });
ctx.window = ctx;
vm.runInContext(read('src/adapters/reports/publication-request-insert-store.js'), ctx);

test('publication request POST preserves session JWT, exact metadata payload and return=minimal', async () => {
  let request;
  const result = await ctx.DG_REPORT_PUBLICATION_REQUEST_INSERT_STORE.insert({
    auth: { getSession: async () => ({ data: { session: { access_token: 'session-jwt' } } }) },
  }, {
    fetch: async (url, options) => { request = { url, options }; return { status: 201, text: async () => '' }; },
    supabaseUrl: 'https://example.supabase.co', anonKey: 'anon-key', parkId: '7', includeLandCover: false,
    userId: 'user-9', note: '{"schema":"dendrogeo-report-context/1"}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.txt, '');
  assert.equal(request.url, 'https://example.supabase.co/rest/v1/report_requests');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer session-jwt');
  assert.equal(request.options.headers.Prefer, 'return=minimal');
  assert.deepEqual(JSON.parse(request.options.body), [{
    park_id: 7, with_lulc: false, status: 'Beklemede', requested_by: 'user-9', note: '{"schema":"dendrogeo-report-context/1"}',
  }]);
});

test('missing session and session errors use the anon fallback while RLS remains server-enforced', async () => {
  const auths = [async () => ({ data: {} }), async () => { throw new Error('session unavailable'); }];
  for (const getSession of auths) {
    let authorization;
    await ctx.DG_REPORT_PUBLICATION_REQUEST_INSERT_STORE.insert({ auth: { getSession } }, {
      fetch: async (_url, options) => { authorization = options.headers.Authorization; return { status: 200, text: async () => '' }; },
      supabaseUrl: 'https://example.supabase.co', anonKey: 'anon-key', parkId: 3,
    });
    assert.equal(authorization, 'Bearer anon-key');
  }
});

test('PostgREST errors preserve HTTP status and response text; network errors keep the current shape', async () => {
  const base = { supabaseUrl: 'https://example.supabase.co', anonKey: 'anon-key', parkId: 1, fetch: async () => ({ status: 403, text: async () => 'RLS denied' }) };
  const denied = await ctx.DG_REPORT_PUBLICATION_REQUEST_INSERT_STORE.insert({ auth: { getSession: async () => ({ data: {} }) } }, base);
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 403);
  assert.equal(denied.txt, 'RLS denied');
  const network = await ctx.DG_REPORT_PUBLICATION_REQUEST_INSERT_STORE.insert({ auth: { getSession: async () => ({ data: {} }) } }, {
    ...base, fetch: async () => { throw new Error('offline'); },
  });
  assert.equal(network.ok, false);
  assert.equal(network.status, 0);
  assert.equal(network.txt, 'NETWORK offline');
});

test('report service delegates the publication insert to the adapter', () => {
  const service = read('src/services/report-publish.js');
  assert.match(service, /window\.DG_REPORT_PUBLICATION_REQUEST_INSERT_STORE\.insert\(sb/);
  assert.match(read('partials/head.html'), /src\/adapters\/reports\/publication-request-insert-store\.js/);
  assert.match(read('sw.js'), /'\/src\/adapters\/reports\/publication-request-insert-store\.js'/);
});
