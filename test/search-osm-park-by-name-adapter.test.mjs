import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/parks/search-osm-park-by-name.js',import.meta.url),'utf8'),context);
const create=context.window.DG_OSM_PARK_NAME_SEARCH_ADAPTER.create;

test('builds the bounded Overpass query and returns geometry candidates ordered by area',async()=>{
  let request;
  const adapter=create({
    normalizeName:value=>String(value||'').toLocaleLowerCase('tr-TR'),
    request:async(query,label)=>{request={query,label};return{elements:[
      {type:'way',id:1,tags:{name:'Küçük Park'}},
      {type:'relation',id:2,tags:{name:'Büyük Park'}},
      {type:'way',id:3,tags:{name:'Geometrisiz'}}
    ]};},
    extractRings:element=>element.id===3?null:[[[element.id,0],[0,1]]],
    polyArea:rings=>rings[0][0][0]===1?10:90
  });
  const result=await adapter(39.91,32.85,'Büyük Park');
  assert.equal(request.label,'park adıyla');
  assert.match(request.query,/around:5000,39\.91,32\.85/);
  assert.match(request.query,/way\["leisure"~"park\|garden\|nature_reserve\|common\|recreation_ground"\]/);
  assert.match(request.query,/relation\["leisure"/);
  assert.match(request.query,/landuse/);
  assert.deepEqual(Array.from(result,item=>item.id),[2,1]);
  assert.equal(result[0].area,90);
});

test('empty names, empty results, missing geometry, and Overpass errors return no candidates',async()=>{
  const base={normalizeName:value=>String(value||'').trim(),extractRings:()=>null,polyArea:()=>1};
  const empty=create({...base,request:async()=>{throw Error('must not run');}});
  assert.equal(await empty(39,32,''),null);
  const noResults=create({...base,request:async()=>({elements:[]})});
  assert.equal(await noResults(39,32,'Park'),null);
  const noGeometry=create({...base,request:async()=>({elements:[{type:'way'}]})});
  assert.equal(await noGeometry(39,32,'Park'),null);
  const failed=create({...base,request:async()=>{throw Error('Overpass unavailable');}});
  assert.equal(await failed(39,32,'Park'),null);
});
