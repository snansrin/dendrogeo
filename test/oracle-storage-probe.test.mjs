import test from 'node:test';
import assert from 'node:assert/strict';
import {probeStorage, probeTarget} from '../supabase/functions/oracle-storage-probe/storage.mjs';

const id = '11111111-2222-4333-8444-555555555555';

test('probe is pinned to the private staging bucket and a unique synthetic object path', () => {
  assert.equal(
    probeTarget(id),
    'https://axoyfs0bhrlc.compat.objectstorage.eu-paris-1.oraclecloud.com/dendrogeo-staging-private/connectivity-check/11111111-2222-4333-8444-555555555555.txt'
  );
  assert.throws(() => probeTarget('bucket/other'), /Invalid probe identifier/);
});

test('probe writes a small synthetic text and verifies the same content by reading it back', async () => {
  const requests = [];
  const result = await probeStorage({
    id,
    sign: async (url, init) => {
      requests.push({url, method: init.method, body: init.body});
      return new Request(url, init);
    },
    fetcher: async request => request.method === 'PUT'
      ? new Response(null, {status: 200})
      : new Response(requests[0].body, {status: 200})
  });
  assert.deepEqual(requests.map(request => request.method), ['PUT', 'GET']);
  assert.equal(requests[0].url, requests[1].url);
  assert.match(requests[0].body, /^DendroGeo private storage connectivity check: [a-f0-9-]{36}\n$/);
  assert.deepEqual(result, {
    bucket: 'dendrogeo-staging-private', region: 'eu-paris-1',
    bytes: new TextEncoder().encode(requests[0].body).byteLength, verified: true
  });
});

test('probe fails closed when readback does not match the written text', async () => {
  await assert.rejects(() => probeStorage({
    id,
    sign: async (url, init) => new Request(url, init),
    fetcher: async request => request.method === 'PUT'
      ? new Response(null, {status: 200})
      : new Response('different content', {status: 200})
  }), /round-trip mismatch/);
});
