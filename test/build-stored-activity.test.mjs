import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function builder(){
 const window={};
 vm.runInNewContext(readFileSync(new URL('../src/application/visitors/build-stored-activity.js',import.meta.url),'utf8'),{window});
 return window.DG_VISITOR_STORED_ACTIVITY_APPLICATION.create();
}

test('stored activity builder composes the existing four activity row types in newest-first order',()=>{
 const api=builder(),rows=api.build({
  measurements:[{created_at:'2026-10-12T10:00:00Z',point_id:7,species:'Oak',status:'approved',profiles:{full_name:'Ada'}}],
  projects:[{created_at:'2026-10-12T12:00:00Z',name:'Park',profiles:{full_name:'Lin'}}],
  dataRequests:[{created_at:'2026-10-12T09:00:00Z',email:'user@example.org',status:'open'}],
  reportRequests:[{created_at:'2026-10-12T11:00:00Z',park_id:42,status:'queued'}]
 },{translate:value=>'tr:'+value,translateValue:value=>'value:'+value});
 assert.deepEqual(Array.from(rows,row=>[row.who,row.what,row.det]),[
  ['Lin','tr:proje oluşturdu','Park'],
  ['—','tr:rapor yayını istedi','park #42 · value:queued'],
  ['Ada','tr:ölçüm kaydı','P7 · value:Oak · value:approved'],
  ['user@example.org','tr:veri talebi','value:open']
 ]);
});

test('stored activity builder tolerates missing datasets and keeps the caller-controlled labels',()=>{
 const rows=builder().build({projects:[{name:'',created_at:null}]},{translate:value=>value.toUpperCase()});
 assert.deepEqual(Array.from(rows,row=>[row.who,row.what,row.det]),[['—','PROJE OLUŞTURDU','']]);
});
