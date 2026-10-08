import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function imageExport(mode,{fail=false}={}){
 const tiles=[],operations=[],downloads=[],messages=[];
 const controls={pngBg:{value:mode},chkPngCover:{checked:true},chkPngGrid:{checked:false},chkPngWp:{checked:false}};
 const polygon=[[[39.98,32.63],[39.98,32.66],[40.01,32.66],[40.01,32.63]]];
 const context2d={
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){operations.push('fill');},
  fillRect(){},strokeRect(){},stroke(){},setLineDash(){},fillText(){},arc(){},save(){},restore(){},clip(){},
  measureText:()=>({width:20}),drawImage(img,x,y,w,h){operations.push('tile');assert.ok(w>0&&h>0);assert.equal(img.crossOrigin,'anonymous');},
  getImageData:()=>({data:new Uint8Array(4)})
 };
 class FakeImage{
  naturalWidth=256;
  set src(url){
   tiles.push({url,crossOrigin:this.crossOrigin});
   queueMicrotask(()=>fail?this.onerror?.():this.onload?.());
  }
 }
 const browser={
  window:{DG_LC_SENS:{state:{vegetationView:false,rawView:false,displayPaths:[],opacity:65}},DG_LANDCOVER:{
   getLast:()=>({report:{patches:[{group:'water',rings:[[[39.98,32.63],[39.98,32.66],[40.01,32.66],[40.01,32.63]]]}]}})
  }},
  Image:FakeImage,
  PARK_POLY:polygon,PARK_HOLES:[],GRID_CELLS:[],WP:[],DG_PARK:{name:'Göksu Parkı'},
  document:{getElementById:id=>controls[id]||null,body:{append(){}},createElement:tag=>{
   if(tag==='canvas')return{width:0,height:0,getContext:()=>context2d,toBlob:cb=>cb({size:100})};
   if(tag==='a')return{click(){downloads.push('clicked');},remove(){},set href(_value){},set download(value){downloads.push(value);}};
   throw Error('Unexpected '+tag);
  }},
  toast:(message,type)=>messages.push({message,type}),
  URL:{createObjectURL:()=> 'blob:fake',revokeObjectURL(){}},
  console,Date,Math,Promise,Intl,setTimeout,clearTimeout,queueMicrotask
 };
 vm.runInNewContext(load('src/ui/gis-export.js'),browser);
 return{exportMap:()=>browser.window.downloadParkImage(),tool:browser.window.DG_GIS_PNG_EXPORT,tiles,operations,downloads,messages};
}

test('OSM, Esri satellite and OpenTopoMap selections paint actual projected tiles BEFORE analysis vectors',async()=>{
 for(const [mode,pattern] of [
  ['osm',/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/],
  ['sat',/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/\d+\/\d+\/\d+/],
  ['topo',/tile\.opentopomap\.org\/\d+\/\d+\/\d+\.png/]
 ]){
  const f=imageExport(mode);
  assert.equal(await f.exportMap(),true,mode);
  assert.ok(f.tiles.length>0&&f.tiles.length<=48,mode+' tile cap');
  assert.match(f.tiles[0].url,pattern);
  assert.equal(f.tiles[0].crossOrigin,'anonymous');
  assert.ok(f.operations.indexOf('tile')>=0&&f.operations.indexOf('tile')<f.operations.indexOf('fill'),mode+' raster drawn behind vector layer');
  assert.ok(f.downloads.some(x=>x.endsWith('.png')));
 }
});

test('Vektör export does not request tiles and retains scientific classification overlay',async()=>{
 const f=imageExport('vector');
 assert.equal(await f.exportMap(),true);
 assert.equal(f.tiles.length,0);
 assert.ok(f.operations.includes('fill'));
});

test('CORS/tile failure blocks PNG rather than fabricating white satellite output',async()=>{
 const f=imageExport('sat',{fail:true});
 assert.equal(await f.exportMap(),false);
 assert.equal(f.downloads.length,0);
 assert.match(f.messages.map(x=>x.message).join(' '),/CORS|harita|kara|sağlayıcı|Altlık/i);
});

