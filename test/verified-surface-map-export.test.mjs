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
