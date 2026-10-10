import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/application/parks/find-park-candidates.js',import.meta.url),'utf8');
function create(overrides={}){
  const calls={queries:[],fallbacks:[]};
  const context=vm.createContext({window:{}});
  vm.runInContext(source,context);
  const search=context.window.DG_PARK_CANDIDATE_SEARCH_APPLICATION.create({
    queryOsm:async query=>{calls.queries.push(query);return{elements:[]};},
    boundaryFallback:async(...args)=>{calls.fallbacks.push(args);return[];},
    extractRings:element=>element.rings,
    areaOf:rings=>rings.area,
    containsPoint:(lat,lon,rings)=>rings.contains===true,
    ...overrides
  });
  return{search,calls};
}

test('Overpass query preserves radius and the two supported OSM element types',async()=>{
  const{search,calls}=create();
  assert.equal((await search(39.91,32.8,1750)).length,0);
  assert.equal(calls.queries.length,1);
  assert.match(calls.queries[0],/\[timeout:35\]/);
  assert.match(calls.queries[0],/way\["leisure"/);
  assert.match(calls.queries[0],/relation\["leisure"/);
  assert.match(calls.queries[0],/around:1750,39\.91,32\.8/);
  assert.equal(calls.fallbacks.length,0);
});

test('empty successful OSM response means no candidates and does not call boundary fallback',async()=>{
  const{search,calls}=create({queryOsm:async()=>({elements:[]})});
  assert.equal((await search(39,32)).length,0);
  assert.equal(calls.fallbacks.length,0);
});

test('missing or remarked OSM data uses boundary fallback, then preserves the connection error',async()=>{
  const fallback=[{id:8,boundaryProvider:'nominatim'}];
  const fallbackCalls=[];
  const ok=create({queryOsm:async()=>null,boundaryFallback:async(...args)=>{fallbackCalls.push(args);return fallback;}});
  assert.deepEqual(await ok.search(39,32,900),fallback);
  assert.deepEqual(fallbackCalls,[[39,32,900]]);

  const failed=create({queryOsm:async()=>({remark:'timeout',elements:[]}),boundaryFallback:async()=>[]});
  await assert.rejects(failed.search(39,32),/bağlantı hatası parkın bulunmadığı anlamına gelmez/i);
});

test('valid candidates inside the point rank by area and retain legacy fields',async()=>{
  const data={elements:[
    {type:'way',id:1,tags:{name:'Büyük Park'},rings:{area:900,contains:true,outer:[[[1,2],[2,3],[3,4],[1,2]]]}},
    {type:'relation',id:2,tags:{name:'Küçük Park'},rings:{area:100,contains:true,outer:[[[1,2],[2,3],[3,4],[1,2]]]}},
    {type:'way',id:3,tags:{name:'Uzak Park'},rings:{area:5,contains:false,outer:[[[1,2],[2,3],[3,4],[1,2]]]}},
    {type:'way',id:4,tags:{name:'Bozuk halka'},rings:{area:1,points:[],outer:[[[1,2],[2,3],[3,4]]]}}
  ]};
  const{search}=create({queryOsm:async()=>data,extractRings:e=>e.rings,areaOf:r=>r.area,containsPoint:(lat,lon,r)=>r.contains});
  const results=await search(39,32);
  assert.deepEqual(Array.from(results,x=>x.id),[2,1]);
  assert.equal(results[0].name,'Küçük Park');
  assert.equal(results[0].type,'relation');
  assert.equal(results[0].area,100);
});

test('when none contains the requested point, valid candidates still rank by area',async()=>{
  const data={elements:[
    {id:1,type:'way',rings:{area:900,outer:[[[1,2],[2,3],[3,4],[1,2]]]}},
    {id:2,type:'way',rings:{area:100,outer:[[[1,2],[2,3],[3,4],[1,2]]]}}
  ]};
  const{search}=create({queryOsm:async()=>data,extractRings:e=>e.rings,areaOf:r=>r.area,containsPoint:()=>false});
  assert.deepEqual(Array.from(await search(39,32),x=>x.id),[2,1]);
});

test('missing and invalid geometries retain distinct actionable errors',async()=>{
  const missing=create({queryOsm:async()=>({elements:[{}]}),extractRings:()=>null});
  await assert.rejects(missing.search(39,32),/geometrisi eksik/);
  const invalid=create({queryOsm:async()=>({elements:[{}]}),extractRings:()=>({outer:[[[1,2],[3,4],[5,6]]]}),areaOf:()=>1});
  await assert.rejects(invalid.search(39,32),/geometrisi geçersiz/);
});
