import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const coords=[[[[32.64,39.99],[32.66,39.99],[32.66,40.01],[32.64,40.01],[32.64,39.99]]]];
function verifiedHarness({features=null,withRenderer=true}={}){
 const fills=[],notice=[],requested=[],downloads=[];
 const list=features||[
  {properties:{class:'green'},geometry:{type:'MultiPolygon',coordinates:coords}},
  {properties:{class:'building'},geometry:{type:'MultiPolygon',coordinates:coords}},
  {properties:{class:'other'},geometry:{type:'MultiPolygon',coordinates:coords}}
 ];
 const canvasContext={
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(kind){fills.push({color:this.fillStyle,alpha:this.globalAlpha,kind});},
  fillRect(){},strokeRect(){},stroke(){},setLineDash(){},fillText(){},save(){},restore(){},clip(){},
  arc(){},measureText(){return {width:20};}
 };
 const state={
  record:{acceptedAt:'2026-10-08T11:00:00.000Z',features:[],parkName:'Göksu Parkı',fingerprint:'qa'},
  displayPaths:[],displayFeatures:list,vegetationView:false,editing:false,rawView:false,opacity:65
 };
 const doc={
  getElementById:id=>id==='pngBg'?{value:'sat'}:null,
  addEventListener(){},body:{append(){}},
  createElement:tag=>{
   if(tag==='canvas')return{width:0,height:0,getContext:()=>canvasContext,toBlob:cb=>cb({size:1024})};
   if(tag==='a')return{click(){downloads.push('click');},remove(){},set download(value){downloads.push(value);},set href(v){}};
   throw Error('unhandled '+tag);
  }
 };
 const ctx={
  window:{DG_LC_SENS:{state},DG_SURFACE_REVIEW:{types:{
   green:{label:'Yeşil alan'},building:{label:'Bina'},water:{label:'Su'},other:{label:'Diğer'}
  }}},
  PARK_POLY:[[[39.99,32.64],[39.99,32.66],[40.01,32.66],[40.01,32.64]]],
  PARK_HOLES:[],
  document:doc,URL:{createObjectURL:()=> 'blob:qa',revokeObjectURL(){}},
  dgSensEditSummary:()=>({total:1}),
  dgSensAreas:()=>({green:200000,building:50000,other:1000}),
  dgSensParts:()=>[{key:'test'}],
  dgSensVisualResult:async parts=>{if(withRenderer){requested.push(parts);return{displayFeatures:list};}return{displayFeatures:[]};},
  toast:msg=>notice.push(msg),
  setTimeout,clearTimeout,console,Intl,Math,Date,Promise
 };
 vm.runInNewContext(read('src/ui/gis-export.js'),ctx);
 return{download:(layers={surface:true,park:true,grid:false,waypoints:false})=>ctx.window.DG_GIS_PNG_EXPORT.downloadVerified(layers),
  state,fills,notice,requested,downloads};
}
test('verified map uses all exact surface geometries even when no display polygons are visible',async()=>{
 const h=verifiedHarness();
 const before=JSON.stringify(h.state.displayFeatures);
 assert.equal(await h.download(),true);
 assert.equal(h.requested.length,1,'locked surface display result is read without mutation');
 assert.deepEqual(h.fills.slice(0,3).map(x=>x.color),['#22c55e','#334155','#94a3b8']);
 assert.equal(h.fills[2].alpha,.18,'unclassified residual is visible but neutral');
 assert.equal(h.downloads.filter(x=>x.endsWith('.png')).length,1);
 assert.equal(JSON.stringify(h.state.displayFeatures),before);
});
test('verified map is NOT ordinary PNG export and does not load satellite/OSM/topo tiles',async()=>{
 const h=verifiedHarness();
 assert.equal(await h.download(),true);
 assert.equal(h.downloads.length,2);
 assert.equal(h.requested.length,1);
 assert.doesNotMatch(read('src/ui/gis-export.js').split('async function renderVerified(layers){')[1].split('async function exportVerified(layers){')[0],/paintBaseTiles\(/);
 assert.match(read('src/ui/gis-export.js'),/const basemap=baseChoice\(\)/,'quick PNG retains basemap selection');
});
test('verified map refuses missing geospatial results, rather than exporting a blank map',async()=>{
 const h=verifiedHarness({features:[],withRenderer:false});
 assert.equal(await h.download(),false);
 assert.equal(h.downloads.length,0);
 assert.match(h.notice.join(' '),/geometrisi.*hazır değil|yüzey.*geometri/i);
});
test('unclassified class is not turned into green/hard/water and remains in summary for QA',()=>{
 const ui=read('src/ui/gis-workspace.js'),science=read('src/ui/lc-sens.js');
 assert.match(ui,/label\.textContent="Sınıflandırılamayan"/);
 assert.match(ui,/item\.cls==="other"&&item\.poly\?\.options\?\.fillOpacity!==\.16/);
 assert.match(ui,/item\.poly\.setStyle\?\.\(\{fillOpacity:\.16\}\)/);
 assert.match(science,/const DG_SENS_COLORS=\{green:"#22c55e",water:"#3b82f6",hard:"#64748b",bare:"#8b5a2b",building:"#475569",pool:"#0ea5e9",other:"#94a3b8"\}/);
 assert.doesNotMatch(ui,/\.delete\(other\)|areas\.other\s*=|record\.areas\s*=/);
});
test('continuous drawing bypasses expensive report and NDVI refresh while editing or repartitioning',()=>{
 const ui=read('src/ui/gis-workspace.js');
 assert.match(ui,/if\(state\?\.draw\|\|state\?\.busy\|\|state\?\.saving\|\|state\?\.mergeBusy\)\{\s*syncQuickBoundary\(\);\s*return;/);
 assert.match(ui,/state\.busy\|\|state\.saving\|\|state\.mergeBusy\|\|state\.exporting/);
 assert.doesNotMatch(ui,/dgSensRepartition\(|dgSurfacePrepare\(|dgSensScan\(/);
});
