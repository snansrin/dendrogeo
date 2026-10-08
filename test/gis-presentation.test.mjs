import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const load = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('GIS PNG adapter tolerates late-loaded landcover classes and intercepts the locked legacy handler',async()=>{
 const hooks={};const notices=[];
 const sandbox={
  window:{},document:{
   getElementById:()=>null,
   addEventListener:(event,fn,capture)=>{hooks[event]={fn,capture};},
   readyState:'loading'
  },
  toast:(msg)=>notices.push(msg),
  setTimeout,clearTimeout,console,
  Date,Math
 };
 vm.runInNewContext(load('src/ui/gis-export.js'),sandbox,{filename:'src/ui/gis-export.js'});
 const png=sandbox.window.DG_GIS_PNG_EXPORT;
 assert.equal(png.classes().green.label,'Yeşil alan');
 sandbox.DG_LC_CLASSES=[{key:'green',color:'#00dd00',label:'Custom green'}];
 assert.equal(png.classes().green.color,'#00dd00');
 assert.equal(hooks.click.capture,true);
 let prevented=false,stopped=false;
 hooks.click.fn({
  target:{closest:()=>({tagName:'BUTTON'})},
  preventDefault:()=>{prevented=true;},
  stopImmediatePropagation:()=>{stopped=true;}
 });
 await Promise.resolve();
 assert.equal(prevented,true);
 assert.equal(stopped,true);
 assert.ok(notices.includes('Önce bir park seçin.'));
 assert.equal(sandbox.window.downloadParkImage,png.download);
});

test('GIS review DOM shows original report in raw mode and removes duplicate raw details in preview',()=>{
 const host={innerHTML:'<b>Current preview</b><details>Raw report</details>',removed:0,querySelectorAll(){return[{remove:()=>{this.removed++;}}];}};
 const state={record:{},rawView:false,baselineReport:'<b>🗺️ Arazi Örtüsü · 10 m · 2021</b>'};
 const sandbox={
  window:{DG_LC_SENS:{state}},
  document:{readyState:'loading',getElementById:id=>id==='landCoverReport'?host:null,addEventListener:()=>{}},
  setTimeout,clearTimeout,console
 };
 vm.runInNewContext(load('src/ui/gis-workspace.js'),sandbox,{filename:'src/ui/gis-workspace.js'});
 sandbox.window.DG_GIS_WORKSPACE_UI.sync();
 assert.equal(host.removed,1);
 assert.match(host.innerHTML,/Current preview/);
 state.rawView=true;
 sandbox.window.DG_GIS_WORKSPACE_UI.sync();
 assert.equal(host.innerHTML,state.baselineReport);
});

