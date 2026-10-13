import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/find-surface-object-at-point.js','src/domain/surface/create-selected-object-boundary.js','src/ui/surface-object-preview.js','src/application/surface/handle-surface-object-pick.js','src/application/surface/apply-surface-object-boundary.js'];
function setup(){const window={};const context=vm.createContext({window,Date});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('object picker falls back to previously verified polygons during OSM outages',()=>{
  const window=setup(),stored={type:'water',geometry:{type:'MultiPolygon',coordinates:[]},osmId:44},point=window.DG_SURFACE_OBJECT_PICKER.find({latlng:{lat:1,lng:2},elements:[],storedFeatures:[stored],epsg:32631,parkGeometry:['park'],cellGeometry:{},forward:()=>({x:5,y:5}),validFeature:()=>true,featureGeometry:()=>[['polygon']],bounds:()=>[0,0,10,10],pointDistance:()=>0});
  assert.equal(point.geometry,stored.geometry);assert.deepEqual(JSON.parse(JSON.stringify(point)),{type:'water',geometry:stored.geometry,osmId:44});
});

test('object picker ranks containing candidates by area and clips the selected geometry to the park',()=>{
  const window=setup(),calls=[],small={type:'water',geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[1,0],[1,1],[0,0]]]]},osmId:2},large={type:'building',geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[3,0],[3,3],[0,0]]]]},osmId:1};
  const result=window.DG_SURFACE_OBJECT_PICKER.find({latlng:{lat:1,lng:2},elements:[small,large],storedFeatures:[],epsg:32631,parkGeometry:['park'],cellGeometry:{},forward:()=>({x:5,y:5}),project:ring=>ring,unproject:()=>[[[1,2],[3,4],[1,2]]],objects:items=>items,validFeature:()=>true,bounds:()=>[0,0,10,10],pointDistance:()=>0,area:geometry=>geometry[0]?.[0]?.[1]?.[0]===3?100:10,clip:(op,geometry,park)=>{calls.push([op,geometry[0][0][0],park]);return[['clipped']];}});
  assert.equal(result.type,'water');assert.equal(result.osmId,2);assert.deepEqual(calls[0],['intersection',[0,0],['park']]);
});

test('selected boundary keeps the saved visual-boundary source and timestamp fields',()=>{
  const window=setup();assert.deepEqual(JSON.parse(JSON.stringify(window.DG_SELECTED_OBJECT_BOUNDARY.create({type:'water',geometry:{type:'MultiPolygon'},osmId:'way/7',timestamp:'2026-01-01T00:00:00Z'}))),{type:'water',geometry:{type:'MultiPolygon'},method:'visual-boundary',source:'osm-selected',osmId:'way/7',ts:'2026-01-01T00:00:00Z'});
});

test('object pick handler preserves invalid/missing feedback and valid preview sequence',()=>{
  const window=setup(),events=[],common={event:{latlng:{lat:1,lng:2}},picking:true,find:()=>({type:'water',geometry:{},osmId:'x'}),onError:()=> 'error',onMissing:()=> 'missing',removeClick:()=>events.push('off'),setPreview:()=>events.push('preview'),setDrawType:()=>events.push('type'),renderPreview:()=>events.push('layer'),renderTools:()=>events.push('tools'),openBoundaryMenu:()=>events.push('menu'),updateStatus:()=>events.push('status'),toast:(message)=>events.push(message)};
  window.DG_HANDLE_SURFACE_OBJECT_PICK.handle(common);assert.deepEqual(events,['off','preview','type','layer','tools','menu','status']);
  events.length=0;window.DG_HANDLE_SURFACE_OBJECT_PICK.handle({...common,find:()=>null});assert.deepEqual(events,['missing']);
  events.length=0;window.DG_HANDLE_SURFACE_OBJECT_PICK.handle({...common,find:()=>{throw Error('bad geometry');}});assert.deepEqual(events,['error']);
});

test('object preview uses established Leaflet style and removes only its layer',()=>{
  const window=setup(),events=[],layer={id:1},map={removeLayer:value=>events.push(['remove',value])},leaflet={geoJSON:(feature,options)=>{events.push(['render',feature,options]);return{addTo:target=>{assert.equal(target,map);return layer;}};}},result={type:'water',geometry:{type:'MultiPolygon',coordinates:[]}};
  assert.equal(window.DG_SURFACE_OBJECT_PREVIEW.render({map,leaflet,result,colors:{water:'#00f'}}),layer);assert.equal(events[0][2].style.color,'#00f');assert.equal(events[0][2].style.dashArray,'7 5');
  window.DG_SURFACE_OBJECT_PREVIEW.remove({map,layer});assert.deepEqual(events[1],['remove',layer]);
});

test('object apply serializes draft save before water scan and never accepts implicitly',async()=>{
  const window=setup(),events=[],record={features:[]},preview={type:'water',geometry:{},osmId:'relation/9'},ports={preview,rawView:false,busy:false,saving:false,exporting:false,drawType:'water',selectedType:'water',types:{water:{label:'Su'}},record:()=>record,areas:()=>({water:0}),createFeature:args=>({...args,method:'visual-boundary'}),validFeature:()=>true,repartition:async features=>{events.push(['partition',features.length]);return true;},cancelPreview:()=>events.push('cancel'),setDrawType:()=>{},renderTools:()=>{},markDirty:()=>events.push('dirty'),getRecord:()=>record,getAreas:()=>({water:25}),needsWaterScan:()=>true,save:async()=>{events.push('save');return true;},setStatus:value=>events.push(['status',value]),getStatus:()=> 'saved',updateStatus:()=>events.push('update'),toast:message=>events.push(['toast',message]),scan:async()=>{events.push('scan');return true;},translate:value=>value,formatApplied:()=> 'applied',formatNoArea:()=> 'unchanged',formatScanning:()=> 'scanning',formatScanFailed:()=> 'failed',summary:()=>events.push('summary')};
  assert.equal(await window.DG_APPLY_SURFACE_OBJECT_BOUNDARY.apply(ports),true);assert.deepEqual(events.filter(event=>['cancel','dirty','save','scan','summary','update'].includes(event)),['cancel','dirty','save','update','scan','summary','update']);assert.deepEqual(record.features,[]);
  assert.equal(await window.DG_APPLY_SURFACE_OBJECT_BOUNDARY.run({apply:async()=>true,accept:async()=>false,isAccepted:()=>true}),false);
  assert.equal(await window.DG_APPLY_SURFACE_OBJECT_BOUNDARY.run({apply:async()=>true,accept:async()=>true,isAccepted:()=>true}),true);
});

test('five object-review modules are loaded and precached before the locked surface UI',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
  for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}
  assert.match(ui,/DG_SURFACE_OBJECT_PICKER/);assert.match(ui,/DG_SELECTED_OBJECT_BOUNDARY/);assert.match(ui,/DG_SURFACE_OBJECT_PREVIEW/);assert.match(ui,/DG_HANDLE_SURFACE_OBJECT_PICK/);assert.match(ui,/DG_APPLY_SURFACE_OBJECT_BOUNDARY/);
});
