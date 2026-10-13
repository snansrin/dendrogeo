import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/measurement-marker-cluster-icon.js',
  'src/ui/create-measurement-map-marker.js',
  'src/adapters/map/ensure-measurement-marker-layer.js',
  'src/application/map/schedule-measurement-marker-chunks.js',
  'src/application/map/add-measurement-markers.js'
];
function setup(paths=modules){const window={};const context=vm.createContext({window,console,setTimeout});for(const path of paths)vm.runInContext(read(path),context,{filename:path});return window;}
function leaflet({clusters=true}={}){const made=[];return{made,divIcon:options=>({kind:'icon',...options}),marker:(coordinates,options)=>{const item={coordinates,options,bindPopup(html){this.popup=html;}};made.push(item);return item;},markerClusterGroup:clusters?options=>({options,items:[],addLayer(item){this.items.push(item);},clearLayers(){this.items=[];}}):undefined,layerGroup:()=>({items:[],addLayer(item){this.items.push(item);},clearLayers(){this.items=[];}})};}

test('cluster icon model keeps the three existing size thresholds and markup',()=>{
  const create=setup().DG_MEASUREMENT_MARKER_CLUSTER_ICON.create,l=leaflet();
  for(const [count,size] of [[1,'small'],[9,'small'],[10,'medium'],[49,'medium'],[50,'large']])assert.equal(create(count,l).className,`marker-cluster marker-cluster-${size}`);
  assert.equal(create(18,l).html,'<div>18</div>');
});

test('marker UI preserves coordinates, green dot style and popup binding',()=>{
  const create=setup().DG_CREATE_MEASUREMENT_MAP_MARKER.create,l=leaflet(),row={lat:39,lon:32};
  const marker=create(row,{leaflet:l,popupHTML:value=>`P${value.wp_id}`});
  assert.deepEqual(JSON.parse(JSON.stringify(marker.coordinates)),[39,32]);
  assert.equal(marker.options.icon.className,'tree-marker');assert.match(marker.options.icon.html,/background:#1e6f4b/);assert.equal(marker.popup,'Pundefined');
});

test('layer adapter keeps cluster settings, clears reused layers and degrades to a plain layer',()=>{
  const ensure=setup().DG_ENSURE_MEASUREMENT_MARKER_LAYER.ensure,events=[],l=leaflet(),map={addLayer:layer=>events.push(['add',layer])};
  ensure(map,{leaflet:l,log:{warn:message=>events.push(['warn',message])},clusterIcon:(count,api)=>api.divIcon({html:String(count)})});
  assert.equal(map._clusterDegraded,false);assert.equal(map._cluster.options.maxClusterRadius,80);assert.equal(map._cluster.options.disableClusteringAtZoom,15);assert.equal(typeof map._cluster.options.iconCreateFunction,'function');assert.equal(events[0][0],'add');
  let cleared=0;map._cluster.clearLayers=()=>cleared++;ensure(map,{leaflet:l,log:console,clusterIcon(){}});assert.equal(cleared,1);assert.equal(events.length,1);
  const plain=leaflet({clusters:false}),fallback={addLayer(layer){this.layer=layer;}};ensure(fallback,{leaflet:plain,log:{warn:message=>events.push(['warn',message])},clusterIcon(){}});assert.equal(fallback._clusterDegraded,true);assert.equal(fallback.layer,fallback._cluster);assert.match(events.at(-1)[1],/noktalar kümelenmeden çiziliyor/);
});

test('chunk scheduler draws in order and cancels a stale token before the next chunk',()=>{
  const schedule=setup().DG_SCHEDULE_MEASUREMENT_MARKER_CHUNKS.schedule,events=[],timers=[],map={_markerToken:4,_cluster:{addLayer:item=>events.push(item)}};
  schedule({map,rows:[1,2,3,4,5],chunk:2,token:4,createMarker:value=>`m${value}`,setTimer:(...args)=>timers.push(args)});
  assert.deepEqual(events,['m1','m2']);assert.equal(timers[0][1],16);map._markerToken=5;timers[0][0]();assert.deepEqual(events,['m1','m2']);
});

test('application prepares the layer before tokenized chunk rendering and keeps module fallback optional',()=>{
  const window=setup(),l=leaflet(),events=[],map={addLayer(layer){events.push(['layer',layer]);}};
  assert.equal(window.DG_ADD_MEASUREMENT_MARKERS.add(map,[{lat:39,lon:32,wp_id:1},{lat:40,lon:33,wp_id:2}],1,{leaflet:l,popupHTML:row=>`P${row.wp_id}`,log:console,setTimer:(fn,ms)=>events.push(['timer',fn,ms])}),true);
  assert.equal(map._markerToken,1);assert.equal(map._cluster.items.length,1);assert.deepEqual(events.map(event=>event[0]),['layer','timer']);
  delete window.DG_ENSURE_MEASUREMENT_MARKER_LAYER;
  assert.equal(window.DG_ADD_MEASUREMENT_MARKERS.add({},[],1,{leaflet:l,popupHTML(){}}),false);
});

test('marker modules are ordered before their UI adapter and cached offline',()=>{
  const head=read('partials/head.html'),sw=read('sw.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/ui/map-measurement-markers.js?'));}
  assert.ok(head.indexOf('src="src/ui/map-measurement-markers.js?')<head.indexOf('src="src/services/map.js?'));
});
