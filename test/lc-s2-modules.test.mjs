import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const modulePaths = [
  'src/domain/surface/select-sentinel-scenes.js',
  'src/domain/surface/sentinel-temporal-windows.js',
  'src/domain/surface/sentinel-raster-grid.js',
  'src/domain/surface/sentinel-spectral-evidence.js',
  'src/application/surface/build-sentinel-profile.js',
];
function environment(modular) {
  const context = vm.createContext({ window: {}, console, Date, URLSearchParams, Set, Map });
  if (modular) for (const path of modulePaths) vm.runInContext(read(path), context);
  vm.runInContext(read('src/services/lc-validate.js'), context);
  vm.runInContext('var DG_LC_STAC="https://stac.example";', context);
  vm.runInContext(read('src/services/lc-s2.js'), context);
  context.dgLcFetchJson = async (url, options) => {
    context.lastRequest = { url, options };
    return { features: [
      { id: 'late', properties: { datetime: '2021-09-29T10:00:00Z', 's2:mgrs_tile': 'A', 'eo:cloud_cover': 2 }, assets: { B03: { href: 'a' }, B04: { href: 'a' }, B08: { href: 'a' }, B11: { href: 'a' }, SCL: { href: 'a' } } },
      { id: 'early', properties: { datetime: '2021-06-05T10:00:00Z', 's2:mgrs_tile': 'A', 'eo:cloud_cover': 1 }, assets: { B03: { href: 'a' }, B04: { href: 'a' }, B08: { href: 'a' }, B11: { href: 'a' }, SCL: { href: 'a' } } },
      { id: 'other-tile', properties: { datetime: '2021-09-25T10:00:00Z', 's2:mgrs_tile': 'B', 'eo:cloud_cover': 3 }, assets: { B03: { href: 'a' }, B04: { href: 'a' }, B08: { href: 'a' }, B11: { href: 'a' }, SCL: { href: 'a' } } },
    ] };
  };
  context.dgLcUtmForward = (lat, lon) => ({ x: lat * 1000, y: lon * 1000 });
  return context;
}
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

test('Sentinel-2 module path preserves scene search, date windows, raster grid and spectral math', async () => {
  const fallback = environment(false), modular = environment(true);
  const bbox = { minLon: 29, minLat: 41, maxLon: 30, maxLat: 42 };
  for (const context of [fallback, modular]) {
    context.bbox = bbox;
    context.rangeResult = await vm.runInContext('dgS2FindScenesRange(bbox,"2021-06-01","2021-09-30",2)', context);
  }
  same(modular.rangeResult, fallback.rangeResult);
  assert.equal(modular.lastRequest.options.headers.Accept, 'application/geo+json');
  assert.match(modular.lastRequest.url, /^https:\/\/stac\.example\/search\?/);
  assert.equal(modular.lastRequest.options.method, undefined);
  same(vm.runInContext('dgS2SeasonRange(2021,"ref")', modular), vm.runInContext('dgS2SeasonRange(2021,"ref")', fallback));
  same(vm.runInContext('dgS2WaterWindows(2021,"ytd","2026-10-07T12:00:00Z")', modular), vm.runInContext('dgS2WaterWindows(2021,"ytd","2026-10-07T12:00:00Z")', fallback));
  same(vm.runInContext('dgS2UtmBBox({minLat:41,minLon:29,maxLat:41.1,maxLon:29.1},32635)', modular), vm.runInContext('dgS2UtmBBox({minLat:41,minLon:29,maxLat:41.1,maxLon:29.1},32635)', fallback));
  same(vm.runInContext('dgS2CellIndex({minX:0,maxY:100,dx:10,dy:10},[0,0,10,10],25,75)', modular), vm.runInContext('dgS2CellIndex({minX:0,maxY:100,dx:10,dy:10},[0,0,10,10],25,75)', fallback));
  same(vm.runInContext('dgS2AssetEpsg({getGeoKeys:()=>({ProjectedCSTypeGeoKey:32635})})', modular), vm.runInContext('dgS2AssetEpsg({getGeoKeys:()=>({ProjectedCSTypeGeoKey:32635})})', fallback));
  for (const context of [fallback, modular]) context.evidence = { ndvi: [0.1, 0.3, 0.9], mndwi: [0.2, 0.7], dates: new Set(['a', 'b', 'b']) };
  for (const expr of [
    'dgS2Median([0.1,0.3,0.9])', 'dgS2ConfirmedExtreme([0.1,0.3,0.9])',
    'dgS2VegetationSummary(evidence)',
    'dgS2Reflectance(1200,{properties:{datetime:"2023-01-01"},assets:{B04:{}}},"B04")',
  ]) same(vm.runInContext(expr, modular), vm.runInContext(expr, fallback));
});

test('profile builder produces the locked median and annual evidence shape', () => {
  const context = environment(true);
  const result = vm.runInContext(`window.DG_BUILD_SENTINEL_PROFILE.initial({"1:2":{
    b03:[0.2,0.3,0.4],b04:[0.1,0.1,0.2],b08:[0.5,0.6,0.7],b11:[0.1,0.2,0.3],
    ndvis:[0.6,0.7,0.8],mndwis:[0.1,0.2,0.3],ndbis:[-0.2,-0.1,0],dates:new Set(["a","b","c"])
  }},3,{median:dgS2Median,confirmedExtreme:dgS2ConfirmedExtreme})`, context);
  const data = JSON.parse(JSON.stringify(result));
  assert.equal(data.nProfiled, 1);
  assert.deepEqual(data.out['1:2'], { obs: 3, ndviConfirmed: 0.7, mndwiConfirmed: 0.2, b03: 0.3, b04: 0.1, b08: 0.6, b11: 0.2, ndvi: 0.7, mndwi: 0.2, ndbi: -0.1, mndwiMax: 0.3, ndviMax: 0.8 });
  assert.deepEqual(data.evidence['1:2'].ndvi, [0.6, 0.7, 0.8]);
  assert.deepEqual(data.evidence['1:2'].mndwi, [0.1, 0.2, 0.3]);
  assert.deepEqual(Array.from(result.evidence['1:2'].dates), ['a', 'b', 'c']);
});

test('five Sentinel-2 modules load between validation and lc-s2 and are precached', () => {
  const chain = read('src/utils/lazylibs.js'), worker = read('sw.js');
  const s2Index = chain.indexOf('"src/services/lc-s2.js"');
  const validateIndex = chain.indexOf('"src/services/lc-validate.js"');
  for (const path of modulePaths) {
    assert.ok(chain.indexOf('"' + path + '"') > validateIndex && chain.indexOf('"' + path + '"') < s2Index, path);
    assert.ok(worker.includes("'/" + path + "'"), path + ' must be in service-worker precache');
  }
});