test('tile projection is deterministic, capped and bounded to requested park coordinates',()=>{
 const f=imageExport('vector');
 const p=f.tool.baseTilePlan({minLat:39.98,maxLat:40.01,minLon:32.63,maxLon:32.66},'topo');
 assert.ok(p.tiles.length>0&&p.tiles.length<=48);
 assert.ok(p.tiles.every(x=>x.z===p.z));
 assert.ok(p.tiles.every(x=>x.url.includes('/'+x.z+'/')));
 assert.deepEqual(Array.from(f.tool.baseTilePlan({minLat:39.98,maxLat:40.01,minLon:32.63,maxLon:32.66},'vector').tiles),[]);
});

test('hard/building scientific IDs and colors are locked; darker building is presentation-only',()=>{
 const source=load('src/ui/lc-sens.js'),exporter=load('src/ui/gis-export.js'),ui=load('src/ui/gis-workspace.js');
 const lock=JSON.parse(load('docs/surface-engine-lock.json'));
 assert.equal(Object.keys(lock.locked_files).length,51);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
 assert.ok(lock.locked_files['src/services/lc-review.js']);
 assert.ok(!lock.locked_files['src/ui/gis-export.js']);
 assert.ok(!lock.locked_files['src/ui/gis-workspace.js']);
 assert.match(source,/hard:"#64748b"/);
 assert.match(source,/building:"#475569"/);
 assert.match(exporter,/const BUILDING_COLOR="#334155"/);
 assert.match(ui,/const BUILDING_PRESENTATION_COLOR="#334155"/);
 assert.match(ui,/item\.cls==="building"\?BUILDING_PRESENTATION_COLOR/);
 assert.match(exporter,/item\.cls==="building"\?BUILDING_COLOR/);
 assert.doesNotMatch(ui,/rec\.corrections\s*=|\.acceptedAreas\s*=|DG_SENS_COLORS\s*=/);
 assert.doesNotMatch(exporter,/dgSensSave\(|DG_SENS_COLORS\s*=|\.acceptedAreas\s*=/);
});

test('4-point boundary finish repeats without reopening the menu; 3-point check is unavailable',()=>{
 const source=load('src/ui/gis-workspace.js'),events=[];
 let close=0,start=0,finish=0;
 const s={draw:{ring:[[1,1],[1,2],[2,2],[2,1]],type:'hard'},
  record:{features:[]},epoch:3,busy:false,saving:false,rawView:false};
 const project={classList:{contains:key=>key==='surface-review-active'}};
 const queue=[];
 const ctx={
  window:{DG_LC_SENS:{state:s}},
  document:{readyState:'loading',addEventListener(){},getElementById:id=>id==='v-map'?project:null},
  dgSensDrawFinish(){finish++;s.record.features.push({type:s.draw.type,ring:s.draw.ring});s.draw=null;},
  dgSensDrawStart(){start++;s.draw={ring:[],type:'hard'};},
  dgSensCloseMenus(){close++;},
  setTimeout:cb=>{queue.push(cb);return queue.length;},clearTimeout(){},console
 };
 vm.runInNewContext(source,ctx);
 const api=ctx.window.DG_GIS_WORKSPACE_UI;
 assert.equal(api.finishAndContinueBoundary(),true);
 assert.equal(finish,1);
 assert.equal(s.record.features.length,1);
 assert.equal(s.draw,null);
 assert.equal(queue.length,1);
 queue.shift()();
 assert.equal(start,1);
 assert.equal(close,1);
 assert.equal(s.draw.ring.length,0);
 s.draw.ring=[[1,1],[1,2],[2,2]];
 assert.equal(api.finishAndContinueBoundary(),false);
 assert.equal(finish,1);
});

test('quick class changes only unfinished preview; not accepted or historical features',()=>{
 const source=load('src/ui/gis-workspace.js');
 let setType=null,redraw=0,render=0;
 const feature={type:'hard',ring:[[1,1],[2,1],[1,2]]};
 const s={draw:{ring:[[1,1],[2,1],[2,2],[1,2]],type:'hard'},
  record:{features:[feature],acceptedAreas:{hard:700,building:100}},busy:false,saving:false,rawView:false};
 const ctx={window:{DG_LC_SENS:{state:s}},
  document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},
  dgSensSetDrawType:type=>{setType=type;s.drawType=type;},
  dgSensDrawRender:()=>redraw++,dgSensRenderPaintTools:()=>render++,
  setTimeout:()=>1,clearTimeout(){},console};
 vm.runInNewContext(source,ctx);
 const api=ctx.window.DG_GIS_WORKSPACE_UI;
 assert.equal(api.chooseQuickBoundary('building'),true);
 assert.equal(setType,'building');
 assert.equal(s.draw.type,'building');
 assert.equal(redraw,1);assert.equal(render,1);
 assert.equal(feature.type,'hard');
 assert.equal(s.record.acceptedAreas.hard,700);
 assert.equal(s.record.acceptedAreas.building,100);
 assert.equal(api.chooseQuickBoundary('pool'),false);
 assert.equal(api.chooseQuickBoundary('water'),true);
});

