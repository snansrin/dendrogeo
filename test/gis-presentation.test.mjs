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
 const handlers={},events={},statuses=[],labels=[];
 const mapContainer={
  addEventListener:(name,fn,capture)=>{assert.equal(capture,true);events[name]=fn;},
  removeEventListener:(name,fn)=>{if(events[name]===fn)delete events[name];}
 };
 const layers={clearLayers(){labels.length=0;},remove(){}};
 const mockedMap={
  on:(ev,cb)=>{handlers[ev]=cb;},off:(ev,cb)=>{if(handlers[ev]===cb)delete handlers[ev];},
  addLayer(){},removeLayer(){},
  getContainer:()=>mapContainer,mouseEventToLatLng:e=>e.point,
  dragging:{moved:()=>false}
 };
 const selected={setAttribute(){},classList:{add(){},remove(){}}};
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
  tooltip:opts=>{
   const result={opts};
   return {setLatLng(at){result.at=at;return this;},setContent(value){result.value=value;return this;},addTo(){labels.push(result);return this;}};
  },
  latLng:p=>({...p,distanceTo:q=>Math.abs((q?.lng||0)-(p?.lng||0))*100})
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
 assert.equal(labels.length,1,'one visible label for the first measured segment');
 assert.equal(labels[0].value,'100.0 m');
 assert.equal(labels[0].at.lng,1.5);
 assert.equal(labels[0].at.lat,40);
 assert.equal(labels[0].opts.permanent,true);
 assert.equal(labels[0].opts.interactive,false);
 events.click({button:0,point:{lat:40,lng:3},target:{closest:()=>null},stopImmediatePropagation(){},stopPropagation(){}});
 assert.equal(labels.length,2,'one distance label per segment, no duplicates');
 assert.deepEqual(labels.map(x=>x.value),['100.0 m','100.0 m']);
 assert.equal(labels[1].at.lng,2.5);
 assert.match(statuses.join(' '),/Mesafe: 200.0 m/);
 sandbox.window.DG_GIS_WORKSPACE_UI.closeTool();
 assert.equal(events.click,undefined);
});

