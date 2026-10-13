import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const MODULES=[
  'src/domain/parks/normalize-overpass-cache-key.js',
  'src/adapters/parks/coalesce-overpass-requests.js',
  'src/domain/parks/select-overpass-mirrors.js',
  'src/domain/parks/overpass-request-budget.js',
  'src/adapters/parks/overpass-mirror-health.js',
];

test('cache key, request coalescing, mirror selection, budgets and health retain their contracts',async()=>{
  const context=vm.createContext({window:null,Map,Promise});context.window=context;
  for(const path of MODULES)vm.runInContext(read(path),context);
  assert.equal(context.DG_OVERPASS_CACHE_KEY.normalize('  way   [out:json]  '),'way [out:json]');
  const pending=new Map();let calls=0,release;
  const options={keyOf:context.DG_OVERPASS_CACHE_KEY.normalize,pending,run:()=>{calls++;return new Promise(done=>{release=done;});}};
  const first=context.DG_COALESCE_OVERPASS_REQUESTS.request('a   b','park',options);
  assert.equal(context.DG_COALESCE_OVERPASS_REQUESTS.request('a b','detail',options),first);
  assert.equal(calls,1);release(9);assert.equal(await first,9);await Promise.resolve();assert.equal(pending.size,0);
  const health=new Map([['a',{lastOk:8}],['b',{lastOk:0,badUntil:20}]]);
  const urls=context.DG_SELECT_OVERPASS_MIRRORS.select(['a','b','c'],health,10);
  assert.deepEqual(JSON.parse(JSON.stringify(urls)),[{url:'a',index:0,badUntil:0,lastOk:8},{url:'c',index:2,badUntil:0,lastOk:0}]);
  assert.equal(context.DG_OVERPASS_REQUEST_BUDGET.deadline('park',()=>100),15100);
  assert.equal(context.DG_OVERPASS_REQUEST_BUDGET.deadline('yüzey+su',()=>100),20100);
  assert.equal(context.DG_OVERPASS_REQUEST_BUDGET.timeout('park',15100,()=>1000),7500);
  assert.equal(context.DG_OVERPASS_REQUEST_BUDGET.timeout('yüzey+su',20100,()=>12000),8100);
  context.DG_OVERPASS_MIRROR_HEALTH.quarantine(health,'a',8,30000,()=>50);
  assert.deepEqual(JSON.parse(JSON.stringify(health.get('a'))),{lastOk:8,badUntil:30050});
  context.DG_OVERPASS_MIRROR_HEALTH.success(health,'a',()=>70);
  assert.deepEqual(JSON.parse(JSON.stringify(health.get('a'))),{lastOk:70,badUntil:0});
});

test('locked OSM service delegates same-query concurrency and retains response cache',async()=>{
  let calls=0,resolve;
  const context=vm.createContext({
    window:null,Map,Date,Promise,AbortController,setTimeout,clearTimeout,
    console:{log(){},warn(){}},fetch:()=>{calls++;return new Promise(done=>{resolve=done;});},
  });
  context.window=context;
  for(const path of MODULES)vm.runInContext(read(path),context,{filename:path});
  vm.runInContext(read('src/services/osm-client.js'),context,{filename:'src/services/osm-client.js'});
  const first=vm.runInContext('overpassRequest("park   query","park")',context);
  const second=vm.runInContext('overpassRequest("park query","OSM")',context);
  assert.equal(first,second);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
  resolve({ok:true,status:200,json:async()=>({elements:[{id:1}]})});
  const data=await first;assert.equal(data.elements[0].id,1);
  assert.equal(await vm.runInContext('overpassRequest("park query","park")',context),data);
  assert.equal(calls,1);
});

test('all five OSM modules load before osm-client and are precached',()=>{
  const head=read('partials/head.html');const sw=read('sw.js');
  const service=head.indexOf('src/services/osm-client.js');
  const core=sw.slice(sw.indexOf('const CORE_ASSETS'),sw.indexOf('];',sw.indexOf('const CORE_ASSETS')));
  for(const path of MODULES){
    assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} must load before the service`);
    assert.ok(core.includes(`/${path}`),`${path} must be in the service-worker cache`);
  }
});
