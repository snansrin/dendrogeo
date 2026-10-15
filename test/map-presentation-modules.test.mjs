import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const modules=[
  '../src/domain/map/is-valid-coordinate.js',
  '../src/domain/map/select-waypoint-target.js',
  '../src/domain/map/build-waypoint-navigation-header.js',
  '../src/domain/map/resolve-waypoint-guidance.js',
  '../src/ui/map-measurement-popup.js',
  '../src/ui/map-measurement-markers.js',
  '../src/ui/waypoint-list.js',
  '../src/ui/render-waypoint-navigation-header.js',
  '../src/ui/waypoint-map-markers.js',
  '../src/ui/waypoint-gps-overlay.js'
];
function fixture(){
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',style:{}});return elements.get(id);};
  const children=[],calls={clear:0,create:0};
  const cluster={addLayer:marker=>children.push(marker),clearLayers(){calls.clear++;children.length=0;}};
  const leaflet={
    markerClusterGroup(){calls.create++;return cluster;},layerGroup(){calls.create++;return cluster;},
    divIcon:options=>options,
    marker(latlng,options){return{latlng,options,bindPopup(html){this.popup=html;return this;}};}
  };
  const ctx={console:{log(){},warn(){},error(){}},Number,Math,JSON,Object,Array,String,Boolean,Promise,Error,Date,
    setTimeout:fn=>fn(),L:leaflet,$,document:{getElementById:()=>null},esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),dgT:value=>value,
    dgCf:value=>value,dgTfs:(value,params)=>value.replace(/\{(\w+)\}/g,(_m,key)=>params[key]),
    toast(){},hav:(_a,_b,_c,lon)=>lon===32?10:20,WP:[
      {id:1,wp_id:12,lat:40,lon:32,project_id:7,visited:false},
      {id:2,wp_id:20,lat:40,lon:33,project_id:7,visited:true},
      {id:3,wp_id:30,lat:40,lon:34,project_id:7,visited:false}
    ],GPS:{latitude:40,longitude:32,accuracy:5},navTarget:null,navMap:null,manualPoint:false};
  ctx.window=ctx;vm.createContext(ctx);
  for(const file of modules)vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),ctx);
  vm.runInContext(readFileSync(new URL('../src/services/map.js',import.meta.url),'utf8'),ctx);
  return{ctx,$,children,calls};
}

test('map service delegates coordinate and popup presentation to its modules',()=>{
  const {ctx}=fixture();
  assert.equal(ctx.dgValidCoord(null,32),false);
  assert.equal(ctx.dgValidCoord(0,0),false);
  assert.equal(ctx.dgValidCoord(40,32),true);
  const html=ctx.popupHtml({point_id:4,species:'<Ağaç>',dbh_cm:42.36,height_m:8,carbon_kg:12.5,photo_url:'https://example.org/a.jpg'});
  assert.match(html,/&lt;Ağaç&gt;/);
  assert.match(html,/DBH: 42\.4 cm/);
  assert.match(html,/a\.jpg/);
});

test('map marker module preserves cluster reset and marker creation',()=>{
  const {ctx,children,calls}=fixture();
  const map={_cluster:null,addLayer(){}};
  const rows=[{lat:40,lon:32,point_id:1,species:'Çam',dbh_cm:20,height_m:5,carbon_kg:1},{lat:41,lon:33,point_id:2,species:'Meşe',dbh_cm:30,height_m:6,carbon_kg:2}];
  ctx.addMarkersChunked(map,rows,1);
  assert.equal(children.length,2);
  assert.equal(calls.create,1);
  ctx.addMarkersChunked(map,rows.slice(0,1),1);
  assert.equal(calls.clear,1);
  assert.equal(children.length,1);
});

test('waypoint UI and target modules preserve filtering, ordering, paging and no-write selection',()=>{
  const {ctx,$}=fixture();
  $('nProject').value='7';
  $('wpSearch').value='P30';
  $('wpFilter').value='pending';
  ctx.renderWaypointList();
  assert.match($('wpListTable').innerHTML,/P30/);
  assert.doesNotMatch($('wpListTable').innerHTML,/P12/);
  $('wpSearch').value='';
  ctx.renderWaypointList();
  ctx.dgNextWaypoint();
  assert.equal(ctx.navTarget.wp_id,12);
  ctx.dgNextWaypoint();
  assert.equal(ctx.navTarget.wp_id,30);
  ctx.GPS={latitude:40,longitude:32,accuracy:5};
  ctx.dgNearestWaypoint();
  assert.equal(ctx.navTarget.wp_id,12);
  assert.match($('wpPager').innerHTML,/data-waypoint-action="page"/);
  assert.match($('wpListTable').innerHTML,/data-waypoint-action="select" data-waypoint-id="1"/);
  assert.doesNotMatch($('wpListTable').innerHTML,/onclick=/);
});

test('waypoint list delegation uses the latest injected action callbacks',()=>{
  const {ctx}=fixture(),listeners={};
  const root={addEventListener:(name,listener)=>{listeners[name]=listener;},contains:()=>true};
  let called='';
  ctx.DG_WAYPOINT_LIST_UI.bind(root,{page:control=>{called=control.dataset.pageDelta;}});
  ctx.DG_WAYPOINT_LIST_UI.bind(root,{page:control=>{called='latest-'+control.dataset.pageDelta;}});
  listeners.click({target:{closest:()=>({dataset:{waypointAction:'page',pageDelta:'-1'}})}});
  assert.equal(called,'latest--1');
});

test('waypoint header and guidance presentation stay in UI modules',()=>{
  const {ctx,$}=fixture();
  ctx.GPS=null;
  ctx.drawNav();
  assert.match($('navTarget').textContent,/Listeden veya haritadan hedef seçin/);
  assert.match($('navGps').textContent,/GPS konumu bekleniyor/);
  assert.match($('navGuidance').textContent,/Hedef seçerek navigasyona başlayın/);
});

test('five map modules load before the locked service and are precached',()=>{
  const head=readFileSync(new URL('../partials/head.html',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const service=head.indexOf('src/services/map.js');
  for(const file of modules){
    const path=file.replace('../','');
    assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);
    assert.ok(worker.includes(`/${path}`),`${path} precache`);
  }
});
