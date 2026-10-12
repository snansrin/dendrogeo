import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=file('index.html'),boot=file('partials/boot.html'),css=file('css/gis-workspace.css');
const ui=file('src/ui/gis-workspace.js'),analysisLayout=file('src/ui/gis-workspace-analysis-layout.js'),menuPosition=file('src/ui/gis-workspace-menu-position.js'),park=file('src/ui/park-panel.js'),panelMarkup=file('src/ui/park-info-panel.js');
const workspacePresentation=ui+'\n'+analysisLayout;
const parkSurface=park+'\n'+panelMarkup;
const dashboard=file('src/services/dash.js'),sw=file('sw.js');
const lock=JSON.parse(file('docs/surface-engine-lock.json'));

test('workspace lives strictly outside the 54 frozen science files',()=>{
 for(const p of ['partials/boot.html','src/ui/gis-workspace.js','src/ui/gis-workspace-analysis-layout.js','src/ui/gis-workspace-menu-position.js','css/gis-workspace.css','sw.js','test/gis-workspace-ui.test.mjs']){
  assert.ok(!lock.locked_files[p],p);
 }
 assert.equal(Object.keys(lock.locked_files).length,54);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
});

test('workspace loads once from an external classic script and is precached',()=>{
 assert.match(boot,/src\/ui\/gis-workspace\.js\?v=[a-f0-9]{8}/);
 assert.match(boot,/src\/ui\/gis-workspace-analysis-layout\.js\?v=[a-f0-9]{8}/);
 assert.match(boot,/src\/ui\/gis-workspace-menu-position\.js\?v=[a-f0-9]{8}/);
 assert.ok(boot.indexOf('src/ui/gis-workspace-analysis-layout.js')<boot.indexOf('src/ui/gis-workspace.js'));
 assert.ok(boot.indexOf('src/ui/gis-workspace-menu-position.js')<boot.indexOf('src/ui/gis-workspace.js'));
 assert.match(html,/src\/ui\/gis-workspace\.js\?v=[a-f0-9]{8}/);
 assert.match(html,/src\/ui\/gis-workspace-analysis-layout\.js\?v=[a-f0-9]{8}/);
 assert.match(html,/src\/ui\/gis-workspace-menu-position\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/gis-workspace\.js/);
 assert.match(sw,/\/src\/ui\/gis-workspace-analysis-layout\.js/);
 assert.match(sw,/\/src\/ui\/gis-workspace-menu-position\.js/);
 assert.doesNotMatch(boot,/id="dg-gis-workspace"/);
 assert.doesNotThrow(()=>new vm.Script(ui));
 assert.match(html,/css\/gis-workspace\.css\?v=[a-f0-9]{8}/);
});

test('all original Grid, layer and PNG IDs and event handlers remain wired',()=>{
 for(const id of ['parkGridTools','parkLayerTools','parkRasterExport','gridProject','gridSize','gridClearance','pngBg','chkPngGrid','chkPngWp','chkPngCover','togGrid','togWp']){
  assert.match(parkSurface,new RegExp('id="'+id+'"'));
 }
 assert.match(parkSurface,/onclick="buildGrid\(\)"/);
 assert.match(parkSurface,/onclick="downloadParkImage\(\)"/);
 assert.match(ui,/panel\.append\(exportCard\)/);
 assert.match(ui,/section\.append\(pngFields\)/);
 assert.doesNotMatch(ui,/cloneNode\(/);
 assert.match(ui,/menu\.dataset\.menuOrder="45"/);
 assert.doesNotMatch(css,/#v-map #surfaceMenuBar \.dg-ux-output-menu\s*\{\s*margin-left:auto/);
});

test('six most frequent species remains visible without redundant PNG download',()=>{
 assert.match(dashboard,/En Yaygın 6 Tür/);
 assert.match(dashboard,/topSpecies\.map/);
 assert.match(workspacePresentation,/En Yaygın 6 Tür/);
 assert.match(workspacePresentation,/\.dg-png-btn"\)\.forEach\(b=>b\.remove\(\)\)/);
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
 vm.runInNewContext(analysisLayout,context);
 vm.runInNewContext(menuPosition,context);
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
