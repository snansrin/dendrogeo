import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/domain/surface/select-surface-object-features.js',
 'src/application/surface/toggle-surface-objects.js',
 'src/application/surface/start-surface-object-pick.js',
 'src/application/surface/cancel-surface-object-pick.js',
 'src/application/surface/apply-and-accept-surface-object-boundary.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('object features preserve raw view, useObjects, and manual boundary ordering',()=>{
 const select=setup().DG_SELECT_SURFACE_OBJECT_FEATURES.select,osm={type:'water'},manual={type:'green'},record={useObjects:true,objectFeatures:[osm],features:[manual]};
 const both=select({rawView:false,record}),manualOnly=select({rawView:false,record:{...record,useObjects:false}});assert.equal(both.length,2);assert.equal(both[0],osm);assert.equal(both[1],manual);assert.equal(manualOnly.length,1);assert.equal(manualOnly[0],manual);assert.equal(select({rawView:true,record}).length,0);
});

test('object toggle preserves guards and repartition-before-save order',async()=>{
 const toggle=setup().DG_TOGGLE_SURFACE_OBJECTS.toggle,calls=[],state={record:{useObjects:true},rawView:false,busy:false,saving:false};
 toggle({state,on:false,dirty:()=>calls.push('dirty'),repartition:()=>{calls.push('partition');return Promise.resolve(true);},save:()=>calls.push('save')});await Promise.resolve();assert.equal(state.record.useObjects,false);assert.deepEqual(calls,['dirty','partition','save']);
 for(const gate of [{rawView:true},{busy:true},{saving:true},{record:null}])toggle({state:{...state,...gate},on:true,dirty:()=>calls.push('blocked'),repartition:()=>Promise.resolve(true),save(){}});assert.equal(calls.includes('blocked'),false);
});

test('object pick requires a current or stored OSM source and starts tools in order',()=>{
 const start=setup().DG_START_SURFACE_OBJECT_PICK.start,calls=[],state={rawView:false,busy:false,saving:false,exporting:false,record:{}};
 const ports={state,data:{boundary:'park'},boundary:'park',hasStored:false,guard:value=>calls.push(`guard:${value}`),stopBrush:()=>calls.push('stop-brush'),cancelDraw:()=>calls.push('cancel-draw'),cancelObject:()=>calls.push('cancel-object'),map:{on:(event,handler)=>calls.push(`on:${event}:${handler.name}`)},onPick:function pick(){},renderTools:()=>calls.push('tools'),updateStatus:()=>calls.push('status'),toast:(message,kind)=>calls.push(`toast:${kind}`),unavailableMessage:'unavailable',promptMessage:'pick'};
 start({...ports,data:{boundary:'stale'}});assert.deepEqual(calls,['toast:warn']);calls.length=0;
 start(ports);assert.equal(state.objectPick,true);assert.equal(state.status,'pick');assert.deepEqual(calls,['stop-brush','cancel-draw','cancel-object','guard:true','on:click:pick','tools','status']);
});

test('object cancellation removes the active listener and preview then clears state',()=>{
 const cancel=setup().DG_CANCEL_SURFACE_OBJECT_PICK.cancel,calls=[],state={objectPick:true,objectPreview:{type:'water'}};
 const layer={};assert.equal(cancel({state,map:{off:(event,handler)=>calls.push(`off:${event}:${handler.name}`)},onPick:function pick(){},preview:{remove:({map:target,layer:targetLayer})=>calls.push(target===null?'remove-without-map':`remove:${targetLayer===layer}`)},layer,removeLayer:()=>calls.push('fallback')}),null);
 assert.deepEqual(calls,['off:click:pick','remove:true']);assert.equal(state.objectPick,false);assert.equal(state.objectPreview,null);
});

test('apply-and-accept stops on failure and verifies the final accepted record',async()=>{
 const run=setup().DG_APPLY_AND_ACCEPT_SURFACE_OBJECT_BOUNDARY.run,calls=[];
 assert.equal(await run({apply:async()=>false,accept:async()=>{calls.push('accept');return true;},isAccepted:()=>true}),false);assert.deepEqual(calls,[]);
 assert.equal(await run({apply:async()=>true,accept:async()=>true,isAccepted:()=>false}),false);assert.equal(await run({apply:async()=>true,accept:async()=>true,isAccepted:()=>true}),true);
});

test('five object lifecycle modules load before locked UI, are precached, and are delegated',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 for(const key of ['DG_SELECT_SURFACE_OBJECT_FEATURES','DG_TOGGLE_SURFACE_OBJECTS','DG_START_SURFACE_OBJECT_PICK','DG_CANCEL_SURFACE_OBJECT_PICK','DG_APPLY_AND_ACCEPT_SURFACE_OBJECT_BOUNDARY'])assert.ok(ui.includes(key),key);
});
