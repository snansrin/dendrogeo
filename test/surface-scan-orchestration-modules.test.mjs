import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/adapters/surface/load-surface-water-objects.js','src/application/surface/apply-auto-surface-water-objects.js','src/domain/surface/build-surface-scan-summary.js','src/application/surface/complete-surface-scan.js','src/application/surface/run-surface-scan.js'];
function setup(){const window={};const context=vm.createContext({window,Promise,JSON,Set});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('water adapter observes OSM/data/park gates and filters valid footprints',async()=>{
  const load=setup().DG_LOAD_SURFACE_WATER_OBJECTS.load,features=[{type:'building',osmId:1},{type:'hard',osmId:2},{type:'water',osmId:3},{type:'pool',osmId:4},{type:'green',osmId:5}];let requests=0;
  const args={enabled:true,loadOsmData:async()=>{requests++;return{elements:[1]};},bbox:[0,0,1,1],buildObjects:()=>features,epsg:32636,validFeature:feature=>feature.osmId!==5,isCurrent:()=>true,fromMount:false,isUnavailable:()=>false};
  assert.deepEqual(JSON.parse(JSON.stringify(await load(args))),features.slice(0,4));assert.equal(requests,1);assert.equal(JSON.stringify(await load({...args,isCurrent:()=>false})),'[]');assert.equal(JSON.stringify(await load({...args,enabled:false})),'[]');
});

test('auto water apply replaces existing masks, preserves selected records and rolls back failed partition',async()=>{
  const apply=setup().DG_APPLY_AUTO_SURFACE_WATER_OBJECTS.apply,record={objectFeatures:[{type:'water',osmId:'old'},{type:'building',osmId:'b'}],features:[{type:'water',method:'visual-boundary',source:'osm-selected',osmId:'new'},{type:'building',method:'visual-boundary'}]},objects=[{type:'water',osmId:'new',geometry:{}}],before=record.objectFeatures;
  assert.equal(await apply({record,objects,epoch:1,getEpoch:()=>1,getRecord:()=>record,repartition:async features=>{assert.equal(features.length,1);return false;},dirty:()=>{}}),0);assert.equal(record.objectFeatures,before);assert.equal(record.features.length,2);
  let dirty=0;assert.equal(await apply({record,objects,epoch:1,getEpoch:()=>1,getRecord:()=>record,repartition:async features=>{record.features=features;return true;},dirty:()=>dirty++}),1);assert.equal(record.objectFeatures.at(-1),objects[0]);assert.equal(record.features.length,1);assert.equal(dirty,1);
});

test('scan summary includes counts, auto-water note and unresolved-boundary warning',()=>{
  const build=setup().DG_BUILD_SURFACE_SCAN_SUMMARY.build,status=build({audit:{profiled:3,total:4,transitions:[{cells:1},{cells:2}]},autoWater:2,hasWaterFootprint:true,unresolvedWater:1,format:(template,values)=>template.replace('{profiled}',values.profiled).replace('{total}',values.total).replace('{diff}',values.diff)});
  assert.match(status,/3\/4/);assert.match(status,/3 hücrede sınıf farkı/);assert.match(status,/2 nesne/);assert.match(status,/Su sınırı dışında 1 hücre belirsiz/);
});

test('successful scan completion commits profile before refresh, summary and save',async()=>{
  const window=setup(),events=[],record={spectralEnabled:true},state={vegetationRenderKey:'old',status:''};const audit=await window.DG_COMPLETE_SURFACE_SCAN.complete({state,record,profile:{cells:{a:{}}},autoWater:2,scanAudit:()=>({profiled:1,total:1,transitions:[]}),hasWaterFootprint:()=>false,unresolvedWater:()=>0,buildSummary:()=> 'done',timestamp:()=> 'now',dirty:()=>events.push('dirty'),refreshLayer:()=>events.push('refresh'),updateSummary:()=>events.push('summary'),save:async()=>events.push('save')});
  assert.equal(record.profile.cells.a!==undefined,true);assert.equal(record.spectralEnabled,false);assert.equal(record.scannedAt,'now');assert.equal(state.vegetationRenderKey,null);assert.equal(state.status,'done');assert.deepEqual(events,['dirty','refresh','summary','save']);assert.equal(audit.profiled,1);
});

test('scan runner keeps the neutral reset, stale guard and guaranteed busy cleanup',async()=>{
  const run=setup().DG_RUN_SURFACE_SCAN.run,events=[],record={period:'latest'},state={record,epoch:4,rawView:false,busy:false,saving:false,visualVersion:2,focus:'water'};let completed=false;
  const result=await run({state,canRun:()=>true,stopBrush:()=>events.push('stop-brush'),resetScanState:rec=>{rec.profile=null;rec.period='ytd';},render:()=>events.push(`render:${state.busy}`),loadProfile:async()=>({cells:{}}),isCurrent:()=>true,autoWater:async()=>1,complete:async()=>{completed=true;events.push('complete');},translate:value=>value,toast:()=>{},refreshLayer:()=>events.push('refresh')});
  assert.equal(result,true);assert.equal(completed,true);assert.equal(state.busy,false);assert.equal(state.visualVersion,3);assert.equal(state.focus,null);assert.deepEqual(events,['stop-brush','render:true','complete','render:false','refresh']);
});

test('late scan cannot finalize a different park and failures report before cleanup',async()=>{
  const run=setup().DG_RUN_SURFACE_SCAN.run,record={},state={record,epoch:1,rawView:false,busy:false,saving:false};let completed=0;
  assert.equal(await run({state,canRun:()=>true,stopBrush:()=>{},resetScanState:()=>{},render:()=>{},loadProfile:async()=>{state.epoch++;return{};},isCurrent:()=>false,autoWater:async()=>0,complete:async()=>completed++,translate:value=>value,toast:()=>{},refreshLayer:()=>{}}),undefined);assert.equal(completed,0);
  state.epoch=2;const events=[];const result=await run({state,canRun:()=>true,stopBrush:()=>{},resetScanState:()=>{},render:()=>{},loadProfile:async()=>{throw Error('offline');},isCurrent:()=>true,autoWater:async()=>0,complete:async()=>{},translate:value=>value,toast:message=>events.push(message),refreshLayer:()=>events.push('refresh')});
  assert.equal(result,false);assert.equal(state.busy,false);assert.match(state.status,/Tarama başarısız: offline/);assert.deepEqual(events,['Tarama başarısız: offline','refresh']);
});

test('five scan modules load before the legacy service and are precached',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}for(const name of ['DG_LOAD_SURFACE_WATER_OBJECTS','DG_APPLY_AUTO_SURFACE_WATER_OBJECTS','DG_BUILD_SURFACE_SCAN_SUMMARY','DG_COMPLETE_SURFACE_SCAN','DG_RUN_SURFACE_SCAN'])assert.ok(ui.includes(name));
});