test('mobile GIS stylesheet keeps notifications visible and the analysis usable on narrow viewports',()=>{
 const style=load('css/gis-workspace.css');
 assert.match(style,/#toastWrap\s*\{[\s\S]*?z-index:2147483646!important/);
 assert.match(style,/bottom:calc\(12px \+ env\(safe-area-inset-bottom\)\)!important/);
 assert.match(style,/#v-map #lcSens #dgSensSummary\{display:none\}/);
});


test('reviewed result uses the source bar color, native-row labels and preserves its original measurement',()=>{
 const colors={};const style={setProperty:(key,value)=>{colors[key]=value;}};
 const label={textContent:'Yeşil alan',prepend(node){this.textContent=node.text+this.textContent;}};
 const metric={textContent:'21.352 ha · %42.7',append(node){this.textContent+=node.textContent;}};
 const fill={style:{backgroundColor:'rgb(34, 197, 94)'}};
 const row={
  before(panel){this.panel=panel;},
  style,
  querySelector(sel){
   if(sel===':scope > span')return label;
   if(sel===':scope > b')return metric;
   if(sel===':scope > .dg-surface-track > i')return fill;
   return null;
  }
 };
 const slider={style:{setProperty:(key,value)=>{colors['slider:'+key]=value;}}};
 const host={
  innerHTML:'<b>Güncel yüzey önizlemesi</b>',wrapped:false,
  querySelectorAll(sel){
   if(sel===':scope > details.dg-sens-details')return[];
   if(sel===':scope > .dg-surface-stat')return this.wrapped?[]:[row];
   return[];
  }
 };
 const document={
  readyState:'loading',
  createElement:tag=>tag==='div'?{className:'',append(){host.wrapped=true;}}:{className:'',textContent:''},
  createTextNode:text=>({text}),
  getElementById:id=>id==='landCoverReport'?host:id==='dgSensRange-green'?slider:null,
  addEventListener:()=>{},querySelector:()=>null
 };
 const sandbox={document,window:{DG_LC_SENS:{state:{record:{},rawView:false}},DG_SURFACE_REVIEW:{types:{green:{label:'Yeşil alan'}}}},console,setTimeout,clearTimeout};
 vm.runInNewContext(load('src/ui/gis-workspace.js'),sandbox);
 sandbox.window.DG_GIS_WORKSPACE_UI.sync();
 assert.equal(label.textContent,'🌿 Yeşil alan');
 assert.equal(metric.textContent,'21.352 ha · %42.7');
 assert.equal(colors['--dg-ux-surface-color'],'rgb(34, 197, 94)');
 assert.equal(colors['slider:--dg-ux-slider-color'],'rgb(34, 197, 94)');
 assert.equal(row.panel.className,'dg-ux-surface-rows');
});

test('preview bars match the raw WorldCover row typography, geometry and class-specific slider colors',()=>{
 const css=load('css/gis-workspace.css');
 assert.match(css,/\.dg-ux-surface-rows>\.dg-surface-stat\s*\{[\s\S]*?grid-template-columns:106px minmax\(0,1fr\) 132px/);
 assert.match(css,/\.dg-surface-track\s*\{[\s\S]*?height:16px/);
 assert.match(css,/font:700 \.75rem\/1\.45 var\(--f-ui\)/);
 for(const [cls,color] of Object.entries({green:'#22c55e',water:'#3b82f6',hard:'#64748b',bare:'#8b5a2b'})){
  assert.ok(css.includes('input.dg-sens-slider#dgSensRange-'+cls));
  assert.ok(css.includes('accent-color:var(--dg-ux-slider-color,'+color+')'));
 }
 assert.match(css,/@media\(max-width:330px\)/);
 assert.match(css,/\.dg-ux-surface-percentage\s*\{[\s\S]*?font-weight:400/);
 assert.match(css,/--dg-ux-surface-color/);
});


test('distance measurement captures polygon clicks before editor popup even in review and park modes',()=>{
 const handlers={},events={},statuses=[];
 const mapContainer={
  addEventListener:(name,fn,capture)=>{assert.equal(capture,true);events[name]=fn;},
  removeEventListener:(name,fn)=>{if(events[name]===fn)delete events[name];}
 };
 const layers={clearLayers(){},remove(){}};
 const mockedMap={
  on:(ev,cb)=>{handlers[ev]=cb;},off:(ev,cb)=>{if(handlers[ev]===cb)delete handlers[ev];},
  addLayer(){},removeLayer(){},
  getContainer:()=>mapContainer,mouseEventToLatLng:e=>e.point,
  dragging:{moved:()=>false}
 };
 const selected={setAttribute(){},classList:{add(){}}};
 const toolButtons={querySelector:()=>selected,querySelectorAll:()=>[selected]};
 const doc={
  readyState:'loading',addEventListener:()=>{},
  getElementById:id=>({
   'v-map':{classList:{contains:()=>true}},
   dgUxMapTools:toolButtons,
   dgUxMapStatus:{set textContent(s){statuses.push(s);},get textContent(){return'';}}
  })[id]||null
 };
 const leaflet={
  layerGroup:()=>({addTo:()=>layers,clearLayers(){}}),
  circleMarker:()=>({addTo(){}}),
  polyline:()=>({addTo(){}}),
  latLng:p=>({distanceTo:q=>Math.abs((q?.lng||0)-(p?.lng||0))*100})
 };
 const sandbox={window:{L:leaflet},L:leaflet,map:mockedMap,PARK_MODE:true,document:doc,
  getComputedStyle:()=>({getPropertyValue:()=>''}),setTimeout,clearTimeout,console};
 vm.runInNewContext(load('src/ui/gis-workspace.js'),sandbox,{filename:'gis-workspace.js'});
 assert.equal(typeof sandbox.window.DG_GIS_WORKSPACE_UI.activateTool,'function');
 sandbox.window.DG_GIS_WORKSPACE_UI.activateTool('distance');
 assert.equal(typeof events.click,'function');
 let swallowed=0;
 for(const lng of [1,2]){
  events.click({button:0,point:{lat:40,lng},target:{closest:()=>null},stopImmediatePropagation:()=>{swallowed++;},stopPropagation(){}});
 }
 assert.equal(swallowed,2);
 assert.match(statuses.join(' '),/Mesafe:/);
 sandbox.window.DG_GIS_WORKSPACE_UI.closeTool();
 assert.equal(events.click,undefined);
});

test('verified map PNG and legacy PNG action use the same NDVI-aware export path',()=>{
 const script=load('src/ui/gis-export.js');
 const workspace=load('src/ui/gis-workspace.js');
 assert.match(script,/button\[onclick\*="dgSensExportPng"\]/);
 assert.match(script,/ndviTiers\.cutoffs/);
 assert.match(script,/ndviTiers\.tiers/);
 assert.match(workspace,/verified\.textContent="🖼️ PNG İndir"/);
 assert.match(workspace,/legacy\.hidden=!!verified/);
 assert.match(workspace,/if\(window\.DG_LC_SENS\?\.state\?\.record/);
 assert.match(workspace,/parked\.grid/);
});

test('mobile menu and relative NDVI status remain visible without editing locked CSS or raster code',()=>{
 const css=load('css/gis-workspace.css');
 const work=load('src/ui/gis-workspace.js');
 assert.match(css,/#v-map #surfaceMenuBar>\.dg-editor-menu\s*\{[\s\S]*?display:block/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/\.dg-ux-ndvi-map-info/);
 assert.match(work,/function syncNdviMapInfo\(/);
 assert.match(work,/typeof dgSensFocus==="function"\)dgSensFocus\(null\)/);
});
