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

test('publication error domain preserves quota, ownership, schema, permission and translated duplicate messages', () => {
  const api = loadModule('src/domain/reports/publication-request-error.js').DG_PUBLICATION_REQUEST_ERROR;
  assert.match(api.message({ status: 0, txt: 'NETWORK offline' }), /Ağ hatası: offline/);
  assert.match(api.message({ status: 404, txt: 'missing' }), /0008_report_publish\.sql/);
  assert.equal(api.message({ status: 409, txt: 'duplicate key' }, value => 'EN:' + value), 'EN:Bu park için bekleyen bir istek zaten var — kuyruktaki iş bitsin.');
  assert.match(api.message({ status: 400, txt: 'REPORT_QUOTA DG0QT' }), /24 saatte 3/);
  assert.match(api.message({ status: 400, txt: 'REPORT_NOT_YOUR_PARK DG0NP' }), /kendi parkının/);
  assert.match(api.message({ status: 403, txt: 'permission denied' }), /Yetki yok/);
  assert.match(api.message({ status: 400, txt: 'x'.repeat(300) }), new RegExp('x'.repeat(100)));
  assert.equal(api.message({ status: 400, txt: 'x'.repeat(300) }).length, 'İstek yazılamadı (HTTP 400): '.length + 160);
});

test('publication request workflow preserves lazy collection, success await and error delegation', async () => {
  const api = loadModule('src/application/reports/request-publication.js').DG_REQUEST_PUBLICATION;
  const events = [];
  await api.execute(8, false, {
    collect: async (...args) => { events.push(['collect', ...args]); return { ok: true }; },
    onSuccess: async () => { events.push(['success']); },
    onFailure: result => events.push(['failure', result.status]),
  });
  await api.execute(9, true, {
    collect: async () => ({ ok: false, status: 409 }),
    onSuccess: () => events.push(['unexpected-success']),
    onFailure: result => events.push(['failure', result.status]),
  });
  await api.execute(10, true, { collect: async () => null, onSuccess: () => events.push(['unexpected-null']) });
  assert.deepEqual(plain(events), [['collect', 8, false], ['success'], ['failure', 409]]);
});

test('cancel workflow keeps authorization, confirmation, write, failure and success ordering', async () => {
  const api = loadModule('src/application/reports/cancel-publication-request.js').DG_CANCEL_PUBLICATION_REQUEST;
  const events = [];
  await api.execute({ canCancel: () => false, onDenied: () => events.push('denied') });
  await api.execute({ canCancel: () => true, confirm: () => false, cancel: () => events.push('unexpected-write') });
  await api.execute({
    canCancel: () => true, confirm: () => true,
    cancel: async () => { events.push('write'); return { error: Error('api') }; },
    onFailure: error => events.push(error.message), onSuccess: () => events.push('unexpected-success'),
  });
  await api.execute({
    canCancel: () => true, confirm: () => true,
    cancel: async () => { events.push('write-ok'); return { error: null }; },
    onFailure: () => events.push('unexpected-error'), onSuccess: async () => events.push('success'),
  });
  assert.deepEqual(events, ['denied', 'write', 'api', 'write-ok', 'success']);
});

test('retraction insert adapter sends the exact RLS-safe body and uses session token or anon fallback', async () => {
  const api = loadModule('src/adapters/reports/retraction-insert-store.js').DG_REPORT_RETRACTION_INSERT_STORE;
  const calls = [];
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'user-jwt' } } }) } };
  const result = await api.insert(client, {
    fetch: async (...args) => { calls.push(args); return { status: 201, text: async () => 'ignored' }; },
    supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', reportId: 'DGR-2026-0002',
    parkId: '5', reason: 'yanlışlıkla', userId: 'u-1',
  });
  assert.deepEqual(plain(result), { ok: true, status: 201, txt: '' });
  assert.equal(calls[0][0], 'https://x.supabase.co/rest/v1/report_retractions');
  assert.deepEqual(plain(calls[0][1].headers), {
    apikey: 'anon', Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json', Prefer: 'return=minimal',
  });
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), [{ report_id: 'DGR-2026-0002', park_id: 5, reason: 'yanlışlıkla', status: 'Beklemede', requested_by: 'u-1' }]);
  const fallback = await api.insert({ auth: { getSession: async () => { throw Error('no session'); } } }, {
    fetch: async (_url, options) => { calls.push([_url, options]); return { status: 400, text: async () => 'denied' }; },
    supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', reportId: 'id', parkId: 1,
  });
  assert.equal(calls[1][1].headers.Authorization, 'Bearer anon');
  assert.deepEqual(plain(fallback), { ok: false, status: 400, txt: 'denied' });
  const network = await api.insert(client, { fetch: async () => { throw Error('offline'); }, supabaseUrl: 'x', anonKey: 'a' });
  assert.deepEqual(plain(network), { ok: false, status: 0, txt: 'NETWORK offline' });
});

test('retraction error domain preserves SQL, identity, quota, ownership, inactive and permission mapping', () => {
  const api = loadModule('src/domain/reports/retraction-request-error.js').DG_RETRACTION_REQUEST_ERROR;
  const cases = [
    [{ status: 404, txt: 'relation does not exist' }, /0010_report_retraction\.sql/],
    [{ status: 400, txt: 'RETRACT_BAD_ID DG0RF' }, /DGR-YYYY-NNNN/],
    [{ status: 409, txt: 'RETRACT_DUPLICATE DG0RD' }, /zaten var/],
    [{ status: 400, txt: 'RETRACT_QUOTA DG0RQ' }, /24 saatte 3/],
    [{ status: 400, txt: 'RETRACT_NOT_YOUR_PARK DG0RP' }, /kendi parkının/],
    [{ status: 400, txt: 'RETRACT_NOT_SELF DG0RN' }, /kendi adına/],
    [{ status: 400, txt: 'RETRACT_INACTIVE DG0RI' }, /etkin değil/],
    [{ status: 403, txt: 'permission denied' }, /Yetki yok/],
  ];
  for (const [result, expected] of cases) assert.match(api.message(result), expected);
});

test('report service delegates publication action workflows, retraction adapter and error maps', () => {
  const service = read('src/services/report-publish.js');
  for (const name of [
    'DG_PUBLICATION_REQUEST_ERROR', 'DG_REQUEST_PUBLICATION', 'DG_CANCEL_PUBLICATION_REQUEST',
    'DG_REPORT_RETRACTION_INSERT_STORE', 'DG_RETRACTION_REQUEST_ERROR',
  ]) assert.match(service, new RegExp('window\\.' + name));
  assert.match(service, /function dgRetractInsert\(reportId,parkId,reason\)\{\s*return window\.DG_REPORT_RETRACTION_INSERT_STORE\.insert/);
});
