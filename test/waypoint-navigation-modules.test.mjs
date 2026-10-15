import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const modules=[
  '../src/domain/map/build-waypoint-navigation-header.js',
  '../src/ui/render-waypoint-navigation-header.js',
  '../src/ui/waypoint-list.js',
  '../src/ui/select-waypoint.js',
  '../src/ui/waypoint-map-viewport.js',
  '../src/domain/map/resolve-waypoint-guidance.js',
  '../src/ui/waypoint-map-markers.js',
  '../src/domain/map/resolve-waypoint-gps-guidance.js',
  '../src/ui/create-waypoint-gps-location-marker.js',
  '../src/ui/render-waypoint-gps-guidance-readout.js',
  '../src/adapters/map/add-waypoint-guidance-line.js',
  '../src/application/map/render-waypoint-gps-overlay.js',
  '../src/ui/waypoint-gps-overlay.js'
];
function fixture(){
  const elements=new Map(),mapCalls=[],markers=[];
  const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',style:{},open:false});return elements.get(id);};
  const map={
    invalidateSize(){mapCalls.push(['invalidate']);},
    fitBounds(points,options){mapCalls.push(['fit',points,options]);},
    setView(point,zoom){mapCalls.push(['view',point,zoom]);},
    eachLayer(fn){fn({_wp:true});},removeLayer(){mapCalls.push(['remove']);}
  };
  const leaflet={
    divIcon:options=>options,
    marker(point,options){const item={point,options,addTo(target){mapCalls.push(['marker',point]);return this;},bindPopup(html){this.popup=html;return this;},on(name,fn){this[name]=fn;return this;}};markers.push(item);return item;},
    polyline(points,options){return{points,options,addTo(){mapCalls.push(['line',points]);return this;}};}
  };
  const ctx={console:{log(){},warn(){},error(){}},Number,Math,JSON,Object,Array,String,Boolean,Promise,Error,Date,
    setTimeout:fn=>fn(),L:leaflet,$,document:{getElementById:()=>null},
    WP:[{id:1,wp_id:12,lat:40,lon:32,project_id:7,visited:false},{id:2,wp_id:20,lat:40,lon:33,project_id:7,visited:true},{id:3,wp_id:30,lat:41,lon:34,project_id:7,visited:false}],
    navTarget:null,navMap:map,GPS:null,manualPoint:false,hav:(_a,_b,_c,lon)=>lon===32?10:20,brg:()=>90,
    dgCf:value=>value,toast(){},startGps(){},USER:{id:'u'},sb:{from:()=>({update:()=>({eq:async()=>({error:null})})})}};
  ctx.window=ctx;vm.createContext(ctx);
  for(const file of modules)vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),ctx);
  vm.runInContext(readFileSync(new URL('../src/services/map.js',import.meta.url),'utf8'),ctx);
  return{ctx,$,map,mapCalls,markers};
}

test('selection module retains input update, target state, redraw and focus sequence',()=>{
  const {ctx,$,mapCalls}=fixture();
  $('mPoint').value='';
  ctx.selectWaypoint(3);
  assert.equal(ctx.navTarget.wp_id,30);
  assert.equal($('mPoint').value,30);
  assert.ok(mapCalls.some(call=>call[0]==='view'));
});

test('viewport module focuses one target and fits all points with GPS',()=>{
  const {ctx,mapCalls}=fixture();
  ctx.GPS={latitude:40,longitude:31,accuracy:5};
  ctx.navTarget=ctx.WP[0];
  ctx.dgFocusWaypoint(true);
  assert.equal(ctx.$('wpMapPanel').open,true);
  assert.ok(mapCalls.some(call=>call[0]==='invalidate'));
  assert.ok(mapCalls.some(call=>call[0]==='fit'&&call[1].length===2));
  ctx.dgFitWaypoints();
  assert.ok(mapCalls.some(call=>call[0]==='fit'&&call[1].length===4));
});

test('guidance resolver keeps GPS uncertainty and approach thresholds',()=>{
  const {ctx,$}=fixture();
  ctx.navTarget=ctx.WP[0];
  ctx.GPS={latitude:40,longitude:32,accuracy:15};
  ctx.dgWaypointGuidance();
  assert.match($('navGuidance').textContent,/belirsizlik/);
  ctx.GPS.accuracy=5;ctx.hav=()=>25;
  ctx.dgWaypointGuidance();
  assert.match($('navGuidance').textContent,/yaklaştınız/);
});

test('waypoint marker module clears old pins and preserves click selection',()=>{
  const {ctx,mapCalls,markers}=fixture();
  ctx.GPS=null;
  ctx.drawNav();
  assert.ok(mapCalls.some(call=>call[0]==='remove'));
  assert.equal(markers.length,3);
  markers[0].click();
  assert.equal(ctx.navTarget.id,1);
});

test('GPS overlay selects the nearest pending waypoint and draws its bearing line',()=>{
  const {ctx,mapCalls}=fixture();
  ctx.GPS={latitude:40,longitude:32,accuracy:5};
  ctx.navTarget=null;
  ctx.drawNav();
  assert.equal(ctx.navTarget.id,1);
  assert.ok(mapCalls.some(call=>call[0]==='line'));
  assert.match(ctx.$('navDist').textContent,/10 m/);
  assert.match(ctx.$('navTarget').textContent,/P12/);
});

test('all five navigation modules load before map.js and are precached',()=>{
  const head=readFileSync(new URL('../partials/head.html',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const service=head.indexOf('src/services/map.js');
  for(const file of modules){
    const path=file.replace('../','');
    assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);
    assert.ok(worker.includes(`/${path}`),`${path} precache`);
  }
});
