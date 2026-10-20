import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';

const read = relativePath => readFileSync(new URL('../' + relativePath, import.meta.url), 'utf8');

test('retired Oracle edge route has no SDK, credentials, network access or staging import', () => {
  const source = read('supabase/functions/oracle-storage-probe/index.ts');
  assert.match(source, /Deno\.serve\(/);
  assert.doesNotMatch(source, /^\s*import\s|\bAwsClient\b|\bprobeStorage\b|\bDeno\.env\b|\bfetch\s*\(|\bSUPABASE_URL\b|\bOCI_STORAGE_ACCESS_KEY_ID\b|\bOCI_STORAGE_SECRET_ACCESS_KEY\b/m);
});

test('retired Oracle edge route always rejects requests without fetching any data', async () => {
  const source = read('supabase/functions/oracle-storage-probe/index.ts');
  let handler;
  let fetchCalls = 0;
  const context = {
    Response,
    Deno: {
      serve(fn) { assert.equal(handler, undefined); handler = fn; },
      env: {get() { throw Error('retired handler must not read environment'); }}
    },
    fetch() { fetchCalls++; throw Error('retired handler must not issue network requests'); }
  };
  vm.runInNewContext(source, context, {filename: 'oracle-storage-probe/index.ts', timeout: 1000});
  assert.equal(typeof handler, 'function');

  for (const method of ['GET', 'POST', 'OPTIONS', 'DELETE']) {
    const response = await handler(new Request('https://example.invalid/functions/v1/oracle-storage-probe', {
      method,
      headers: {origin: 'https://dendrogeo.org', Authorization: 'Bearer fixture'}
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {error: 'Oracle staging probe disabled'});
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(fetchCalls, 0);
});

test('retired Oracle staging browser route is absent from static hosting', () => {
  assert.equal(existsSync(new URL('../oracle-storage-check/index.html',import.meta.url)),false);
  assert.equal(existsSync(new URL('../oracle-storage-check/probe.js',import.meta.url)),false);
  assert.equal(existsSync(new URL('../oracle-storage-check/probe.css',import.meta.url)),false);
});

test('free plan operating guide explicitly separates log scanning and egress', () => {
  const guide = read('docs/SUPABASE-FREE-PLAN-BUDGET.md');
  assert.match(guide, /Log Query/);
  assert.match(guide, /Egress/);
  assert.match(guide, /58,664 GB kullanılan/);
  assert.match(guide, /Varsayılan: Supabase Logs taraması yapma/);
});
