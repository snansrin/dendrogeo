import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/parks/fetch-osm-park-ring.js',import.meta.url),'utf8'),context);
const create=context.window.DG_OSM_PARK_RING_ADAPTER.create;

test('fetches a way and preserves node coordinate order',async()=>{
  let url='';
  const fetchOsm=create({fetch:async value=>{url=value;return{ok:true,json:async()=>({elements:[{type:'node',lat:1,lon:2},{type:'node',lat:3,lon:4},{type:'node',lat:5,lon:6},{type:'node',lat:1,lon:2}]})};}});
  assert.equal(JSON.stringify(await fetchOsm('way/88')),JSON.stringify({outer:[[[1,2],[3,4],[5,6],[1,2]]],inner:[]}));
  assert.match(url,/\/way\/88\/full\.json$/);
});

test('rejects invalid keys and reports HTTP failures',async()=>{
  const fetchOsm=create({fetch:async()=>({ok:false,status:503,json:async()=>({})})});
  assert.equal(await fetchOsm('node/88'),null);
  await assert.rejects(fetchOsm('relation/99'),/OSM HTTP 503/);
});

test('uses joined relation rings and preserves inner rings',async()=>{
  const outer=[[1,2],[3,4],[5,6],[1,2]],inner=[[2,3],[2,4],[3,4],[2,3]];
  let joinedElements;
  const fetchOsm=create({fetch:async()=>({ok:true,json:async()=>({elements:[{type:'way',id:1}]})}),joinWaysToRings:elements=>{joinedElements=elements;return[outer,inner];}});
  assert.equal(JSON.stringify(await fetchOsm('relation/99')),JSON.stringify({outer:[outer],inner:[inner]}));
  assert.equal(joinedElements.length,1);
});
