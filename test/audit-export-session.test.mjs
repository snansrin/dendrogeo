import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('park inventory response from an old account cannot open a report in a new session',async()=>{
 const listeners={},select={value:'park:7',replaceChildren(){}},status={style:{}},modal={},title={},body={},download={};let release,started,opened=0;
 const ready=new Promise(resolve=>started=resolve);
 const document={readyState:'loading',querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(key,fn)=>listeners[key]=fn,getElementById:id=>({dgSharedParkSelect:select,dgSharedParkStatus:status,previewModal:modal,pvTitle:title,pvBody:body,pvDownload:download}[id]||null)};
 const window={document,DG_EXPORT_PREVIEW_UI:{open(){opened++;}},DG_SHARED_PARK_INVENTORY_STORE:{listParticipantProjects:async()=>[{id:1,park_id:7,park_name:'Park'}],isCurrentParticipant:async()=>true,readAll:async()=>{started();return new Promise(resolve=>release=resolve);}}};
 const context=vm.createContext({window,document,USER:{id:'old'},PROFILE:{role:'user'},sb:{},LATIN:{},SB_URL:'https://example.supabase.co',Option:function(){},URL,Blob,console});
 for(const path of ['src/domain/export/shared-park-inventory-domain.js','src/ui/shared-park-inventory-export.js'])vm.runInContext(readFileSync(path,'utf8'),context);
 window.DG_SHARED_PARK_INVENTORY_EXPORT.init();
 listeners.click({target:{closest:()=>({dataset:{dgParkInventoryAction:'preview'}})}});await ready;
 context.USER={id:'new'};release([{point_id:1,project_id:1}]);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(opened,0);
});
