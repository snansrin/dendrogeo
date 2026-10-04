import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/services/offline.js',import.meta.url),'utf8');
const draft=(extra={})=>({id:1,data:{owner:'a',client_id:'client-1',project_id:2,point_id:1,measurement_no:1,dbh_cm:42,height_m:8,species:'Karaçam',grp:'İBRELİ',carbon_kg:123,...extra}});
function fixture(records=[draft()],options={}){
 const events=[],toasts=[],remote=new Map(options.remote||[]);
 let inserts=0,updates=0,uploads=0,closed=0;
 const db={close(){closed++;},transaction(name,mode){
  const tx={objectStore(){return {getAll(){const r={};queueMicrotask(()=>{r.result=records.slice();r.onsuccess();});return r;},delete(id){
   setTimeout(()=>{if(options.deleteFails){tx.error=new Error('IDB abort');tx.onabort();return;}
    const i=records.findIndex(r=>r.id===id);if(i>=0)records.splice(i,1);events.push('deleted');tx.oncomplete();},5);
  }};}};return tx;
 }};
 const sb={from(){let op='read',payload,filters={};return {
  select(){return this;},eq(k,v){filters[k]=v;return this;},update(p){op='update';payload=p;return this;},insert(p){op='insert';payload=p;return this;},
  async maybeSingle(){if(options.onLookup)await options.onLookup();return {data:remote.get(filters.client_id)||null,error:options.lookupError||null};},
  async then(resolve,reject){try{
   if(op==='insert')inserts++;if(op==='update')updates++;
   if(options.beforeWrite)await options.beforeWrite();
   const r=options.writeResult||{data:[{id:42}],error:null};
   if(!r.error&&op==='insert')remote.set(payload.client_id,{...payload,id:42});
   events.push('server');return resolve(r);
  }catch(e){return reject(e);}}
 };},storage:{from(){return {async upload(){uploads++;return {error:options.photoError||null};},getPublicUrl(){return {data:{publicUrl:'https://example.org/photo.jpg'}};}};}}};
 const ctx={window:null,document:{getElementById(){return null;}},navigator:{onLine:true},USER:{id:'a'},sb,
  setTimeout,clearTimeout,queueMicrotask,console:{log(){},warn(){},error(){}},
  $:()=>null,toast:(...x)=>toasts.push(x),dgMarkLiveDirty:()=>events.push('refresh')};
 ctx.window=ctx;ctx.addEventListener=()=>{};vm.createContext(ctx);vm.runInContext(source,ctx);ctx.openOfflineDB=async()=>db;
 return {ctx,records,events,toasts,counts:()=>({inserts,updates,uploads,closed})};
}
test('concurrent login/online sync drains a draft only once and awaits IDB commit',async()=>{
 let release;const hold=new Promise(r=>release=r);const f=fixture(undefined,{beforeWrite:()=>hold});
 const a=f.ctx.syncOfflineData(),b=f.ctx.syncOfflineData();await new Promise(r=>setTimeout(r,0));
 assert.equal(f.counts().inserts,1);assert.equal(f.records.length,1);release();await Promise.all([a,b]);
 assert.equal(f.counts().inserts,1);assert.equal(f.records.length,0);assert.deepEqual(f.events,['server','deleted','refresh']);assert.equal(f.counts().closed,1);
});
test('point uniqueness conflict keeps the draft and photo',async()=>{
 const f=fixture([draft({photoBlob:{size:1}})],{writeResult:{error:{code:'23505',message:'measurements_unique_point'},data:null}});
 await f.ctx.syncOfflineData();assert.equal(f.records.length,1);assert.equal(f.records[0].data.photoBlob.size,1);assert.equal(f.counts().uploads,1);
});
test('same client_id and matching stored measurement proves replay without upload/insert',async()=>{
 const d=draft({photoBlob:{size:1}}),saved={...d.data,id:42,photo_url:'https://example.org/photo.jpg'};
 const f=fixture([d],{remote:[['client-1',saved]]});await f.ctx.syncOfflineData();assert.equal(f.records.length,0);
 assert.deepEqual(f.counts(),{inserts:0,updates:0,uploads:0,closed:1});
});
test('same client_id with different scientific values never discards the draft',async()=>{
 const f=fixture(undefined,{remote:[['client-1',{...draft().data,dbh_cm:99}]],writeResult:{error:{code:'23505',message:'conflict'}}});
 await f.ctx.syncOfflineData();assert.equal(f.records.length,1);
});
test('another account draft is preserved and current account draft is synced',async()=>{
 const f=fixture([{...draft({owner:'b'}),id:2},draft()]);await f.ctx.syncOfflineData();
 assert.equal(f.counts().inserts,1);assert.equal(f.records.length,1);assert.equal(f.records[0].data.owner,'b');
});
test('account change during lookup prevents upload and write',async()=>{
 let f;f=fixture([draft({photoBlob:{size:1}})],{onLookup:()=>{f.ctx.USER={id:'b'};}});await f.ctx.syncOfflineData();
 assert.equal(f.records.length,1);assert.equal(f.counts().inserts,0);assert.equal(f.counts().uploads,0);
});
test('zero-row update retains local edit',async()=>{
 const f=fixture([draft({_editId:42})],{writeResult:{data:[],error:null}});await f.ctx.syncOfflineData();assert.equal(f.counts().updates,1);assert.equal(f.records.length,1);
});
test('write and photo failures retain queue and release the sync lock',async()=>{
 const f=fixture(undefined,{writeResult:{error:{code:'42501',message:'denied'}}});await f.ctx.syncOfflineData();await f.ctx.syncOfflineData();assert.equal(f.counts().inserts,2);assert.equal(f.records.length,1);
 const p=fixture([draft({photoBlob:{size:1}})],{photoError:{message:'upload failed'}});await p.ctx.syncOfflineData();assert.equal(p.counts().inserts,0);assert.equal(p.records.length,1);
});
test('aborted local deletion never reports a completed sync',async()=>{
 const f=fixture(undefined,{deleteFails:true});await f.ctx.syncOfflineData();assert.equal(f.records.length,1);assert.equal(f.events.includes('refresh'),false);assert.ok(f.toasts.some(x=>x[1]==='err'));
});
