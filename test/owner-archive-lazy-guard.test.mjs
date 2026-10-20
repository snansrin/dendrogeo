import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/admin-storage-usage.js',import.meta.url),'utf8');

test('the protected owner archive import is gated before any network request',()=>{
 const guard=source.indexOf("if(typeof PROFILE==='undefined'||!PROFILE||PROFILE.role!=='owner')return;");
 const dynamicImport=source.indexOf("import('/src/ui/photo-admin-controls.mjs')");
 assert.ok(guard>=0,'owner access guard must be present');
 assert.ok(dynamicImport>guard,'owner guard must execute before requesting the module');
 const begin=source.indexOf('function mountOwnerArchiveControls(){');
 assert.ok(begin>=0&&guard>begin);
});

test('storage quota stays visible to admin and visitor while owner-only import is skipped',()=>{
 for(const role of ['admin','user']){
  const root={};
  const context={window:root,PROFILE:{role}};
  vm.runInNewContext(source,context,{filename:'src/ui/admin-storage-usage.js'});
  const bar={style:{}},info={textContent:''};
  root.DG_ADMIN_STORAGE_USAGE_UI.render(bar,info,{
   bytes:1048576,count:7,quota:100,format:(tpl,data)=>tpl
     .replace('{n}',String(data.n)).replace('{mb}',String(data.mb)).replace('{q}',String(data.q))
  });
  assert.match(info.textContent,/7 fotoğraf/);
  assert.equal(bar.style.width,'1%');
  root.DG_ADMIN_STORAGE_USAGE_UI.unavailable(info,'Veri geçici olarak alınamadı');
  assert.equal(info.textContent,'Veri geçici olarak alınamadı');
 }
});
