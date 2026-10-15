import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const queryPath='src/domain/parks/build-osm-surface-query.js',fetchPath='src/application/parks/fetch-detailed-coverage.js';
function env(paths){const window={},context=vm.createContext({window,Date,Map,AbortController,setTimeout,clearTimeout,encodeURIComponent});for(const path of ['src/adapters/parks/post-overpass-query.js','src/adapters/surface/load-osm-landcover-evidence.js',...paths])vm.runInContext(read(path),context);return window;}
const park=[[[39,32],[39,33],[40,33],[39,32]]],bbox={minLat:39,minLon:32,maxLat:40,maxLon:33};

test('split recovery covers exactly every selector in the full query, including fountains and parking',()=>{
 const w=env([queryPath]),policy=w.DG_OSM_SURFACE_QUERY,b='39,32,40,33';
 const selectors=query=>query.match(/(?:nwr|way)\[[^;]+;/g);
 const full=selectors(policy.build(b)),split=policy.groups.flatMap(group=>selectors(policy.build(b,group)));
 assert.deepEqual([...split],full);assert.ok(full.some(s=>s.includes('fountain')));assert.ok(full.some(s=>s.includes('parking')));assert.ok(full.some(s=>s.includes('building:part')));
});
test('recovery requires all groups and caches only complete same-boundary responses',async()=>{
 const w=env([queryPath,fetchPath]);let calls=0;
 const fetch=w.DG_PARK_COVERAGE_FETCH_APPLICATION.create({getParkPolygon:()=>park,queryOsm:async()=>{calls++;return calls===1?{elements:[],remark:'runtime error: timeout'}:{elements:[{type:'way',id:calls}]};}});
 const result=await fetch();assert.equal(calls,4);assert.equal(result.json.elements.length,3);assert.equal(result.json.complete,true);
 await fetch();assert.equal(calls,4);
});
test('failed recovery group never commits a partial result or poisons later retries',async()=>{
 const w=env([queryPath,fetchPath]);let calls=0;
 const fetch=w.DG_PARK_COVERAGE_FETCH_APPLICATION.create({getParkPolygon:()=>park,queryOsm:async()=>{calls++;if(calls===1||calls===3)return null;return{elements:[{type:'way',id:calls}]};}});
 assert.equal((await fetch()).json,null);assert.equal(calls,3);
 assert.equal((await fetch()).json.elements[0].id,4);
});
test('a complete response with no water/buildings is valid and does not trigger repeated network requests',async()=>{
 const w=env(['src/adapters/surface/load-osm-landcover-evidence.js']);w.DG_SURFACE_OSM={bbox,elements:[],complete:true,fetchedAt:new Date().toISOString()};let calls=0;
 const result=await w.DG_LOAD_OSM_LANDCOVER_EVIDENCE.load(bbox,{boundary:'null',cache:new Map(),overpassRequest:async()=>{calls++;return null;}});
 assert.equal(result,w.DG_SURFACE_OSM);assert.equal(calls,0);
});
test('partial backup is not cached as complete and fresh geometry supersedes an old same-ID seed',async()=>{
 const w=env([queryPath,'src/adapters/surface/load-osm-landcover-evidence.js']),cache=new Map();let calls=0;
 const old={type:'way',id:5,tags:{natural:'water'},geometry:[{lat:39,lon:32}]},fresh={...old,geometry:[{lat:40,lon:33}]};
 const ports={boundary:'null',cache,waterBackup:async()=>({elements:[old]}),overpassRequest:async()=>++calls===1?null:{elements:[fresh]}};
 const first=await w.DG_LOAD_OSM_LANDCOVER_EVIDENCE.load(bbox,ports);assert.equal(first.complete,false);assert.equal(cache.size,0);
 const next=await w.DG_LOAD_OSM_LANDCOVER_EVIDENCE.load(bbox,ports);assert.equal(next.complete,true);assert.equal(next.elements.length,1);assert.equal(next.elements[0].geometry[0].lat,40);assert.equal(calls,2);
});
test('queue plus server timeout fits the detailed client budget while park lookup stays short',()=>{
 const w=env(['src/domain/parks/overpass-request-budget.js']),p=w.DG_OVERPASS_REQUEST_BUDGET;
 assert.equal(p.deadline('park',()=>0),15000);assert.equal(p.deadline('yüzey+su',()=>0),75000);
 assert.equal(p.timeout('yüzey+su',75000,()=>0),40000);assert.ok(p.timeout('yüzey+su',75000,()=>0)>15000+20000);
 assert.equal(p.timeout('yüzey+su',75000,()=>76000),0);
});
test('incomplete OSM evidence blocks acceptance but does not replace raw results or prior accepted snapshots',()=>{
 const w=env(['src/domain/surface/evaluate-surface-acceptance-gate.js','src/adapters/surface/load-surface-water-objects.js']),record={useObjects:true,osmCoverage:{status:'partial'},acceptedResult:{areas:{green:100}}};
 const before=JSON.stringify(record),ports={record,rawView:false,brush:null,busy:false,saving:false,geometry:{},draw:null,unresolvedWater:0};
 assert.match(w.DG_EVALUATE_SURFACE_ACCEPTANCE_GATE.evaluate(ports),/OSM/);assert.equal(JSON.stringify(record),before);
 record.osmCoverage.status='complete';assert.equal(w.DG_EVALUATE_SURFACE_ACCEPTANCE_GATE.evaluate(ports),null);
});
test('empty complete OSM coverage is reported as complete, not as a water-fetch failure',async()=>{
 const w=env(['src/adapters/surface/load-surface-water-objects.js']);let status;
 const result=await w.DG_LOAD_SURFACE_WATER_OBJECTS.load({enabled:true,loadOsmData:async()=>({elements:[],complete:true}),bbox,buildObjects:()=>[],epsg:32636,validFeature:()=>true,isCurrent:()=>true,fromMount:false,isUnavailable:()=>false,onEvidence:evidence=>{status=evidence.status;}});
 assert.equal(status,'complete');assert.equal(result.length,0);
});

test('partial refresh cannot erase previous building/road geometries, while a complete empty refresh clears stale automatic objects',async()=>{
 const w=env(['src/application/surface/apply-auto-surface-water-objects.js']),old=[{type:'building',method:'osm-boundary',osmId:'way/1',geometry:'old'}],record={objectFeatures:old,features:[],osmCoverage:{status:'partial'}};let partitions=0;
 const ports={record,objects:[{type:'water',method:'osm-boundary',osmId:'way/2'}],epoch:1,getEpoch:()=>1,getRecord:()=>record,repartition:async()=>{partitions++;return true;},dirty(){}};
 assert.equal(await w.DG_APPLY_AUTO_SURFACE_WATER_OBJECTS.apply(ports),0);assert.equal(record.objectFeatures,old);assert.equal(partitions,0);
 record.osmCoverage={status:'complete',objectCount:0};ports.objects=[];await w.DG_APPLY_AUTO_SURFACE_WATER_OBJECTS.apply(ports);assert.equal(record.objectFeatures.length,0);assert.equal(partitions,1);assert.equal(record.osmCoverage.changed,true);
});

test('HTTP 200 partial responses retain the actual Overpass error and rotate mirrors without reading an already-used body',async()=>{
 let calls=0,textReads=0;const warnings=[];
 const context=vm.createContext({window:null,Map,Date,Promise,AbortController,setTimeout,clearTimeout,console:{log(){},warn:(...args)=>warnings.push(args.join(' '))},fetch:async()=>({ok:true,status:200,json:async()=>++calls===1?{elements:[],remark:'runtime error: server timeout'}:{elements:[]},text:async()=>{textReads++;throw Error('body already read');}})});context.window=context;
 vm.runInContext(read('src/adapters/parks/post-overpass-query.js'),context);
 vm.runInContext(read('src/domain/parks/overpass-request-budget.js'),context);vm.runInContext(read('src/services/osm-client.js'),context);
 const data=await vm.runInContext('overpassRequest("coverage", "yüzey+su")',context);
 assert.equal(data.elements.length,0);assert.equal(calls,2);assert.equal(textReads,0);assert.ok(warnings.some(message=>message.includes('server timeout')));
});

test('a complete empty response supersedes old partial seeds instead of resurrecting deleted OSM objects',async()=>{
 const w=env([queryPath,'src/adapters/surface/load-osm-landcover-evidence.js']);w.DG_SURFACE_OSM={bbox,elements:[{type:'way',id:5,tags:{building:'yes'}}],complete:false,fetchedAt:new Date().toISOString()};
 const data=await w.DG_LOAD_OSM_LANDCOVER_EVIDENCE.load(bbox,{cache:new Map(),boundary:'null',overpassRequest:async()=>({elements:[]})});
 assert.equal(data.complete,true);assert.equal(data.elements.length,0);
});

test('OSM disclosure remains visible alongside an existing scan completion message',()=>{
 const window=env(['src/ui/surface-osm-evidence-status.js']),element={textContent:''},context=vm.createContext({window,document:{getElementById:()=>element},_tvs:value=>value,DG_SENS:{status:'Tarama tamamlandı.',record:{osmCoverage:{status:'partial'}}}});
 vm.runInContext(read('src/ui/lc-sens.js').match(/^function dgSensUpdateStatus\(\).*$/m)[0],context);
 vm.runInContext('dgSensUpdateStatus()',context);assert.match(element.textContent,/Tarama tamamlandı/);assert.match(element.textContent,/OSM bina, yol ve su verisi eksik/);
});

test('failed geometry application rolls back objects and cannot leave a complete evidence flag',async()=>{
 const w=env(['src/application/surface/apply-auto-surface-water-objects.js']),old=[{type:'building',method:'osm-boundary',osmId:'old',geometry:'old'}],record={objectFeatures:old,features:[],osmCoverage:{status:'complete',objectCount:1}};
 await w.DG_APPLY_AUTO_SURFACE_WATER_OBJECTS.apply({record,objects:[{type:'water',method:'osm-boundary',osmId:'new'}],epoch:1,getEpoch:()=>1,getRecord:()=>record,repartition:async()=>false,dirty:()=>assert.fail('failed geometry must not become a dirty new result')});
 assert.equal(record.objectFeatures,old);assert.equal(record.osmCoverage.status,'unavailable');
});
