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
