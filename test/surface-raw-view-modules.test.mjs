import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/is-surface-raw-view-transition-allowed.js','src/domain/surface/capture-surface-edit-view-snapshot.js','src/application/surface/prepare-surface-raw-view-transition.js','src/application/surface/restore-surface-edit-view-cache.js','src/application/surface/switch-surface-raw-view.js'];
function setup(){const window={};const context=vm.createContext({window,Promise});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('raw-view transition gate rejects missing, busy and duplicate requests',()=>{
  const check=setup().DG_IS_SURFACE_RAW_VIEW_TRANSITION_ALLOWED.check,base={record:{},busy:false,saving:false,exporting:false,rawView:false,on:true};assert.equal(check(base),true);assert.equal(check({...base,record:null}),false);assert.equal(check({...base,busy:true}),false);assert.equal(check({...base,saving:true}),false);assert.equal(check({...base,exporting:true}),false);assert.equal(check({...base,rawView:true}),false);
});

test('edit snapshot keeps geometry references and captures its park epoch',()=>{
  const capture=setup().DG_CAPTURE_SURFACE_EDIT_VIEW_SNAPSHOT.capture,geometry={cells:[]},parkGeometry={park:1},visualMemo={promise:Promise.resolve()};const snapshot=capture({record:{id:1},epoch:5,geometry,parkGeometry,partitionVersion:7,visualMemo});assert.equal(snapshot.geometry,geometry);assert.equal(snapshot.parkGeometry,parkGeometry);assert.equal(snapshot.visualMemo,visualMemo);assert.equal(snapshot.partitionVersion,7);
});

test('transition preparation closes tools and resets only transient view state',()=>{
  const prepare=setup().DG_PREPARE_SURFACE_RAW_VIEW_TRANSITION.prepare,events=[],state={record:{},epoch:5,geometry:{},parkGeometry:{},partitionVersion:7,visualMemo:{},visualVersion:2,focus:'water',showCand:false};let snapshot;
  const prepared=prepare({state,on:true,captureSnapshot:()=>snapshot={record:state.record,geometry:state.geometry},stopBrush:()=>events.push('brush'),cancelDraw:()=>events.push('draw'),cancelObject:()=>events.push('object')});assert.equal(prepared,snapshot);assert.equal(state.rawView,true);assert.equal(state.visualVersion,3);assert.equal(state.focus,null);assert.equal(state.showCand,true);assert.deepEqual(events,['brush','draw','object']);
});

test('cache restoration clears stale layers, reuses geometry and restores busy state in order',async()=>{
  const restore=setup().DG_RESTORE_SURFACE_EDIT_VIEW_CACHE.restore,events=[],record={},state={record,epoch:2,busy:false,layer:{},renderer:{},mergedKey:'x',geometry:null};const prepared={geometry:{cells:1},parkGeometry:{park:1},partitionVersion:3,visualMemo:{memo:1}};
  await restore({state,record,epoch:2,prepared,map:{},removeLayer:(map,layer)=>events.push(layer),render:()=>events.push(`render:${state.busy}`),refresh:async()=>events.push('refresh')});assert.deepEqual(events,[{},{},'render:true','refresh','render:false']);assert.equal(state.geometry,prepared.geometry);assert.equal(state.parkGeometry,prepared.parkGeometry);assert.equal(state.busy,false);assert.equal(state.editView,null);
});

test('raw-view switch prepares once and chooses cached restore only for the same park generation',async()=>{
  const window=setup(),events=[],record={},geometry={};const state={record,epoch:4,geometry,parkGeometry:{},partitionVersion:1,visualMemo:{},rawView:false,busy:false,saving:false,exporting:false};
  const input={state,on:true,allowed:window.DG_IS_SURFACE_RAW_VIEW_TRANSITION_ALLOWED.check,captureSnapshot:()=>window.DG_CAPTURE_SURFACE_EDIT_VIEW_SNAPSHOT.capture({record,epoch:4,geometry,parkGeometry:state.parkGeometry,partitionVersion:1,visualMemo:state.visualMemo}),prepareTransition:window.DG_PREPARE_SURFACE_RAW_VIEW_TRANSITION.prepare,canRestore:(snapshot,identity)=>snapshot?.record===identity.record&&snapshot.epoch===identity.epoch,restoreCache:async()=>events.push('restore'),repartition:async()=>events.push('partition'),stopBrush:()=>events.push('brush'),cancelDraw:()=>events.push('draw'),cancelObject:()=>events.push('object'),map:{},removeLayer:()=>{},render:()=>{},refresh:async()=>{},updateSummary:()=>events.push('summary')};
  await window.DG_SWITCH_SURFACE_RAW_VIEW.switch(input);assert.equal(state.rawView,true);assert.deepEqual(events,['brush','draw','object','partition','summary']);
  state.rawView=true;events.length=0;await window.DG_SWITCH_SURFACE_RAW_VIEW.switch({...input,on:false});assert.equal(state.rawView,false);assert.deepEqual(events,['brush','draw','object','restore','summary']);
  state.rawView=true;state.epoch=5;events.length=0;await window.DG_SWITCH_SURFACE_RAW_VIEW.switch({...input,on:false});assert.deepEqual(events,['brush','draw','object','partition','summary']);
});

test('five raw-view modules load and precache before the legacy service',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}for(const name of ['DG_IS_SURFACE_RAW_VIEW_TRANSITION_ALLOWED','DG_CAPTURE_SURFACE_EDIT_VIEW_SNAPSHOT','DG_PREPARE_SURFACE_RAW_VIEW_TRANSITION','DG_RESTORE_SURFACE_EDIT_VIEW_CACHE','DG_SWITCH_SURFACE_RAW_VIEW'])assert.ok(ui.includes(name));
});
