import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/domain/surface/build-surface-toolbar-model.js',
 'src/ui/render-surface-editor-menu-label.js',
 'src/ui/render-surface-editor-panel-head.js',
 'src/ui/render-surface-editor-menus.js',
 'src/ui/render-surface-editor-tool-rail.js'
];
function setup(){const window={DG_SURFACE_REVIEW:{types:Object.fromEntries(['green','water','hard','bare','building','pool'].map(key=>[key,{label:key.toUpperCase()}]))}};const context=vm.createContext({window,Math,Number,String,Object,Array});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}
const identity=value=>value;

test('toolbar model preserves busy/raw gates, active tools, and translated mode labels',()=>{
 const build=setup().DG_BUILD_SURFACE_TOOLBAR_MODEL.build,base={record:{profile:{cells:{}}},busy:false,saving:false,exporting:false,rawView:false,brush:{type:'hard',diameter:20},draw:null,objectPick:false,objectPreview:null,vegetationCount:10,brushType:'water',brushDiameter:10,drawType:'building',base:'sat',sections:{},showCand:true,vegetationView:true,translate:identity,format:(template,args)=>template.replace('{class}',args.class).replace('{size}',String(args.size))};
 const model=build(base);assert.equal(model.disabled,false);assert.equal(model.vegetationReady,true);assert.equal(model.activeType,'hard');assert.equal(model.mode,'Fırça · HARD · 20 m');
 assert.equal(build({...base,busy:true}).disabled,true);assert.equal(build({...base,rawView:true}).disabled,true);
});

test('menu label and panel heading keep the accessible fallback and injected UI contract',()=>{
 const w=setup(),label=w.DG_RENDER_SURFACE_EDITOR_MENU_LABEL.render,head=w.DG_RENDER_SURFACE_EDITOR_PANEL_HEAD.render;
 assert.match(label({icon:'view',label:'Görünüm',translate:identity,escape:identity}),/aria-hidden="true">⌄/);
 assert.match(head({icon:'map',title:'Harita',description:'Seç',translate:identity,escape:identity}),/<strong>Harita<\/strong><small>Seç<\/small>/);
 assert.equal(label({icon:'x',label:'ignored',ui:{menuLabel:(i,l)=>i+':'+l},translate:identity,escape:identity}),'x:ignored');
 assert.equal(head({icon:'x',title:'T',description:'D',ui:{panelHead:(i,t,d)=>i+t+d},translate:identity,escape:identity}),'xTD');
});

test('editor menus keep control IDs, class order, export actions, and review guards',()=>{
 const render=setup().DG_RENDER_SURFACE_EDITOR_MENUS.render,model={disabled:true,viewDisabled:true,rawView:true,brush:null,base:'sat',drawType:'building',objectPick:false,objectPreview:null,activeType:'hard',brushDiameter:10};
 const html=render({record:{features:[{type:'water'}],useObjects:true,period:'ytd'},model,types:setup().DG_SURFACE_REVIEW.types,menuLabel:(_icon,label)=>label,panelHead:(_icon,title)=>title,translate:identity,escape:identity});
 for(const value of ['dgSensBaseSelect','dgSensDrawType','dgSensBrushType','dgSensBrushSize','dgSensPeriod','dgSensFeatures','dgSensExportPng()','dgSensObjectPickStart()','dgSensUndoBoundary()'])assert.ok(html.includes(value),value);
 assert.ok(html.indexOf('value="building"')<html.indexOf('value="pool"'));assert.ok(html.includes('dgSensPeriod(this.value)'));
});

test('toolbar rail keeps accessible action names, no-point draw guard, and ordered shell',()=>{
 const rail=setup().DG_RENDER_SURFACE_EDITOR_TOOL_RAIL,model={disabled:false,brush:null,draw:{ring:[]},objectPreview:null,vegetationView:false,vegetationReady:false};
 const controls=rail.renderRail({model,translate:identity,escape:identity,icon:(_name,fallback)=>fallback});assert.ok(controls.includes('id="dgSensBrushBtn"'));assert.ok(controls.includes('aria-label="Son fırça izini geri al"'));assert.match(controls,/dgSensDrawFinish\(\).*disabled/);
 const shell=rail.compose({menus:'<details></details>',mode:'Haritayı kaydır',translate:identity,escape:identity});assert.ok(shell.indexOf('<nav')<shell.indexOf('dg-editor-status'));assert.ok(shell.includes('ESC iptal'));
});

test('five toolbar modules load before locked UI, are precached, and service delegates when available',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 for(const key of ['DG_BUILD_SURFACE_TOOLBAR_MODEL','DG_RENDER_SURFACE_EDITOR_MENU_LABEL','DG_RENDER_SURFACE_EDITOR_PANEL_HEAD','DG_RENDER_SURFACE_EDITOR_MENUS','DG_RENDER_SURFACE_EDITOR_TOOL_RAIL'])assert.ok(ui.includes(key),key);
});
