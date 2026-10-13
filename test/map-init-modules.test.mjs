import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/map-initial-view.js',
  'src/adapters/map/create-osm-map.js',
  'src/ui/add-osm-map-layer.js',
  'src/application/map/initialize-map-instance.js',
  'src/application/map/initialize-workspace-maps.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('initial view model keeps each map center and zoom',()=>{
  const resolve=setup().DG_MAP_INITIAL_VIEW.resolve;
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('map'))),{center:[39.99,32.65],zoom:12});
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('navMap'))),{center:[39.992,32.6498],zoom:15});
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('worldMap'))),{center:[39,35],zoom:3});assert.equal(resolve('unknown'),null);
});

test('map adapter creates the Leaflet map and applies its view before returning',()=>{
  const create=setup().DG_CREATE_OSM_MAP.create,events=[],map={setView:(center,zoom)=>{events.push(['view',center,zoom]);return map;}},leaflet={map:container=>{events.push(['map',container]);return map;}};
  assert.equal(create({leaflet,container:'map',center:[1,2],zoom:4}),map);assert.deepEqual(JSON.parse(JSON.stringify(events)),[['map','map'],['view',[1,2],4]]);
});

test('OSM layer keeps the canonical tile URL, attribution and zoom ceiling',()=>{
  const add=setup().DG_ADD_OSM_MAP_LAYER.add,events=[],map={},leaflet={tileLayer:(...args)=>{events.push(['tile',...args]);return{addTo:target=>{events.push(['add',target]);}};}};
  add({leaflet,map,attribution:'© OpenStreetMap'});
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['tile','https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}],['add',map]]);
});

test('instance initializer is idempotent and stores the map before attaching its layer',()=>{
  const initialize=setup().DG_INITIALIZE_MAP_INSTANCE.initialize,events=[],existing={existing:true};
  assert.equal(initialize({getMap:()=>existing,setMap(){events.push('set');},create(){events.push('create');},addLayer(){events.push('layer');}}),existing);assert.deepEqual(events,[]);
  const created={};let stored=null;
  assert.equal(initialize({getMap:()=>stored,setMap:value=>{stored=value;events.push(['set',value]);},create:()=>{events.push('create');return created;},addLayer:value=>events.push(['layer',value])}),created);
  assert.equal(stored,created);assert.deepEqual(JSON.parse(JSON.stringify(events)),['create',['set',{}],['layer',{}]]);
});

test('workspace initializer preserves map, navigation, world order and script wiring',()=>{
  const window=setup(),events=[];
  window.DG_INITIALIZE_WORKSPACE_MAPS.initialize([{name:'map'},{name:'navMap'},{name:'worldMap'}],entry=>events.push(entry.name));
  assert.deepEqual(events,['map','navMap','worldMap']);
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'));}
  assert.match(service,/DG_INITIALIZE_WORKSPACE_MAPS/);assert.match(service,/L\.tileLayer\("https:\/\/\{s\}\.tile\.openstreetmap\.org/);
});
