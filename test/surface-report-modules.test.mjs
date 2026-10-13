import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/domain/surface/summarize-surface-edit-impact.js',
 'src/application/surface/build-surface-report-model.js',
 'src/ui/render-surface-area-bars.js',
 'src/ui/render-surface-current-report.js',
 'src/ui/render-surface-accepted-report.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array});vm.runInContext(read('src/ui/render-surface-accepted-result.js'),context);for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}
const identity=value=>value;

test('edit summary counts manual cells, sensitivity changes, boundaries, thresholds and appearance',()=>{
 const summarize=setup().DG_SUMMARIZE_SURFACE_EDIT_IMPACT.summarize,record={corrections:{'0:0':{method:'visual-cell',to:'water'},'0:1':{method:'sensitivity',to:'green'}},features:[{}],sens:{green:60},displayOpacity:50},cells=[{row:0,col:0,classKey:'green'},{row:0,col:1,classKey:'bare'}];
 const result=summarize({record,currentRecord:record,cells,rawView:false,classes:['green','water'],cellKey:cell=>`${cell.row}:${cell.col}`,effective:cell=>cell.classKey==='bare'?'green':cell.classKey});
 assert.equal(result.manualCells,1);assert.equal(result.sensitivityCells,1);assert.equal(result.boundaries,1);assert.equal(result.thresholds,1);assert.equal(result.appearance,1);assert.equal(result.total,5);
 assert.equal(summarize({record,currentRecord:record,cells,rawView:true,classes:[],cellKey:()=>'',effective:()=>''}).total,0);
});

test('report model preserves raw, preview, accepted titles and guidance',()=>{
 const model=setup().DG_BUILD_SURFACE_REPORT_MODEL.build;
 assert.equal(model({rawView:true,editing:true,translate:identity}).currentTitle,'Ham 2021 raster sonucu');
 assert.equal(model({rawView:false,editing:true,translate:identity}).currentTitle,'Güncel yüzey önizlemesi');
 const accepted=model({rawView:false,editing:false,translate:identity});assert.equal(accepted.currentTitle,'Kayıtlı analiz sonucu');assert.equal(accepted.acceptedTitle,'Kayıtlı analiz sonucu');assert.match(accepted.acceptedHint,/Kaydedilmemiş önizleme rapora girmez/);
});

test('area bars preserve class order, hectare labels, percentages and HTML escaping',()=>{
 const render=setup().DG_RENDER_SURFACE_AREA_BARS.render,html=render({areas:{green:7500,water:2500,hard:0},types:{green:{label:'<Green>'},water:{label:'Water'},hard:{label:'Hard'}},colors:{green:'#0f0',water:'#00f',hard:'#888'},escape:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),translate:identity,hectares:value=>(value/10000).toFixed(3)});
 assert.ok(html.indexOf('&lt;Green&gt;')<html.indexOf('Water'));assert.ok(html.includes('0.750 ha · %75.0'));assert.ok(html.includes('background:#00f'));assert.equal((html.match(/dg-surface-stat/g)||[]).length,2);
});

test('current report captures baseline once and composes the shared area bars',()=>{
 const render=setup().DG_RENDER_SURFACE_CURRENT_REPORT.render,host={innerHTML:'baseline'},set=[],bars=()=>'<bars>',escape=value=>String(value),presentation={currentTitle:'Önizleme',currentHint:'Kaydet',baselineTitle:'Ham'};
 assert.equal(render({host,areas:{},baseline:'',setBaseline:value=>set.push(value),presentation,areaBars:bars,escape}),true);assert.deepEqual(set,['baseline']);assert.ok(host.innerHTML.includes('<bars>'));assert.ok(host.innerHTML.includes('<summary>Ham</summary>baseline'));
 const first=host.innerHTML;host.innerHTML='external';render({host,areas:{},baseline:set[0],setBaseline:value=>set.push(value),presentation,areaBars:bars,escape});assert.equal(set.length,1);assert.ok(host.innerHTML.includes('baseline'));
});

test('accepted compatibility renderer delegates and preserves accepted report markup',()=>{
 const w=setup(),host={innerHTML:''},areaBars=()=>'<bars>',accepted={acceptedAt:'2026-10-13',areas:{green:1}};
 assert.equal(w.DG_RENDER_SURFACE_ACCEPTED_RESULT.render({result:accepted,host,areaBars,escape:identity,translate:identity,formatDate:value=>'date:'+value}),true);assert.ok(host.innerHTML.includes('<b>Kayıtlı analiz sonucu</b>'));assert.ok(host.innerHTML.includes('<p class="dg-meta">date:2026-10-13</p><bars>'));
});

test('five report modules load before locked UI, are precached, and service delegates',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 for(const key of ['DG_SUMMARIZE_SURFACE_EDIT_IMPACT','DG_BUILD_SURFACE_REPORT_MODEL','DG_RENDER_SURFACE_AREA_BARS','DG_RENDER_SURFACE_CURRENT_REPORT','DG_RENDER_SURFACE_ACCEPTED_REPORT'])assert.ok(ui.includes(key)||read('src/ui/render-surface-accepted-result.js').includes(key),key);
});
