import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const modules = [
  'src/adapters/surface/stac-fetch-policy.js',
  'src/adapters/surface/open-raster-range.js',
  'src/adapters/surface/sign-stac-assets.js',
  'src/domain/surface/select-stac-tiles.js',
  'src/domain/surface/resolve-raster-window.js',
];
function env(modular) {
  const context = vm.createContext({ window: {}, console: { warn() {} }, AbortController, setTimeout, clearTimeout, URLSearchParams, Date, Map });
  if (modular) for (const path of modules) vm.runInContext(read(path), context);
  vm.runInContext(read('src/services/lc-config.js'), context);
  vm.runInContext(read('src/services/lc-stac.js'), context);
  return context;
}
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

test('STAC query, year filtering, signing, asset selection and raster windows match fallback', async () => {
  const fallback = env(false), modular = env(true), requests = [];
  const response = { features: [
    { id: '36S-2020', properties: {}, assets: { data: { href: 'cross.tif', type: 'image/tiff; application=geotiff' } } },
    { id: '36S-2019', properties: {}, assets: { data: { href: 'old.tif' } } },
    { id: 'esa-worldcover-v200-2021', properties: {}, assets: { map: { href: 'map.tif' } } },
  ] };
  for (const context of [fallback, modular]) context.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => response }; };
  for (const context of [fallback, modular]) context.tiles = await vm.runInContext('dgLcFindTiles({minLon:29,minLat:41,maxLon:30,maxLat:42})', context);
  same(modular.tiles, fallback.tiles);
  const request = requests.at(-1);
  assert.match(request.url, /\/search\?/);
  assert.equal(request.options.method, undefined);
  assert.equal(request.options.body, undefined);
  assert.equal(request.options.headers.Accept, 'application/geo+json');

  for (const context of [fallback, modular]) {
    context.href = 'https://example.test/cog.tif?x=1'; context.token = '?sig=abc';
    assert.equal(vm.runInContext('dgLcSignedHref(href,token)', context), 'https://example.test/cog.tif?x=1&sig=abc');
    context.item = { assets: { data: { href: 'one.tif' }, fallback: { href: 'two.tif', type: 'image/tiff; application/geo+tiff' } } };
  }
  same(vm.runInContext('dgLcGetDataAsset(item)', modular), vm.runInContext('dgLcGetDataAsset(item)', fallback));
  const meta = { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 10, height: 10, dx: 10, dy: 10 };
  for (const context of [fallback, modular]) { context.image = { getBoundingBox: () => [0,0,100,100], getWidth: () => 10, getHeight: () => 10 }; context.meta = meta; context.parkBox = { minX: 15, minY: 15, maxX: 45, maxY: 45 }; }
  same(vm.runInContext('dgLcImageMeta(image)', modular), vm.runInContext('dgLcImageMeta(image)', fallback));
  same(vm.runInContext('dgLcWindowForPark(meta,parkBox)', modular), vm.runInContext('dgLcWindowForPark(meta,parkBox)', fallback));
});

test('STAC fetch policy retries transient responses and SAS token cache stays bounded', async () => {
  for (const modular of [false, true]) {
    const context = env(modular); let attempts = 0;
    context.setTimeout = (callback, delay) => setTimeout(callback, delay === 30000 || delay === 10000 ? delay : 0);
    context.fetch = async () => { attempts++; return attempts === 1 ? { ok: false, status: 503, body: { cancel: async () => {} } } : { ok: true, json: async () => ({ ok: true }) }; };
    const value = await vm.runInContext('dgLcFetchJson("https://example.test")', context);
    assert.deepEqual(JSON.parse(JSON.stringify(value)), { ok: true });
    assert.equal(attempts, 2);
  }
  for (const modular of [false, true]) {
    const context = env(modular); let requests = 0;
    context.fetch = async () => { requests++; return { ok: true, json: async () => ({ token: '?se=' + encodeURIComponent(new Date(Date.now() + 3600000).toISOString()), msftExpiry: new Date(Date.now() + 3600000).toISOString() }) }; };
    const first = await vm.runInContext('dgLcGetSas("sentinel-2-l2a")', context);
    const second = await vm.runInContext('dgLcGetSas("sentinel-2-l2a")', context);
    assert.equal(first, second);
    assert.equal(requests, 1);
  }
});

test('COG range adapter keeps Range headers, response metadata and body lifetime', async () => {
  for (const modular of [false, true]) {
    const context = env(modular), seen = [];
    class BaseResponse {}
    class BaseClient { constructor(url) { this.url = url; } }
    context.GeoTIFF = { BaseResponse, BaseClient, fromCustomClient: client => Promise.resolve({ client }) };
    context.fetch = async (url, options) => { seen.push({ url, headers: options.headers }); return { ok: true, status: 206, headers: { get: name => name === 'Content-Range' ? 'bytes 0-2/10' : null }, arrayBuffer: async () => new Uint8Array([1,2,3]).buffer }; };
    context.raster = await vm.runInContext('dgLcOpenRaster("https://example.test/cog.tif")', context);
    context.response = await context.raster.client.request({ headers: { Range: 'bytes=0-2' } });
    assert.equal(seen[0].headers.Range, 'bytes=0-2');
    assert.equal(context.response.status, 206);
    assert.equal(context.response.getHeader('Content-Range'), 'bytes 0-2/10');
    assert.deepEqual(Array.from(new Uint8Array(await context.response.getData())), [1,2,3]);
  }
});

test('five STAC modules load before the service and are precached offline', () => {
  const loader = read('src/utils/lazylibs.js'), worker = read('sw.js'), service = loader.indexOf('"src/services/lc-stac.js"');
  for (const path of modules) {
    assert.ok(loader.indexOf('"' + path + '"') >= 0 && loader.indexOf('"' + path + '"') < service, path);
    assert.ok(worker.includes("'/" + path + "'"), path);
  }
});
