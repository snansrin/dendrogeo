import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(paths){const window={};for(const path of paths)vm.runInNewContext(source(path),{window});return window;}
const modules=['src/domain/visitors/summarize-live-visitor-counts.js','src/domain/visitors/build-live-location-trail.js',
 'src/application/visitors/render-owner-live-view.js','src/ui/visitor-map-marker.js','src/ui/visitor-live-panel.js','src/ui/visitor-live-map.js'];

test('live visitor summary counts valid locations only',()=>{
 const api=load(modules).DG_SUMMARIZE_LIVE_VISITOR_COUNTS;
 const rows=[{p:{la:39,lo:32}},{p:{la:0,lo:0}},{p:{la:'bad',lo:32}}];
 assert.deepEqual(JSON.parse(JSON.stringify(api.summarize(rows,p=>p?.la!=null&&p?.lo!=null&&p.la!==0)),null),{online:3,located:2});
});

test('live location trails filter invalid points and cap the newest path',()=>{
 const api=load(modules).DG_BUILD_LIVE_LOCATION_TRAIL,history=Array.from({length:35},(_,i)=>[39+i/1000,32+i/1000,i]);
 history.splice(2,1,['bad',32,2]);
 const result=api.build(history,p=>Number.isFinite(Number(p.la))&&Number.isFinite(Number(p.lo)));
 assert.equal(result.points.length,30);assert.deepEqual(Array.from(result.start),[39.005,32.005]);
 assert.ok(result.points.every(point=>point.length===2&&point.every(Number.isFinite)));
 assert.deepEqual(JSON.parse(JSON.stringify(api.build(null,()=>true))),{points:[],start:null});
});

test('owner live-view application gates access before reads and preserves render order',()=>{
 const api=load(modules).DG_RENDER_OWNER_LIVE_VISITOR_VIEW,events=[];
 const ports={allowed:true,paused:false,hidden:false,view:'visitors',readRows:()=>{events.push('read');return[1,2];},
  filterRows:rows=>{events.push('filter');return rows.slice(0,1);},summarize:rows=>({online:rows.length,located:1}),
  hasLocation:()=>true,updateCounts:counts=>events.push(['counts',counts]),renderPanel:(rows,total)=>events.push(['panel',rows,total]),
  renderFeed:rows=>events.push(['feed',rows]),drawMap:rows=>events.push(['map',rows])};
 assert.equal(api.render({...ports,allowed:false}),null);assert.equal(events.length,0);
 const result=api.render(ports);
 assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['read','filter','counts','panel','feed','map']);
 assert.equal(result.rows[0],1);assert.equal(result.counts.online,2);
});

test('visitor panel updates connection status without requiring a roster element',()=>{
 const api=load(modules).DG_VISITOR_LIVE_PANEL_UI,calls=[];
 api.render({statusElement:{},state:'on',rows:[{id:1}],allCount:2,rosterElement:null,connectionStatus:{render:(...args)=>calls.push(['status',...args])},
  roster:{render:(...args)=>calls.push(['roster',...args])}});
 assert.equal(calls.length,1);assert.equal(calls[0][0],'status');
});

test('visitor live map preserves initialization, trail presentation, and fit behavior',()=>{
 const api=load(modules).DG_VISITOR_LIVE_MAP_UI.create(),events=[];
 const layer={clearLayers(){events.push('clear');}},map={setView(point,zoom){events.push(['view',point,zoom]);return this;},
  invalidateSize(){events.push('invalidate');},fitBounds(bounds,options){events.push(['bounds',bounds,options]);}};
 const add=(kind)=>(coords,options)=>({addTo(target){assert.equal(target,layer);events.push([kind,coords,options]);return this;},
  bindTooltip(html){events.push(['tooltip',html]);}});
 const leaflet={map(){events.push('create-map');return map;},tileLayer(){return{addTo(){events.push('tiles');}};},
  layerGroup(){return{addTo(){events.push('layer');return layer;}};},divIcon:options=>options,marker:add('marker'),
  polyline:add('trail'),circleMarker:add('start'),latLngBounds:coords=>({pad:value=>({coords,value})})};
 const initialized=api.initialize({element:{},map:null,layer:null,leaflet,attribution:'OSM'});
 assert.equal(initialized.map,map);assert.equal(initialized.layer,layer);
 const row={age:10,p:{id:'a',n:'Ada',v:'nav',la:39,lo:32,lh:[[39,32],[40,33],['bad',32]]}};
 const fit=api.draw({map,layer,leaflet,rows:[row],hasLocation:p=>Number.isFinite(Number(p.la))&&Number.isFinite(Number(p.lo)),
  viewLabels:{nav:'Waypoint'},translate:value=>value,escape:String,colorFor:()=> '#123456',trails:true,follow:false,fit:false,
  buildTrail:(history,valid)=>load(modules).DG_BUILD_LIVE_LOCATION_TRAIL.build(history,valid)});
 assert.equal(fit,true);assert.equal(events.filter(event=>Array.isArray(event)&&event[0]==='trail').length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(events.find(event=>Array.isArray(event)&&event[0]==='trail')[1])),[[39,32],[40,33]]);
 assert.equal(events.filter(event=>Array.isArray(event)&&event[0]==='marker').length,1);
});

test('visit service wires all five live-view modules before the service facade',()=>{
 const service=source('src/services/visit-stats.js'),head=source('partials/head.html'),precache=source('sw.js');
 for(const api of ['DG_SUMMARIZE_LIVE_VISITOR_COUNTS','DG_BUILD_LIVE_LOCATION_TRAIL','DG_RENDER_OWNER_LIVE_VISITOR_VIEW','DG_VISITOR_LIVE_PANEL_UI','DG_VISITOR_LIVE_MAP_UI'])assert.match(service,new RegExp(api));
 for(const path of ['src/domain/visitors/summarize-live-visitor-counts.js','src/domain/visitors/build-live-location-trail.js','src/application/visitors/render-owner-live-view.js','src/ui/visitor-live-panel.js','src/ui/visitor-live-map.js']){
  assert.ok(head.indexOf(path)<head.indexOf('src/services/visit-stats.js'));assert.ok(precache.includes('/'+path));
 }
});
