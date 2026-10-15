import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const paths = [
  'src/adapters/surface/load-osm-landcover-evidence.js',
  'src/domain/surface/extract-osm-water-polygons.js',
  'src/application/surface/refine-water-by-osm.js',
  'src/domain/surface/osm-road-policy.js',
  'src/application/surface/refine-hard-by-osm.js',
];
function env(modular) {
  const context = vm.createContext({ window: {}, console, Date, AbortController, setTimeout, clearTimeout, fetch: async () => ({ ok: false }), encodeURIComponent });
  for (const path of paths) vm.runInContext(read(path), context);
  vm.runInContext(read('src/services/lc-osm.js'), context);
  context.PARK_POLY = [[[41, 29], [42, 29], [42, 30], [41, 30], [41, 29]]];
  context.dgLcPointInRing = (lat, lon, ring) => lat >= 0 && lon >= 0 && ring.length > 0;
  context.dgLcUtmForward = (lat, lon) => ({ x: lon * 1000, y: lat * 1000 });
  return context;
}
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

test('OSM water and road policies preserve their classification and geometry outputs', async () => {
  const fallback = env(false), modular = env(true);
  for (const tags of [
    { highway: 'service', surface: 'asphalt', width: '4' },
    { highway: 'footway', surface: 'paved' },
    { highway: 'residential', surface: 'dirt', lanes: '2' },
    { highway: 'track', surface: 'concrete' },
  ]) {
    for (const expression of ['dgLcRoadSurfaceIsHard(tags.surface)', 'dgLcRoadNumber(tags.width)', 'dgLcRoadHalfWidth(tags)', 'dgLcRoadShouldRefine(tags)']) {
      fallback.tags = tags; modular.tags = tags;
      same(vm.runInContext(expression, modular), vm.runInContext(expression, fallback));
    }
  }
  const data = { elements: [
    { type: 'way', id: 1, tags: { natural: 'water' }, geometry: [{ lat: 1, lon: 2 }, { lat: 2, lon: 3 }, { lat: 1, lon: 3 }] },
    { type: 'relation', id: 2, tags: { waterway: 'riverbank' }, members: [{ role: 'outer', geometry: [{ lat: 4, lon: 5 }, { lat: 5, lon: 6 }, { lat: 4, lon: 6 }] }] },
    { type: 'way', id: 3, tags: { highway: 'service', surface: 'asphalt', width: '6' }, geometry: [{ lat: 1, lon: 2 }, { lat: 2, lon: 3 }] },
  ] };
  const bbox = { minLat: 1, minLon: 1, maxLat: 2, maxLon: 2 };
  for (const context of [fallback, modular]) { context.bbox = bbox; context.window.DG_SURFACE_OSM = { elements: data.elements, bbox: { minLat: 0, minLon: 0, maxLat: 3, maxLon: 3 }, fetchedAt: new Date().toISOString() }; }
  same(await vm.runInContext('dgLcFetchWaterPolygons(bbox)', modular), await vm.runInContext('dgLcFetchWaterPolygons(bbox)', fallback));
  same(await vm.runInContext('dgLcFetchRoadFeatures(bbox)', modular), await vm.runInContext('dgLcFetchRoadFeatures(bbox)', fallback));

  const waterResult = () => ({ cells: [{ row: 0, col: 0, classKey: 'green', classCode: 10, areaM2: 100, center: { lat: 1, lon: 1 } }], groupCounts: { green: 1, water: 0 }, groupAreas: { green: 100, water: 0 }, maskedCount: 0, maskedAreaM2: 0, classifiedAreaM2: 100 });
  fallback.result = waterResult(); modular.result = waterResult();
  assert.equal(vm.runInContext('dgLcRefineWater(result,[[[0,0],[0,2],[2,2],[2,0]]])', modular), vm.runInContext('dgLcRefineWater(result,[[[0,0],[0,2],[2,2],[2,0]]])', fallback));
  same(modular.result, fallback.result);

  const feature = { pts: [[1, 0], [1, 2]], area: false, halfWidth: 1 };
  const hardResult = () => ({ cells: [{ row: 0, col: 0, classKey: 'green', classCode: 10, areaM2: 100, quadWgs: [[0,0],[0,2],[2,2],[2,0]] }], groupCounts: { green: 1, hard: 0, water: 0 }, groupAreas: { green: 100, hard: 0, water: 0 }, maskedCount: 0, maskedAreaM2: 0, classifiedAreaM2: 100 });
  fallback.result = hardResult(); modular.result = hardResult(); fallback.feature = feature; modular.feature = feature;
  assert.equal(vm.runInContext('dgLcRefineHardByOsm(result,[feature],32635)', modular), vm.runInContext('dgLcRefineHardByOsm(result,[feature],32635)', fallback));
  same(modular.result, fallback.result);
});

test('shared OSM request/cache and lazy/offline module ordering are preserved', async () => {
  for (const modular of [false, true]) {
    const context = env(modular); let requests = 0;
    context.overpassRequest = async () => { requests++; return { elements: [{ type: 'way', tags: { natural: 'water' }, geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, { lat: 3, lon: 3 }] }] }; };
    context.bbox = { minLat: 1, minLon: 1, maxLat: 2, maxLon: 2 };
    await Promise.all([
      vm.runInContext('dgLcFetchWaterPolygons(bbox)', context),
      vm.runInContext('dgLcFetchRoadFeatures(bbox)', context),
    ]);
    assert.equal(requests, 1);
  }
  const lazy = read('src/utils/lazylibs.js'), worker = read('sw.js'), serviceIndex = lazy.indexOf('"src/services/lc-osm.js"');
  for (const path of paths) {
    assert.ok(lazy.indexOf('"' + path + '"') >= 0 && lazy.indexOf('"' + path + '"') < serviceIndex, path);
    assert.ok(worker.includes("'/" + path + "'"), path);
  }
});

test('shared surface evidence query requests building footprints as well as roads and water', async () => {
  const context=env(true),queries=[];
  context.overpassRequest=async query=>{queries.push(query);return{elements:[]};};
  context.bbox={minLat:39.8,minLon:32.7,maxLat:39.9,maxLon:32.8};
  await vm.runInContext('dgLcOsmData(bbox)',context);
  assert.equal(queries.length,1);
  assert.match(queries[0],/nwr\["building"\]/);
  assert.match(queries[0],/nwr\["building:part"\]/);
  assert.match(queries[0],/way\["highway"\]/);
  assert.match(queries[0],/natural"="water/);
});
