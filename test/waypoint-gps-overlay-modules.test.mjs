import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/resolve-waypoint-gps-guidance.js',
  'src/ui/create-waypoint-gps-location-marker.js',
  'src/ui/render-waypoint-gps-guidance-readout.js',
  'src/adapters/map/add-waypoint-guidance-line.js',
  'src/application/map/render-waypoint-gps-overlay.js'
];
function setup(paths=[...modules,'src/ui/waypoint-gps-overlay.js']){const window={};const context=vm.createContext({window});for(const path of paths)vm.runInContext(read(path),context,{filename:path});return window;}
function api(){const events=[];return{events,leaflet:{marker:(coordinates,options)=>({addTo(map){events.push(['marker',coordinates,options,map]);return this;}}),divIcon:options=>options,polyline:(coordinates,options)=>({addTo(map){events.push(['line',coordinates,options,map]);return this;}})}};}

test('domain guidance chooses the nearest pending point, keeps tie order and reports distance/bearing',()=>{
  const resolve=setup().DG_RESOLVE_WAYPOINT_GPS_GUIDANCE.resolve,gps={latitude:1,longitude:1};
  const waypoints=[{id:1,wp_id:1,lat:2,lon:1},{id:2,wp_id:2,lat:0,lon:1},{id:3,wp_id:3,lat:1,lon:1,visited:true}];
  const result=resolve({waypoints,target:null,gps,distance:(_a,_b,lat)=>Math.abs(lat-1),bearing:(_a,_b,lat)=>lat*10});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{target:waypoints[0],meters:1,targetBearing:20});
  assert.equal(resolve({waypoints,target:waypoints[2],gps,distance:()=>0,bearing:()=>0}).target,waypoints[2]);
});

test('location marker keeps its initial-target-only arrow and original Leaflet styling',()=>{
  const add=setup().DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER.add,{events,leaflet}=api(),map={},gps={latitude:39,longitude:32},target={lat:40,lon:33};
  add({map,gps,target,leaflet,bearing:()=>70});
  const marker=events[0];assert.equal(marker[0],'marker');assert.deepEqual(JSON.parse(JSON.stringify(marker[1])),[39,32]);
  assert.match(marker[2].icon.html,/rotate\(70deg\)/);assert.equal(marker[2].icon.iconSize[0],48);assert.equal(marker[2].zIndexOffset,1000);
  events.length=0;add({map,gps,target:null,leaflet,bearing:()=>70});assert.doesNotMatch(events[0][2].icon.html,/nav-arrow-svg/);
});

test('readout preserves translated target, distance and reset states',()=>{
  const render=setup().DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT.render,els={navDist:{},navTarget:{},navArrow:{style:{}}},getElement=id=>els[id];
  render({target:{wp_id:7},meters:49.6,targetBearing:123.4,getElement,translate:value=>`EN:${value}`});
  assert.equal(els.navDist.textContent,'50 m');assert.equal(els.navTarget.textContent,'EN:Hedef: P7 · 123° · EN:Pusula bekleniyor; konumu ve haritayı izleyin.');assert.equal(els.navArrow.style.visibility,'hidden');
  render({target:null,meters:null,targetBearing:null,getElement,translate:value=>`EN:${value}`});
  assert.equal(els.navDist.textContent,'—');assert.equal(els.navTarget.textContent,'EN:Hedef seç / tamamlandı');assert.equal(els.navArrow.style.transform,'rotate(0)');
});

test('guidance adapter adds the existing dashed line and marks it as a waypoint layer',()=>{
  const add=setup().DG_ADD_WAYPOINT_GUIDANCE_LINE.add,{events,leaflet}=api(),map={},gps={latitude:39,longitude:32},target={lat:40,lon:33};
  const line=add({map,gps,target,leaflet});assert.equal(line._wp,1);assert.deepEqual(JSON.parse(JSON.stringify(events[0])),['line',[[39,32],[40,33]],{color:'#c2452d',dashArray:'5,8',weight:2},map]);
});

test('application draws current location first, then selects target and renders guidance',()=>{
  const window=setup(),render=window.DG_RENDER_WAYPOINT_GPS_OVERLAY.render,{events,leaflet}=api();let selected=null;
  const target={id:1,wp_id:1,lat:2,lon:1},waypoints=[target,{id:2,wp_id:2,lat:0,lon:1}],gps={latitude:1,longitude:1},els={navDist:{},navTarget:{},navArrow:{style:{}}};
  const result=render({map:{},waypoints,target:null,gps,leaflet,distance:(_a,_b,lat)=>Math.abs(lat-1),bearing:(_a,_b,lat)=>lat*10,getElement:id=>els[id],translate:value=>value,setTarget:value=>{selected=value;},createLocationMarker:window.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER,renderReadout:window.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT,addGuidanceLine:window.DG_ADD_WAYPOINT_GUIDANCE_LINE});
  assert.equal(result,target);assert.equal(selected,target);assert.equal(events[0][0],'marker');assert.equal(events[1][0],'line');assert.equal(els.navDist.textContent,'1 m');assert.equal(els.navTarget.textContent,'Hedef: P1 · 20° · Pusula bekleniyor; konumu ve haritayı izleyin.');
  assert.doesNotMatch(events[0][2].icon.html,/nav-arrow-svg/); // target was selected after the location marker, as before
});

test('overlay adapter retains its local fallback and modules load before it and are precached',()=>{
  const fallback=setup(['src/ui/waypoint-gps-overlay.js']),events=[],map={};let target=null;
  const leaflet={marker:(coords,options)=>({addTo(){events.push(['marker',coords,options]);return this;}}),divIcon:options=>options,polyline:(coords,options)=>({addTo(){events.push(['line',coords,options]);return this;}})};
  const result=fallback.DG_WAYPOINT_GPS_OVERLAY.draw({map,waypoints:[{id:1,wp_id:1,lat:2,lon:1}],target,gps:{latitude:1,longitude:1},leaflet,distance:(_a,_b,lat)=>Math.abs(lat-1),bearing:()=>25,getElement:()=>({style:{}}),translate:value=>value,setTarget:value=>{target=value;}});
  assert.equal(result,target);assert.equal(events[0][0],'marker');assert.equal(events[1][0],'line');
  const head=read('partials/head.html'),sw=read('sw.js');for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/ui/waypoint-gps-overlay.js?'));}
});