test('drawing dock shows the checkmark only at 4 corners and places class selector immediately beside it',()=>{
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.textContent='';this.hidden=false;this.value='';}
  setAttribute(k,v){this.attributes[k]=v;}
  append(...nodes){this.children.push(...nodes);}
  addEventListener(){}
  querySelector(q){
   if(!q.startsWith('#'))return null;
   const id=q.slice(1);
   const visit=root=>{
    for(const child of root.children){if(child.id===id)return child;const found=visit(child);if(found)return found;}
    return null;
   };
   return visit(this);
  }
  remove(){this.removed=true;}
 }
 const host=new Node('div'),view={classList:{contains:k=>k==='surface-review-active'}};
 const state={draw:{type:'building',ring:[[32.1,39.9],[32.2,39.9],[32.2,40.0]]},busy:false,saving:false};
 const doc={readyState:'loading',addEventListener(){},
  getElementById:id=>id==='surfaceMapTools'?host:id==='v-map'?view:null,
  createElement:tag=>new Node(tag)};
 const sandbox={window:{DG_LC_SENS:{state}},document:doc,setTimeout,clearTimeout,console};
 vm.runInNewContext(load('src/ui/gis-workspace.js'),sandbox);
 const api=sandbox.window.DG_GIS_WORKSPACE_UI;
 api.syncQuickBoundary();
 const dock=host.querySelector('#dgUxBoundaryDock');
 assert.ok(dock);
 assert.equal(dock.children[0].id,'dgUxBoundaryClass');
 assert.equal(dock.children[1].id,'dgUxBoundaryFinish');
 assert.equal(dock.children[0].value,'building');
 assert.equal(dock.children[1].hidden,true,'no tick after 3 corners');
 assert.equal(dock.children[0].children.length,5,'exactly 5 classes, without old pool');
 state.draw.ring.push([32.1,40.0]);
 api.syncQuickBoundary();
 assert.equal(dock.children[1].hidden,false,'tick shows at 4 corners');
 assert.equal(dock.children[1].disabled,false);
});

test('verified vector PNG preserves full-strength locked green, hard, water and bare hues',()=>{
 const exporter=load('src/ui/gis-export.js'),workspace=load('src/ui/gis-workspace.js');
 assert.match(exporter,/basemap==="vector"\?1:Math\.max\(\.35,/);
 assert.match(exporter,/building:\{color:"#334155",label:"Bina"\}/);
 assert.match(exporter,/hard:\{color:"#64748b",label:"Sert zemin"\}/);
 assert.match(exporter,/water:\{color:"#3b82f6",label:"Su"\}/);
 assert.match(workspace,/const BUILDING_PRESENTATION_COLOR="#334155"/);
 assert.match(load('css/gis-workspace.css'),/\.dg-ux-boundary-finish\[hidden\]\{display:none!important\}/);
 assert.match(load('css/gis-workspace.css'),/has\(\.dg-ux-boundary-dock\):has\(\.dg-ux-ndvi-map-info\)/);
});
