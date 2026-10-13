import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/domain/surface/build-surface-repartition-input.js',
 'src/domain/surface/is-surface-repartition-current.js',
 'src/application/surface/commit-surface-repartition-result.js',
 'src/adapters/surface/clear-surface-review-layers.js',
 'src/application/surface/repartition-surface-review.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array,Map});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('repartition input keeps park-scoped OSM evidence and raw-view gates',()=>{
 const build=setup().DG_BUILD_SURFACE_REPARTITION_INPUT.build,cells=[],outer=[],holes=[],objects=[],elements=[],features=[];
 const input=build({cells,outer,holes,epsg:32635,objects,elements,elementsBoundary:'park-a',parkBoundary:'park-a',features,rawView:false,useObjects:true});
 assert.equal(input.cells,cells);assert.equal(input.outer,outer);assert.equal(input.objects,objects);assert.equal(input.elements,elements);assert.equal(input.features,features);assert.equal(input.useObjects,true);
 const raw=build({cells,outer,holes,epsg:32635,objects,elements,elementsBoundary:'park-b',parkBoundary:'park-a',features,rawView:true,useObjects:true});assert.equal(raw.elements.length,0);assert.equal(raw.features.length,0);assert.equal(raw.useObjects,false);
});

test('partition epoch gate rejects stale geometry results',()=>{
 const check=setup().DG_IS_SURFACE_REPARTITION_CURRENT.check;assert.equal(check({epoch:4,currentEpoch:4}),true);assert.equal(check({epoch:4,currentEpoch:5}),false);
});

test('commit preserves staged boundaries, object version, brush migration and cell identity',()=>{
 const commit=setup().DG_COMMIT_SURFACE_REPARTITION_RESULT.commit,calls=[],cell={row:1,col:2},record={features:[],objectFeatures:null},state={partitionVersion:2,visualVersion:0,vegetationLayer:{clearLayers:()=>calls.push('vegetation-clear')},geometry:null};
 const data={objects:[{type:'water'}],park:{id:'park'},geometries:{'1:2':[]},parts:[{key:'1:2'}]},override=[{type:'green'}];
 commit({state,record,featureOverride:override,data,cells:[cell],epsg:32635,migrateBrushMasks:()=>true,resolveParts:(cells,effective,geometries,features,epsg,park)=>{calls.push(['resolve',features.length]);return data.parts;},effective:()=>{},features:()=>record.features,cellKey:value=>`${value.row}:${value.col}`,seed:(...args)=>calls.push(['seed',args[3]===data.park,args[4][0].cell===cell]),clearLayers:()=>calls.push('layers-clear'),map:{}});
 assert.equal(record.features,override);assert.equal(record.objectVersion,'footprints-v4-road-widths');assert.equal(record.draftDirty,true);assert.equal(state.editing,true);assert.equal(state.visualVersion,1);assert.equal(state.partitionVersion,3);assert.equal(data.parts[0].cell,cell);assert.equal(state.partsMemo,null);assert.equal(state.visualMemo,null);assert.deepEqual(calls,['vegetation-clear',['resolve',1],['seed',true,true],'layers-clear']);
});

test('layer cleanup removes all active Leaflet layers and resets references',()=>{
 const clear=setup().DG_CLEAR_SURFACE_REVIEW_LAYERS.clear,calls=[],state={layer:{id:'fill'},boundaryLayer:{id:'boundary'},boundaryKey:'key',renderer:{id:'canvas'}};
 clear({state,map:{removeLayer:layer=>calls.push(layer.id)}});assert.deepEqual(calls,['fill','boundary','canvas']);assert.equal(state.layer,null);assert.equal(state.boundaryLayer,null);assert.equal(state.boundaryKey,null);assert.equal(state.renderer,null);
});

test('repartition prepares before commit and retains finally cleanup order',async()=>{
 const repartition=setup().DG_REPARTITION_SURFACE_REVIEW.repartition,calls=[],state={record:{id:1},epoch:2,busy:false};
 const result=await repartition({state,featureOverride:null,buildInput:()=>{calls.push('build');return{cells:[]};},prepare:async()=>{calls.push('prepare');return{};},isCurrent:()=>true,commit:()=>calls.push('commit'),render:()=>calls.push(`render:${state.busy}`),refresh:()=>calls.push('refresh'),onError:error=>calls.push(error)});
 assert.equal(result,true);assert.deepEqual(calls,['render:true','build','prepare','commit','render:false','refresh']);
});

test('failed or stale repartition does not commit and preserves epoch-owned cleanup',async()=>{
 const repartition=setup().DG_REPARTITION_SURFACE_REVIEW.repartition;
 const failedState={record:{},epoch:1,busy:false},failure=[];const failed=await repartition({state:failedState,buildInput:()=>({}),prepare:async()=>{throw Error('clip failed');},isCurrent:()=>true,commit:()=>failure.push('commit'),render:()=>failure.push(`render:${failedState.busy}`),refresh:()=>failure.push('refresh'),onError:error=>failure.push(error.message)});
 assert.equal(failed,false);assert.deepEqual(failure,['render:true','clip failed','render:false','refresh']);
 const staleState={record:{},epoch:1,busy:false},stale=[];const result=await repartition({state:staleState,buildInput:()=>({}),prepare:async()=>{staleState.epoch++;return{};},isCurrent:()=>false,commit:()=>stale.push('commit'),render:()=>stale.push('render'),refresh:()=>stale.push('refresh'),onError:()=>stale.push('error')});
 assert.equal(result,false);assert.deepEqual(stale,['render']);assert.equal(staleState.busy,true);
});

test('five repartition modules load before locked UI, are precached, and service delegates',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 for(const key of ['DG_BUILD_SURFACE_REPARTITION_INPUT','DG_IS_SURFACE_REPARTITION_CURRENT','DG_COMMIT_SURFACE_REPARTITION_RESULT','DG_CLEAR_SURFACE_REVIEW_LAYERS','DG_REPARTITION_SURFACE_REVIEW'])assert.ok(ui.includes(key),key);
});
