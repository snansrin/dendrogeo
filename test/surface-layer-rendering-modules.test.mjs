import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/domain/surface/build-surface-layer-render-key.js',
 'src/domain/surface/is-surface-layer-render-current.js',
 'src/ui/handle-surface-display-layer-click.js',
 'src/ui/render-surface-display-polygons.js',
 'src/application/surface/refresh-surface-review-layer.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array,WeakMap});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('render key contains epoch, partition, visual and edit state; old jobs fail closed',()=>{
 const w=setup(),state={epoch:2,partitionVersion:4,visualVersion:7,editing:true};const buildKey=w.DG_BUILD_SURFACE_LAYER_RENDER_KEY.build,current=w.DG_IS_SURFACE_LAYER_RENDER_CURRENT.check,key=buildKey(state);
 assert.equal(key,'2:4:7:true');assert.equal(current({state,epoch:2,key,buildKey}),true);assert.equal(current({state:{...state,visualVersion:8},epoch:2,key,buildKey}),false);assert.equal(current({state,epoch:1,key,buildKey}),false);
});

test('display polygon renderer preserves coordinates, style, class paths and click callback',()=>{
 const render=setup().DG_RENDER_SURFACE_DISPLAY_POLYGONS.render,calls=[],handlers=new Map(),state={epoch:3,geometry:{id:1},renderer:{id:'canvas'}};
 const leaflet={polygon:(rings,style)=>{calls.push({rings,style});return{on:(name,handler)=>handlers.set(name,handler),addTo(){}};}};
 const features=[{properties:{class:'water'},geometry:{coordinates:[[[[1,2],[3,4],[5,6]]]]}}];
 const paths=render({features,state,leaflet,colors:{water:'#00f',other:'#aaa'},onClick:(event,epoch,geometry)=>calls.push([event,epoch,geometry])});
 assert.equal(paths.length,1);assert.equal(paths[0].cls,'water');assert.equal(calls[0].style.renderer,state.renderer);assert.equal(calls[0].style.fillColor,'#00f');assert.equal(calls[0].rings[0][0][0][0],2);assert.equal(calls[0].rings[0][0][0][1],1);
 const event={};handlers.get('click')(event);assert.equal(calls[1][0],event);assert.equal(calls[1][1],3);assert.equal(calls[1][2],state.geometry);
});

test('display click dispatch preserves propagation stop, stale guard, object, brush and draw modes',()=>{
 const handle=setup().DG_HANDLE_SURFACE_DISPLAY_LAYER_CLICK.handle,calls=[],state={epsg:32635};const leaflet={DomEvent:{stopPropagation:event=>calls.push('stop')}};
 const common={state,leaflet,epoch:1,geometry:{},isCurrent:()=>true,onObjectPick:()=>calls.push('object'),drawPoint:()=>calls.push('draw'),forward:()=>({x:2,y:3}),parts:()=>[{key:'cell',geom:[]}],bounds:()=>[0,0,5,5],pointDistance:()=>0,popup:key=>calls.push(`popup:${key}`)};
 const event={originalEvent:{},latlng:{lat:1,lng:2}};handle({...common,event});assert.deepEqual(calls,['stop','popup:cell']);
 calls.length=0;handle({...common,event,isCurrent:()=>false});assert.deepEqual(calls,['stop']);
 for(const mode of [{objectPick:true},{brush:{}},{draw:{}}]){calls.length=0;handle({...common,state:{...state,...mode},event});assert.deepEqual(calls,mode.objectPick?['stop','object']:mode.brush?['stop']:['stop','draw']);}
});

