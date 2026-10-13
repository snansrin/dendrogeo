import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/build-surface-editor-view-model.js','src/ui/render-surface-scan-panel.js','src/ui/render-surface-sensitivity-controls.js','src/ui/render-surface-review-actions.js','src/ui/compose-surface-editor-panel.js'];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}
const tr=value=>value,escape=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');

test('editor view model derives scan readiness and operation gates',()=>{
  const build=setup().DG_BUILD_SURFACE_EDITOR_VIEW_MODEL.build;assert.deepEqual(JSON.parse(JSON.stringify(build({record:{profile:{cells:{}}},busy:false,saving:false,exporting:false,vegetationCount:8}))),{scanned:true,vegetationReady:false,disabled:false});assert.equal(build({record:{},busy:true,saving:false,exporting:false,vegetationCount:12}).disabled,true);assert.equal(build({record:{profile:{cells:{}}},busy:false,saving:false,exporting:false,vegetationCount:9}).vegetationReady,true);
});

test('scan panel keeps its status button, profile range, audit and source hint',()=>{
  const window=setup(),model={scanned:true,disabled:false},record={profile:{scenes:[{usedCells:1,datetime:'2026-02-01'},{usedCells:1,datetime:'2026-01-01'}],stats:{nProfiled:9}}},html=window.DG_RENDER_SURFACE_SCAN_PANEL.render({model,record,busy:false,rawView:false,brush:null,cellCount:10,auditHtml:()=>'<audit>',translate:tr,escape});
  assert.ok(html.indexOf('dgSensScanBtn')<html.indexOf('Sentinel‑2 L2A'));assert.ok(html.indexOf('Sentinel‑2 L2A')<html.indexOf('<audit>'));assert.match(html,/2026-01-01 – 2026-02-01/);assert.match(html,/9\/10/);assert.match(html,/Küçük bina ve havuzlar/);
});

test('sensitivity controls preserve class order, slider callbacks and raw/brush gates',()=>{
  const window=setup(),html=window.DG_RENDER_SURFACE_SENSITIVITY_CONTROLS.render({model:{scanned:true,disabled:false},record:{sens:{green:50,water:40,hard:60,bare:30}},classes:['green','water','hard','bare'],meta:key=>({emoji:'•',tr:key}),focus:'water',rawView:true,brush:null,sectionsOpen:true,opacity:45,translate:tr,escape});
  assert.ok(html.indexOf("dgSensFocus('green')")<html.indexOf("dgSensFocus('water')"));assert.ok(html.indexOf("dgSensFocus('water')")<html.indexOf("dgSensFocus('hard')"));assert.ok(html.indexOf("dgSensFocus('hard')")<html.indexOf("dgSensFocus('bare')"));assert.match(html,/dgSensSlide\('water',this.value\)/);assert.match(html,/id="dgSensOpacityValue">%45/);assert.match(html,/aria-pressed="true"/);assert.match(html,/value="40"[^>]*disabled/);
});

test('review actions preserve accepted summary IDs and gate acceptance on raw or brush',()=>{
  const html=setup().DG_RENDER_SURFACE_REVIEW_ACTIONS.render({record:{objectFeatures:[{},{}]},disabled:false,rawView:false,brush:{},showCandidates:true,translate:tr,escape});assert.match(html,/dgSensAcceptBtn/);assert.match(html,/dgSensToggleCand/);assert.match(html,/id="dgSensSummary"/);assert.match(html,/id="dgSensStatus"/);assert.match(html,/id="dgSensVegetationSummary"/);assert.match(html,/OSM: 2/);assert.match(html,/dgSensAccept\(\).*disabled/);
});

test('editor panel composer keeps scan, control, then review sections in sequence',()=>{
  const compose=setup().DG_COMPOSE_SURFACE_EDITOR_PANEL.render({scanPanel:'scan',sensitivityControls:'controls',reviewActions:'actions'});assert.equal(compose,'scancontrolsactions');
});

test('five editor panel modules are lazy loaded and precached before the legacy renderer',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}for(const name of ['DG_BUILD_SURFACE_EDITOR_VIEW_MODEL','DG_RENDER_SURFACE_SCAN_PANEL','DG_RENDER_SURFACE_SENSITIVITY_CONTROLS','DG_RENDER_SURFACE_REVIEW_ACTIONS','DG_COMPOSE_SURFACE_EDITOR_PANEL'])assert.ok(ui.includes(name));
});