test('verified-map original label/dialog are restored, separate quick PNG stays in File',()=>{
 const script=load('src/ui/gis-export.js');
 const workspace=load('src/ui/gis-workspace.js');
 const locked=load('src/ui/lc-sens.js');
 assert.match(workspace,/verified\.textContent="🖼️ Doğrulanmış Harita"/);
 assert.match(workspace,/legacy\.hidden=false/);
 assert.match(locked,/function dgSensExportPng\(\)/);
 assert.match(locked,/dialog\.showModal\(\)/);
 assert.match(script,/const exportAction=event\.target\?\.closest\?\.\("#dgExportDownload"\)/);
 assert.match(script,/if\(exportAction\)/);
 assert.match(script,/if\(dialog\?\.id==="dgSurfaceExportDialog"&&dialog\.querySelector\('\[name="surface"\]'\)\?\.checked\)/);
 assert.match(script,/const button=event\.target\?\.closest\?\.\('button\[onclick\*="downloadParkImage"\]'\)/);
 assert.match(workspace,/if\(window\.DG_LC_SENS\?\.state\?\.record/);
 assert.match(workspace,/parked\[key\]/);
});

test('mobile menu and relative NDVI status remain visible without editing locked CSS or raster code',()=>{
 const css=load('css/gis-workspace.css');
 const work=load('src/ui/gis-workspace.js');
 assert.match(css,/#v-map #surfaceMenuBar>\.dg-editor-menu\s*\{[\s\S]*?display:block/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/\.dg-ux-ndvi-map-info/);
 assert.match(work,/function syncNdviMapInfo\(/);
 assert.match(work,/state\.vegetationLayer\.eachLayer\(layer=>layer\.bringToFront\?\.\(\)\)/);
 assert.match(work,/dgSensToggleCand\(true\)/);
 assert.match(work,/typeof dgSensFocus==="function"\)dgSensFocus\(null\)/);
});

test('Other is hidden only from review rows, without removing its area from saved analysis',()=>{
 const work=load('src/ui/gis-workspace.js');
 const science=load('src/ui/lc-sens.js');
 assert.match(work,/if\(label\?\.textContent\?\.trim\(\)==="Diğer"\)\{row\.remove\(\);continue;\}/);
 assert.match(science,/function dgSensAreaBars\(areas\)/);
 assert.match(science,/Object\.entries\(areas\)/);
 assert.doesNotMatch(work,/\.delete\(other\)|areas\.other\s*=|record\.areas\s*=/);
});

test('Top six species disclosure retains original bar rows and supports keyboard native details',()=>{
 const script=load('src/ui/gis-workspace.js'),css=load('css/gis-workspace.css');
 assert.match(script,/el\("details","dg-ux-species-collapse"\)/);
 assert.match(script,/el\("summary","dg-ux-species-toggle"\)/);
 assert.match(script,/list\.append\(node\)/);
 assert.match(css,/details\.dg-ux-species-collapse>summary:focus-visible/);
});

test('green sensitivity uses a colored explicit browser-native track and no black background',()=>{
 const css=load('css/gis-workspace.css'),work=load('src/ui/gis-workspace.js');
 assert.match(css,/::-webkit-slider-runnable-track/);
 assert.match(css,/::-moz-range-progress/);
 assert.match(css,/::-webkit-slider-thumb/);
 assert.match(css,/var\(--dg-ux-slider-color,#22c55e\)/);
 assert.match(work,/--dg-ux-slider-fill/);
 assert.match(css,/\.dg-sens-slider\[id\^="dgSensRange-"\]/);
});


test('verified NDVI PNG uses 1240x1560 official layout and paints observed green tiers over land cover',()=>{
 const src=load('src/ui/gis-export.js');
 assert.match(src,/async function renderVerified\(layers\)/);
 assert.match(src,/CW=1240,CH=1560,MX=40,MY=240,MW=760,MH=1180/);
 assert.match(src,/g\.fillText\("DOĞRULANMIŞ PARK HARİTASI"/);
 assert.match(src,/for\(const poly of ndviPolys\)[\s\S]*?drawLeaflet\(g,pr,poly/);
 assert.match(src,/const counts=\{sparse:0,moderate:0,dense:0\}/);
 assert.match(src,/tiers\.cutoffs\.map\(n=>Number\(n\)\.toFixed\(3\)\)/);
 assert.match(src,/if\(showNdvi&&\(tiers\.count<9\|\|!tiers\.cutoffs\)\)/);
 assert.match(src,/dgSensEditSummary\(rec\)/);
 assert.match(src,/dgSensFeatures\(\)\.length/);
 assert.match(src,/NDVI katmanı tek başına doğrulanmış harita sayılmaz/);
 assert.match(src,/const ndviPolys=showNdvi\?await waitVegetation\(sens,30\):\[\]/);
 assert.match(src,/renderVerified\(layers\)/);
});

test('verified-map original layer dialog remains; downloading combines water with pool in both NDVI modes',async()=>{
 const hooks={},warnings=[];
 const state={vegetationView:false,rawView:false};
 const dialog={
  id:'dgSurfaceExportDialog',
  closeCount:0,
  querySelector:sel=>({checked:sel==='[name="surface"]'||sel==='[name="park"]'}),
  close(){this.closeCount++;}
 };
 const action={closest:()=>dialog};
 const target={closest:selector=>selector==='#dgExportDownload'?action:null};
 const context={
  window:{DG_LC_SENS:{state}},
  document:{getElementById:()=>null,addEventListener:(name,fn)=>{hooks[name]=fn;}},
  toast:msg=>warnings.push(msg),
  setTimeout,clearTimeout,console,Date,Math
 };
 vm.runInNewContext(load('src/ui/gis-export.js'),context);
 let prevented=0,stopped=0;
 const click=()=>({target,preventDefault:()=>{prevented++;},stopImmediatePropagation:()=>{stopped++;}});
 hooks.click(click());
 assert.equal(prevented,1);assert.equal(dialog.closeCount,1);
 state.vegetationView=true;
 hooks.click(click());
 await Promise.resolve();
 assert.equal(prevented,2);assert.equal(stopped,2);
 assert.equal(dialog.closeCount,2);
 assert.match(warnings.join(' '),/Önce parkın arazi örtüsü analizini açın/);
});

test('midpoint label styling does not capture map clicks or alter GIS core presentation',()=>{
 const css=load('css/gis-workspace.css');
 const js=load('src/ui/gis-workspace.js');
 assert.match(css,/\.leaflet-tooltip\.dg-ux-distance-label/);
 assert.match(css,/pointer-events:none!important/);
 assert.match(css,/font-variant-numeric:tabular-nums/);
 assert.match(js,/if\(mapTool==="distance"&&typeof L\.tooltip==="function"\)/);
 assert.match(js,/\.setLatLng\(middle\)\.setContent\(unit\(meters\)\)\.addTo\(drawLayer\)/);
 assert.match(js,/drawLayer\.clearLayers\(\)/);
 assert.match(js,/if\(mapInstance&&drawLayer\)mapInstance\.removeLayer\(drawLayer\)/);
});

test('surface brush omits pool/fountain but retains water and all historical science classes',()=>{
 const ui=load('src/ui/gis-workspace.js');
 const core=load('src/ui/lc-sens.js');
 assert.match(core,/const types=\["hard","green","water","building","pool","bare"\]/);
 assert.match(ui,/function syncBrushChoices\(\)/);
 assert.match(ui,/select\.querySelector\('option\[value="pool"\]'\)/);
 assert.match(ui,/legacyPool\.remove\(\)/);
 assert.match(ui,/dgSensBrushChoose\("water"\)/);
 const removed=[],select={value:'water',querySelector:q=>q==='option[value="pool"]'?{remove(){removed.push('pool');}}:null};
 const sandbox={window:{DG_LC_SENS:{state:{brushType:'water'}}},
  document:{readyState:'loading',addEventListener(){},querySelector:q=>q==='#dgSensBrushType'?select:null,getElementById:()=>null},
  setTimeout,clearTimeout,console};
 vm.runInNewContext(ui,sandbox);
 sandbox.window.DG_GIS_WORKSPACE_UI.sync();
 assert.deepEqual(removed,['pool'],'only the brush pool option is removed');
 assert.equal(select.value,'water');
 assert.equal(sandbox.window.DG_LC_SENS.state.brushType,'water');
});

test('previously selected pool brush safely becomes water on next UI update',()=>{
 const ui=load('src/ui/gis-workspace.js');
 let chosen=null;
 const select={value:'pool',querySelector:()=>({remove(){}})};
 const state={brushType:'pool',busy:false,saving:false,rawView:false};
 const sandbox={window:{DG_LC_SENS:{state}},dgSensBrushChoose:type=>{chosen=type;state.brushType=type;},
  document:{readyState:'loading',addEventListener(){},querySelector:q=>q==='#dgSensBrushType'?select:null,getElementById:()=>null},
  setTimeout,clearTimeout,console};
 vm.runInNewContext(ui,sandbox);
 sandbox.window.DG_GIS_WORKSPACE_UI.sync();
 assert.equal(chosen,'water');
 assert.equal(state.brushType,'water');
});

test('brush UI leaves saved pool boundaries alone while the water brush remains selected',()=>{
 const work=load('src/ui/gis-workspace.js');
 const core=load('src/ui/lc-sens.js');
 assert.match(work,/legacyPool\.remove\(\)/);
 assert.match(work,/if\(select\.value==="pool"\)select\.value="water"/);
 assert.match(core,/function dgSensFeatures\(rec=DG_SENS\.record\)/);
 assert.match(core,/dgSensDrawType/,'separate boundary classes remain available');
 assert.match(core,/function dgSensSave\(\)/,'scientific persistence path remains original');
});

test('boundary selection and report sidecar present pool as Su without erasing its scientific class',()=>{
 const work=load('src/ui/gis-workspace.js'),png=load('src/ui/gis-export.js');
 assert.match(work,/function syncWaterBoundary\(\)/);
 assert.match(work,/option\[value="pool"\]/);
 assert.match(work,/dgSensSetDrawType\("water"\)/);
 assert.match(work,/function syncWaterSurfaceRows\(\)/);
 assert.match(work,/if\(pool!==water\)pool\.remove\(\)/);
 assert.match(work,/merged\.water\/10000/);
 assert.match(work,/function onWaterPopup\(event\)/);
 assert.match(work,/function normalizeWaterText\(root\)/);
 assert.match(png,/k==="water"\?Number\(areas\.pool\|\|0\):0/);
 assert.match(png,/showNdvi\?await waitVegetation\(sens,30\):\[\]/);
 assert.match(png,/item\.cls==='pool'\?'#3b82f6'/);
 assert.match(load('src/services/lc-review.js'),/pool:\{group:"pool",label:"Havuz \/ süs havuzu"\}/);
});

test('water presentation calculates correct combined area, share and leaves source totals intact',()=>{
 const src=load('src/ui/gis-workspace.js');
 const sandbox={document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},window:{},setTimeout,clearTimeout,console};
 vm.runInNewContext(src,sandbox);
 const result=sandbox.window.DG_GIS_WORKSPACE_UI.waterPresentationAreas({
  green:310000,water:121000,pool:5000,hard:64000
 });
 assert.equal(result.water,126000);
 assert.equal(result.pool,5000);
 assert.equal(result.total,500000);
 assert.equal(result.pct,25.2);
});

test('surface status and water sensitivity count show exact pool-inclusive water totals',()=>{
 const work=load('src/ui/gis-workspace.js');
 const areas={green:250000,water:120000,pool:5000,hard:125000};
 const summary={textContent:''},counter={textContent:''};
 const doc={readyState:'loading',addEventListener(){},getElementById(){return null;},
  querySelector:q=>q==='#dgSensSummary'?summary:q==='#dgSensCnt-water'?counter:null};
 const window={DG_LC_SENS:{state:{editing:true,rawView:false,partsMemo:{areas},
  record:{sens:{water:50}}}},
  DG_SURFACE_REVIEW:{types:{green:{label:'Yeşil alan'},water:{label:'Su'},hard:{label:'Sert zemin'}}}};
 const sandbox={window,document:doc,setTimeout,clearTimeout,console};
 vm.runInNewContext(work,sandbox);
 window.DG_GIS_WORKSPACE_UI.sync();
 assert.equal(counter.textContent,'50 · 12.500 ha');
 assert.match(summary.textContent,/Su: 12\.500 ha/);
 assert.doesNotMatch(summary.textContent,/Havuz|pool/i);
 assert.equal(areas.water,120000);
 assert.equal(areas.pool,5000,'legacy evidence remains separate in data');
});
