import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
function deleteFixture(result){
 const events=[];const ctx={window:null,confirm:()=>true,dgCf:s=>s,console,
 sb:{from(){return {delete(){events.push('delete');return this;},eq(){return this;},select(){return Promise.resolve(result);}};}},
 removePhoto:async u=>events.push('photo:'+u),toast:()=>events.push('error'),$:()=>null,dgMarkLiveDirty:()=>events.push('dirty')};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(readFileSync(new URL('src/services/dash.js',root),'utf8'),ctx);
 ctx.loadRecords=()=>events.push('records');ctx.loadDash=()=>events.push('dash');return {ctx,events};
}
test('failed or zero-row deletion retains photo and UI records',async()=>{
 for(const result of [{data:null,error:{message:'RLS denied'}},{data:[],error:null}]){
  const f=deleteFixture(result);await f.ctx.delRec(42);assert.deepEqual(f.events,['delete','error']);
 }
});
test('confirmed deletion removes its returned photo and refreshes live data',async()=>{
 const f=deleteFixture({data:[{photo_url:'saved.jpg'}],error:null});await f.ctx.delRec(42);
 assert.deepEqual(f.events,['delete','photo:saved.jpg','records','dash','dirty']);
});
test('restore SQL quotes untrusted column identifiers and contains metadata line breaks',()=>{
 let output;const ctx={window:null,confirm:()=>true,dgCf:s=>s,dgTfs:()=>'',toast(){},
 Blob:class{constructor(parts){output=parts.join('');}},URL:{createObjectURL:()=>'',revokeObjectURL(){}},
 setTimeout(){},document:{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(readFileSync(new URL('src/services/backup.js',root),'utf8'),ctx);
 const key='id) VALUES (1); DROP TABLE public.parks; --';
 ctx.dgRestoreSQL({counts:{},exported_by:'Field\nCOMMIT;\n-- injected',exported_at:'2026-10-04\r\nSELECT 1;',projects:[{[key]:1,name:"Park O'Name"}]});
 assert.ok(output.includes('("'+key+'", "name")'));assert.ok(output.includes("'Park O''Name'"));
 assert.ok(!/^COMMIT;.*-- injected/m.test(output));assert.equal(output.split('\n').filter(x=>x==='COMMIT;').length,1);
 assert.ok(output.includes('-- Yedek tarihi: 2026-10-04  SELECT 1; · disa aktaran: Field COMMIT; -- injected'));
});
