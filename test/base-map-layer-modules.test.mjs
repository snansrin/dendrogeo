import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/resolve-base-map-layer.js',
  'src/ui/sync-base-map-layer-selection.js',
  'src/adapters/map/manage-base-map-layers.js',
  'src/adapters/map/create-base-map-layer.js',
  'src/application/map/switch-base-map-layer.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('layer policy keeps all providers, licensing inputs, labels and zoom constraints',()=>{
  const resolve=setup().DG_RESOLVE_BASE_MAP_LAYER.resolve,attribution={osm:'© OSM',sat:'© Esri',topo:'© OpenTopoMap'};
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('osm',attribution))),{url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',label:'Sokak',maxNativeZoom:19,type:'osm',attribution:'© OSM',maxZoom:22,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false});
  assert.equal(resolve('sat',attribution).label,'Uydu');assert.equal(resolve('sat',attribution).maxNativeZoom,19);assert.match(resolve('topo',attribution).url,/opentopomap/);assert.equal(resolve('topo',attribution).maxNativeZoom,17);assert.equal(resolve('invalid',attribution),null);
});

test('selection adapter updates all three controls before the surface base state',()=>{
  const sync=setup().DG_SYNC_BASE_MAP_LAYER_SELECTION.sync,events=[];
  sync({type:'sat',getElement:id=>({id,set value(value){events.push([id,value]);}}),setSurfaceBase:value=>events.push(['surface',value])});
  assert.deepEqual(events,[['baseLayerSelect','sat'],['dgSensBaseSelect','sat'],['dgPendingBaseSelect','sat'],['surface','sat']]);
});

test('map layer adapter detects existing types and removes every prior tile layer only',()=>{
  const layers=setup().DG_MANAGE_BASE_MAP_LAYERS,events=[],mapLayers=[{_dgBase:'sat',_url:'sat'},{_url:'other'},{_dgBase:'osm'}],map={eachLayer:callback=>mapLayers.forEach(callback),removeLayer:layer=>events.push(layer)};
  assert.equal(layers.hasCurrent(map,'sat'),true);assert.equal(layers.hasCurrent(map,'topo'),false);layers.removeTileLayers(map);assert.deepEqual(events,[mapLayers[0],mapLayers[1]]);
});

test('tile adapter preserves Leaflet options and assigns the base type before adding',()=>{
  const create=setup().DG_CREATE_BASE_MAP_LAYER.create,events=[],map={},configuration={type:'topo',url:'tiles',attribution:'license',maxZoom:22,maxNativeZoom:17,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false};
  const layer={addTo:target=>events.push(['add',target,layer._dgBase])},leaflet={tileLayer:(...args)=>{events.push(['tile',...args]);return layer;}};
  assert.equal(create({leaflet,map,configuration}),layer);assert.deepEqual(JSON.parse(JSON.stringify(events)),[['tile','tiles',{attribution:'license',maxZoom:22,maxNativeZoom:17,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false}],['add',map,'topo']]);
});

test('switch use case preserves early exits, selection order, current-layer reuse and toast',()=>{
  const run=setup().DG_SWITCH_BASE_MAP_LAYER.switch,events=[],map={};
  const deps={map,type:'sat',resolve:()=>({label:'Uydu'}),syncSelection:value=>events.push(['sync',value]),hasCurrent:()=>{events.push('check');return true;},removeTileLayers:()=>events.push('remove'),createLayer:()=>events.push('create'),notify:(...args)=>events.push(['notify',...args])};
  run({...deps,map:null});assert.deepEqual(events,[]);
  run({...deps,type:'nope',resolve:()=>null});assert.deepEqual(events,[]);
  run(deps);assert.deepEqual(events,[['sync','sat'],'check']);events.length=0;
  run({...deps,hasCurrent:()=>{events.push('check');return false;}});assert.deepEqual(events,[['sync','sat'],'check','remove','create',['notify','✓ Harita: Uydu','ok','🗺️']]);
});

test('base-layer modules load before the locked map service and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'));}
  assert.match(service,/DG_SWITCH_BASE_MAP_LAYER/);assert.match(service,/configuration\.resolve\(value,DG_ATTR\)/);
});
