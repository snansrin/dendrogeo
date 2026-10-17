import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(join(root,'src/ui/render-verified-surface-map-export.js'),'utf8');

function loadModule(){
  const window={};
  vm.runInNewContext(source,{window,URL,Date,setTimeout});
  return window.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT;
}

test('verified map export module owns dialog listeners and rejects empty layer selection',()=>{
  const exporter=loadModule(),listeners={},queries={};
  const dialog={id:'',className:'',innerHTML:'',
    addEventListener:(name,callback)=>{listeners[name]=callback;},
    querySelector(selector){return queries[selector]??(queries[selector]={checked:false,textContent:'',addEventListener:(name,callback)=>{queries[selector][name]=callback;}});},
    showModal(){this.open=true;},close(){listeners.close?.();this.open=false;},remove(){this.removed=true;}};
  const document={getElementById:()=>null,createElement:()=>dialog,body:{append(){}}};
  let renderCount=0;
  exporter.openDialog({document,grid:false,waypoints:[],escape:String,translate:String,renderDialog:()=>'<dialog/>',renderPng:()=>renderCount++});
  assert.equal(dialog.open,true);
  queries['#dgExportDownload'].click();
  assert.equal(renderCount,0);
  assert.equal(queries['#dgExportError'].textContent,'En az bir katman seçin.');
  queries['[name="surface"]'].checked=true;
  queries['#dgExportDownload'].click();
  assert.equal(renderCount,1);
});

test('verified map export module keeps canvas rendering isolated behind injected collaborators',async()=>{
  const exporter=loadModule();
  let warning='';
  await exporter.render({state:{busy:false,saving:false,geometry:null},record:null,cells:[],toast:message=>warning=message,translate:String});
  assert.equal(warning,'Önce arazi örtüsü analizini çalıştırın.');
  const lazy=readFileSync(join(root,'src/utils/lazylibs.js'),'utf8');
  assert.ok(lazy.indexOf('src/ui/render-verified-surface-map-export.js')<lazy.indexOf('src/ui/lc-sens.js'));
});

test('verified map infographic evaluates the area provider instead of printing function source',async()=>{
 const window={},texts=[];
 vm.runInNewContext(source,{window,URL,Date,setTimeout});
 vm.runInNewContext(readFileSync(join(root,'src/ui/render-surface-export-infographic.js'),'utf8'),{window});
 const context={fillRect(){},strokeRect(){},fillText:value=>texts.push(String(value)),beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const state={epoch:1,geometry:{},epsg:32636},areas={green:501000};let calls=0;
 await window.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render({state,record:{acceptedAt:'now'},cells:[{}],editSummary:()=>({total:0}),toast:message=>assert.fail(message),translate:String,escape:String,getAreas:()=>areas,getRasterAreas:()=>({}),getParkRings:()=>[],getGridCells:()=>[],getPark:()=>({id:25,name:'Göksu Parkı'}),parkAreaLabel:()=>{calls++;return '50.1';},getParts:()=>[],visualResult:async()=>({displayFeatures:[]}),prepareFrame:()=>({canvasProject:()=>[0,0]}),drawLayers(){},renderInfo:window.DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC.render,colors:{},ha:n=>(n/10000).toFixed(1),labelForClass:String,document:{createElement:()=>({getContext:()=>context,toBlob(){}})},redraw(){}});
 assert.equal(calls,1);assert.ok(texts.includes('50.1 ha'));assert.ok(texts.every(text=>!text.includes('=>')&&!text.includes('typeof park')));assert.equal(areas.green,501000);assert.equal(state.exporting,false);
});

for(const [acceptedAt,editing,draftDirty,expected] of [[null,false,false,'preview'],['now',false,false,'accepted'],['now',true,true,'preview']]){
 test('PNG download without cell edits has truthful status: '+[acceptedAt,editing,draftDirty].join('/'),async()=>{
  const window={},texts=[],downloads=[],notices=[],record={acceptedAt,draftDirty,corrections:{},features:[]},before=JSON.stringify(record);
  const state={epoch:1,geometry:{},epsg:32636,editing,exporting:false},areas={green:10000,water:2000},areaBefore=JSON.stringify(areas);
  vm.runInNewContext(source,{window,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Date,setTimeout:fn=>fn()});
  vm.runInNewContext(readFileSync(join(root,'src/ui/render-surface-export-infographic.js'),'utf8'),{window});
  const context={fillRect(){},strokeRect(){},fillText:value=>texts.push(String(value)),beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  await window.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render({state,record,cells:[{}],editSummary:()=>({total:0}),toast:message=>notices.push(message),translate:String,escape:String,getAreas:()=>areas,getParkRings:()=>[],getGridCells:()=>[],getPark:()=>({id:43,name:'Harikalar Diyarı'}),parkAreaLabel:()=> '76.7',getParts:()=>[],visualResult:async()=>({displayFeatures:[]}),prepareFrame:()=>({canvasProject:()=>[0,0]}),drawLayers(){},renderInfo:window.DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC.render,colors:{},ha:n=>(n/10000).toFixed(1),labelForClass:String,document:{createElement:kind=>kind==='canvas'?{getContext:()=>context,toBlob:callback=>callback({})}:{click(){downloads.push(this.download);}}},redraw(){}});
  assert.equal(downloads.length,1,'no fabricated cell edit is required');
  if(expected==='accepted'){
   assert.equal(downloads[0],'dendrogeo_dogrulanmis_harita_43.png');assert.ok(texts.includes('DOĞRULANMIŞ PARK HARİTASI'));
  }else{
   assert.equal(downloads[0],'dendrogeo_analiz_onizlemesi_43.png');assert.ok(texts.includes('PARK ANALİZİ ÖNİZLEMESİ'));assert.ok(texts.every(t=>!t.includes('DOĞRULANMIŞ')&&!t.includes('KABUL EDİLMİŞ')));
  }
  assert.equal(notices.length,1);assert.equal(JSON.stringify(record),before);assert.equal(JSON.stringify(areas),areaBefore);assert.equal(state.exporting,false);
 });
}
