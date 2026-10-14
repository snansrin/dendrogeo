import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('OSM ring fallback exists before the domain adapter and does not override the real adapter',()=>{
  const window={},context=vm.createContext({window});
  vm.runInContext(readFileSync(new URL('../src/domain/parks/ensure-osm-rings.js',import.meta.url),'utf8'),context);
  assert.equal(JSON.stringify(window.DG_PARK_OSM_RINGS.extractRings({type:'way',geometry:[{lat:41,lon:29},{lat:41,lon:30},{lat:42,lon:30},{lat:41,lon:29}]})),JSON.stringify([[[41,29],[41,30],[42,30],[41,29]]]));
  const relation=window.DG_PARK_OSM_RINGS.extractRings({type:'relation',members:[{role:'outer',geometry:[{lat:41,lon:29},{lat:41,lon:30}]},{role:'outer',geometry:[{lat:41,lon:30},{lat:42,lon:30},{lat:41,lon:29}]}]});
  assert.equal(relation.outer.length,1);assert.equal(JSON.stringify(relation.outer[0]),JSON.stringify([[41,29],[41,30],[42,30],[41,29]]));
  assert.deepEqual(Array.from(window.DG_PARK_OSM_RINGS.joinWaysToRings([])),[]);
  const head=readFileSync(new URL('../partials/head.html',import.meta.url),'utf8');
  assert.ok(head.indexOf('src/domain/parks/ensure-osm-rings.js')<head.indexOf('src/domain/parks/osm-rings.js'));
  assert.ok(head.indexOf('src/domain/parks/osm-rings.js')<head.indexOf('src/services/park-geometry.js'));
  const serviceWorker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.ok(serviceWorker.includes("'/src/domain/parks/ensure-osm-rings.js'"));
  const bootstrap=readFileSync(new URL('../src/workers/surface-worker-bootstrap.js',import.meta.url),'utf8');
  assert.ok(bootstrap.indexOf("'../domain/parks/osm-rings.js'")<bootstrap.indexOf("'./surface-worker.js'"),'worker bootstrap must load the ring implementation before the frozen worker');
  assert.ok(bootstrap.indexOf("'../domain/parks/ensure-osm-rings.js'")<bootstrap.indexOf("'./surface-worker.js'"),'worker bootstrap must load a ring fallback before the frozen worker');
  const router=readFileSync(new URL('../src/adapters/surface/route-surface-worker-bootstrap.js',import.meta.url),'utf8');
  assert.ok(router.includes('/surface-worker-bootstrap.js'),'worker router must use the modular bootstrap');
});