test('review refresh initializes layers, merges, renders, applies visibility and refreshes overlays',async()=>{
 const refresh=setup().DG_REFRESH_SURFACE_REVIEW_LAYER.refresh,calls=[],layerItems=new Set(),layer={clearLayers:()=>{calls.push('clear');layerItems.clear();},hasLayer:item=>layerItems.has(item),addItem:item=>layerItems.add(item),removeLayer:item=>{calls.push('hide');layerItems.delete(item);}};
 const path=(cls)=>{const item={setStyle:value=>calls.push(`opacity:${value.fillOpacity}`),addTo:target=>target.addItem(item),cls};return item;};
 const state={record:{},geometry:{id:1},epoch:2,partitionVersion:3,visualVersion:4,editing:false,showCand:true,mergedKey:null,mergeBusy:false,focus:'water',vegetationView:false,opacity:45,displayPaths:[]};
 await refresh({state,map:{},leafletReady:true,createLayer:()=>layer,createRenderer:()=>({}),createPathCache:()=>new WeakMap(),buildKey:s=>[s.epoch,s.partitionVersion,s.visualVersion,s.editing].join(':'),isCurrent:({state:s,epoch,key,buildKey})=>epoch===s.epoch&&key===buildKey(s),parts:()=>['parts'],visualResult:async()=>({features:['merged'],displayFeatures:['display']}),mergeSync:()=>{throw Error('sync fallback should not run');},displaySync:()=>[],renderPolygons:()=>{state.displayPaths=[{poly:path('water'),cls:'water'},{poly:path('green'),cls:'green'}];},renderBoundary:()=>calls.push('boundary'),renderVegetation:()=>calls.push('vegetation'),clearPreview:()=>calls.push('clear-preview'),updateStatus:()=>calls.push('status'),schedule:()=>calls.push('schedule'),refresh:()=>{},onError:error=>calls.push(`error:${error}`),epsg:32635,parkGeometry:{}});
 assert.equal(state.mergedKey,'2:3:4:false');assert.equal(state.mergedFeatures[0],'merged');assert.deepEqual([...layerItems].map(item=>item.cls),['water']);assert.ok(calls.includes('opacity:0.45'));assert.ok(calls.includes('hide'));assert.ok(calls.includes('boundary'));assert.ok(calls.includes('clear-preview'));
});

test('review refresh retries after stale async work and always clears merge-busy state',async()=>{
 const refresh=setup().DG_REFRESH_SURFACE_REVIEW_LAYER.refresh,calls=[],state={record:{},geometry:{},epoch:1,partitionVersion:1,visualVersion:1,editing:true,showCand:true,mergeBusy:false};let resolveJob;
 const pending=new Promise(resolve=>{resolveJob=resolve;}),work=refresh({state,map:{},leafletReady:true,createLayer:()=>({clearLayers(){},hasLayer:()=>true}),createRenderer:()=>({}),createPathCache:()=>new WeakMap(),buildKey:s=>[s.epoch,s.partitionVersion,s.visualVersion,s.editing].join(':'),isCurrent:({state:s,epoch,key,buildKey})=>epoch===s.epoch&&key===buildKey(s),parts:()=>[],visualResult:()=>pending,mergeSync:()=>[],displaySync:()=>[],renderPolygons:()=>calls.push('render'),renderBoundary:()=>{},renderVegetation:()=>{},updateStatus:()=>calls.push('status'),schedule:fn=>calls.push('retry'),refresh:()=>{},onError:error=>calls.push(error),epsg:1,parkGeometry:{}});
 state.visualVersion++;resolveJob({features:[],displayFeatures:[]});await work;assert.equal(state.mergeBusy,false);assert.equal(state.mergedKey,undefined);assert.equal(calls.includes('render'),false);assert.ok(calls.includes('retry'));
});

test('five layer modules load before locked UI, are precached, and service delegates',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 for(const key of ['DG_BUILD_SURFACE_LAYER_RENDER_KEY','DG_IS_SURFACE_LAYER_RENDER_CURRENT','DG_HANDLE_SURFACE_DISPLAY_LAYER_CLICK','DG_RENDER_SURFACE_DISPLAY_POLYGONS','DG_REFRESH_SURFACE_REVIEW_LAYER'])assert.ok(ui.includes(key),key);
});
