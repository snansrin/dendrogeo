import test from 'node:test';
import assert from 'node:assert/strict';
import {probeStorage} from '../supabase/functions/oracle-storage-probe/storage.mjs';

const id = '11111111-2222-4333-8444-555555555555';
const sign = async (url, init) => new Request(url, init);

// These are transport mocks: no Oracle credentials, network, or production files.
test('rejects invalid probe IDs before signing or sending an object request', async () => {
  for (const invalidId of ['../other', 'not-a-uuid', 'a'.repeat(37), '/'.repeat(36)]) {
    let signing = 0, requests = 0;
    await assert.rejects(probeStorage({
      id: invalidId,
      sign: async () => { signing++; throw Error('unexpected signing'); },
      fetcher: async () => { requests++; throw Error('unexpected fetch'); }
    }), /Invalid probe identifier/);
    assert.equal(signing, 0);
    assert.equal(requests, 0);
  }
});

test('a rejected object PUT stops without a follow-up GET or provider error disclosure', async () => {
  const seen = [];
  await assert.rejects(probeStorage({
    id, sign,
    fetcher: async (request, options) => {
      seen.push(request.method);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response('provider-private-token', {status: 403});
    }
  }), error => error.message === 'Object storage PUT failed (403)');
  assert.deepEqual(seen, ['PUT']);
});

test('a rejected object GET stops without accepting a storage round-trip', async () => {
  const seen = [];
  await assert.rejects(probeStorage({
    id, sign,
    fetcher: async request => {
      seen.push(request.method);
      return request.method === 'PUT'
        ? new Response(null, {status: 201})
        : new Response('not authorized', {status: 401});
    }
  }), error => error.message === 'Object storage GET failed (401)');
  assert.deepEqual(seen, ['PUT', 'GET']);
});

test('a readback larger than the 1 KiB safety bound is rejected', async () => {
  const seen = [];
  await assert.rejects(probeStorage({
    id, sign,
    fetcher: async request => {
      seen.push(request.method);
      return request.method === 'PUT'
        ? new Response(null, {status: 200})
        : new Response('a'.repeat(1025), {status: 200});
    }
  }), /Unexpected storage response/);
  assert.deepEqual(seen, ['PUT', 'GET']);
});

test('a signing failure never starts a network request', async () => {
  let requests = 0;
  await assert.rejects(probeStorage({
    id,
    sign: async () => { throw Error('signing unavailable'); },
    fetcher: async () => { requests++; throw Error('unexpected request'); }
  }), /signing unavailable/);
  assert.equal(requests, 0);
});

test('request URLs remain confined to the staging prefix and the body contains synthetic text only', async () => {
  const calls = [];
  const result = await probeStorage({
    id, sign,
    fetcher: async (request, options) => {
      calls.push({url: request.url, method: request.method, body: request.method === 'PUT' ? await request.text() : null});
      assert.equal(options.redirect, 'error');
      return request.method === 'PUT'
        ? new Response(null, {status: 201})
        : new Response('DendroGeo private storage connectivity check: ' + id + '\n', {status: 200});
    }
  });
  assert.equal(result.verified, true);
  assert.deepEqual(calls.map(c => c.method), ['PUT','GET']);
  for (const {url} of calls) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:');
    assert.equal(parsed.hostname, 'axoyfs0bhrlc.compat.objectstorage.eu-paris-1.oraclecloud.com');
    assert.equal(parsed.pathname, '/dendrogeo-staging-private/connectivity-check/' + id + '.txt');
  }
  assert.equal(calls[0].body, 'DendroGeo private storage connectivity check: ' + id + '\n');
  assert.equal(calls[1].body, null);
});
