import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=file('index.html'),boot=file('partials/boot.html'),css=file('css/gis-workspace.css');
const ui=file('src/ui/gis-workspace.js'),park=file('src/ui/park-panel.js');
const dashboard=file('src/services/dash.js'),sw=file('sw.js');
const lock=JSON.parse(file('docs/surface-engine-lock.json'));

test('workspace lives strictly outside the 51 frozen science files',()=>{
 for(const p of ['partials/boot.html','src/ui/gis-workspace.js','css/gis-workspace.css','sw.js','test/gis-workspace-ui.test.mjs']){
  assert.ok(!lock.locked_files[p],p);
 }
 assert.equal(Object.keys(lock.locked_files).length,51);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
});

test('workspace loads once from an external classic script and is precached',()=>{
 assert.match(boot,/src\/ui\/gis-workspace\.js\?v=[a-f0-9]{8}/);
 assert.match(html,/src\/ui\/gis-workspace\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/gis-workspace\.js/);
 assert.doesNotMatch(boot,/id="dg-gis-workspace"/);
 assert.doesNotThrow(()=>new vm.Script(ui));
 assert.match(html,/css\/gis-workspace\.css\?v=[a-f0-9]{8}/);
});

test('all original Grid, layer and PNG IDs and event handlers remain wired',()=>{
 for(const id of ['parkGridTools','parkLayerTools','parkRasterExport','gridProject','gridSize','gridClearance','pngBg','chkPngGrid','chkPngWp','chkPngCover','togGrid','togWp']){
  assert.match(park,new RegExp('id="'+id+'"'));
 }
 assert.match(park,/onclick="buildGrid\(\)"/);
 assert.match(park,/onclick="downloadParkImage\(\)"/);
 assert.match(ui,/panel\.append\(exportCard\)/);
 assert.match(ui,/section\.append\(pngFields\)/);
 assert.doesNotMatch(ui,/cloneNode\(/);
 assert.match(ui,/menu\.dataset\.menuOrder="45"/);
 assert.doesNotMatch(css,/#v-map #surfaceMenuBar \.dg-ux-output-menu\s*\{\s*margin-left:auto/);
});

test('six most frequent species remains visible without redundant PNG download',()=>{
 assert.match(dashboard,/En Yaygın 6 Tür/);
 assert.match(dashboard,/topSpecies\.map/);
 assert.match(ui,/En Yaygın 6 Tür/);
 assert.match(ui,/\.dg-png-btn"\)\.forEach\(b=>b\.remove\(\)\)/);
 assert.doesNotMatch(ui,/exportSpecies|canvas\.toBlob|dendrogeo_en_yaygin_6_tur\.png/);
});

test('professional map tools cannot change or write surface classification',()=>{
 const copy=ui.replace(/\r/g,'');
 for(const s of ['pathLength','areaMeters','coordinateQuery','focusPark','activateTool','closeTool'])assert.match(copy,new RegExp(s));
 // Measuring over selected parks is explicitly allowed; click capture prevents
 // both park re-selection and interactive polygon correction popups.
 assert.match(ui,/captureTarget\.addEventListener\("click",captureClick,true\)/);
 assert.match(ui,/e\.stopImmediatePropagation\?\.\(\)/);
 assert.match(ui,/editorActive\(\)/);
 assert.doesNotMatch(ui,/dgSensScan|dgSensAreas|dgSensAccept|dgSensSave|DG_LC_LAST\s*=|localStorage\.setItem|sb\.from\(/);
});

test('measurements are useful map-only approximations, not scientific area changes',()=>{
 let handler;
 const context={
  window:{addEventListener(){},visualViewport:null},
  document:{readyState:'loading',addEventListener(n,callback){handler=callback;}},
  L:{latLng:p=>({...p,distanceTo:q=>Math.hypot((p.lat-q.lat)*111200,(p.lng-q.lng)*85100)})},
  setTimeout,clearTimeout,console
 };
 vm.runInNewContext(ui,context,{timeout:1000});
 const m=context.window.DG_GIS_WORKSPACE_UI;
 assert.ok(m,'Public UI helpers must be exposed for non-invasive tests');
 const polygon=[{lat:40,lng:32.65},{lat:40,lng:32.66},{lat:40.01,lng:32.66},{lat:40.01,lng:32.65}];
 assert.ok(m.areaMeters(polygon)>800000&&m.areaMeters(polygon)<1100000);
 assert.equal(m.areaMeters(polygon.slice(0,2)),0);
 assert.ok(m.pathLength(polygon)>2000);
 assert.equal(typeof handler,'function');
});

test('mobile 320/360/390/430 widths and card/slider reflow are explicitly scoped',()=>{
 assert.match(css, /@media \(max-width:360px\)/);
 assert.match(css, /@media \(max-width:700px\)/);
 assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css, /#v-map #lcSens \.dg-sens-row/);
 assert.match(css, /#v-map #map\.surface-review-map/);
 assert.match(css, /#v-map #surfaceMenuBar \.dg-editor-menu-body/);
 assert.match(css, /var\(--green\)/);
 assert.doesNotMatch(css,/\.dg-png-btn\.primary\s*\{/);
});

test('phone toast stays in the safe top area and menu panels track the visible viewport',()=>{
 assert.match(css,/@media\(max-width:700px\)[\s\S]*?#toastWrap\s*\{[\s\S]*?top:max\(12px,env\(safe-area-inset-top\) \+ 12px\)!important;[\s\S]*?bottom:auto!important;/);
 assert.doesNotMatch(css,/bottom:calc\(12px \+ env\(safe-area-inset-bottom\)\)!important/);
 assert.match(css,/@media\(max-width:700px\)[\s\S]*?#v-map #surfaceMenuBar\s*\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(css,/@media\(max-width:390px\)[\s\S]{0,100}#v-map #surfaceMenuBar\s*\{[\s\S]{0,80}grid-template-columns/);
 assert.match(ui,/document\.addEventListener\("scroll",scheduleMenuPosition/);
 assert.match(ui,/window\.visualViewport\?\.addEventListener\("scroll",scheduleMenuPosition/);
 assert.match(ui,/viewportBottom-panelHeight/);
});

test('mobile menu geometry is clamped to visualViewport even when its anchor is near the lower edge',()=>{
 const start=ui.indexOf('function menuPosition(menu){');
 const end=ui.indexOf('\n function scheduleMenuPosition',start);
 assert.ok(start>=0&&end>start,'menu positioning helper is present');
 const panel={style:{},scrollHeight:480};
 const menu={open:true,querySelector:()=>panel,getBoundingClientRect:()=>({bottom:690,left:320,right:380})};
 const context={window:{visualViewport:{width:390,height:500,offsetTop:30,offsetLeft:0},innerWidth:390,innerHeight:800},document:{documentElement:{clientWidth:390,clientHeight:800}},menu};
 vm.runInNewContext(ui.slice(start,end)+';menuPosition(menu);',context);
 assert.equal(panel.style.position,'fixed');
 assert.equal(panel.style.left,'10px');
 assert.equal(panel.style.width,'370px');
 assert.equal(panel.style.top,'42px');
 assert.equal(panel.style.maxHeight,'480px');
});
