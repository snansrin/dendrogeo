import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
  '../src/adapters/offline/create-client-id.js',
  '../src/domain/offline/same-measurement.js',
  '../src/adapters/offline/idb-promises.js',
  '../src/adapters/offline/measurement-queue.js',
  '../src/ui/offline-sync-badge.js'
];
function load(){
  const ctx={console:{log(){}},Math,Date,Promise,document:{getElementById(){return null;}}};
  ctx.window=ctx;vm.createContext(ctx);
  for(const file of files)vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),ctx);
  return ctx;
}

test('offline queue modules expose the five isolated capabilities',()=>{
  const ctx=load();
  assert.equal(typeof ctx.DG_OFFLINE_CLIENT_ID.create,'function');
  assert.equal(typeof ctx.DG_OFFLINE_MEASUREMENT_MATCH.same,'function');
  assert.equal(typeof ctx.DG_OFFLINE_IDB_PROMISES.request,'function');
  assert.equal(typeof ctx.DG_OFFLINE_IDB_PROMISES.transaction,'function');
  assert.equal(typeof ctx.DG_OFFLINE_MEASUREMENT_QUEUE.open,'function');
  assert.equal(typeof ctx.DG_OFFLINE_MEASUREMENT_QUEUE.save,'function');
  assert.equal(typeof ctx.DG_OFFLINE_SYNC_BADGE.update,'function');
});

test('offline reconciliation requires same owner, client ID, scientific fields, and photo proof',()=>{
  const ctx=load();
  const local={owner:'a',client_id:'c1',project_id:2,point_id:4,measurement_no:1,grp:'İBRELİ',species:'Karaçam',girth_cm:132,dbh_cm:42,height_m:8,volume_m3:1,carbon_kg:12,lat:41,lon:29};
  assert.equal(ctx.DG_OFFLINE_MEASUREMENT_MATCH.same(local,{...local,photo_url:null}),true);
  assert.equal(ctx.DG_OFFLINE_MEASUREMENT_MATCH.same(local,{...local,owner:'b'}),false);
  assert.equal(ctx.DG_OFFLINE_MEASUREMENT_MATCH.same(local,{...local,dbh_cm:99}),false);
  assert.equal(ctx.DG_OFFLINE_MEASUREMENT_MATCH.same({...local,photoBlob:{}},{...local}),false);
  assert.equal(ctx.DG_OFFLINE_MEASUREMENT_MATCH.same({...local,photoBlob:{}},{...local,photo_url:'/photo.jpg'}),true);
});

test('offline IndexedDB promise adapters resolve and reject with request and transaction events',async()=>{
  const ctx=load();
  const request={result:7};
  const pending=ctx.DG_OFFLINE_IDB_PROMISES.request(request);
  request.onsuccess();
  assert.equal(await pending,7);
  const tx={};
  const done=ctx.DG_OFFLINE_IDB_PROMISES.transaction(tx);
  tx.oncomplete();
  await done;
  const aborted={error:new Error('aborted')};
  const failed=ctx.DG_OFFLINE_IDB_PROMISES.transaction(aborted);
  aborted.onabort();
  await assert.rejects(failed,/aborted/);
});

test('offline queue persistence assigns a client ID and refreshes badge after commit',async()=>{
  const ctx=load();
  let complete,closed=0,badge=0,stored;
  ctx.indexedDB={open(){
    const req={};
    queueMicrotask(()=>{req.onsuccess({target:{result:{
      objectStoreNames:{contains:()=>true},
      transaction(){return{objectStore(){return{add(value){stored=value;}};},set oncomplete(fn){complete=fn;},set onerror(fn){},set onabort(fn){}};},
      close(){closed++;}
    }}});});
    return req;
  }};
  ctx.updateSyncBadge=()=>{badge++;};
  const data={owner:'a'};
  const saved=ctx.DG_OFFLINE_MEASUREMENT_QUEUE.save(data);
  await new Promise(resolve=>setTimeout(resolve,0));
  complete();
  await saved;
  assert.match(data.client_id,/^[0-9a-f-]{36}$/i);
  assert.equal(stored.data,data);
  assert.equal(closed,1);
  assert.equal(badge,1);
});

test('offline sync badge is inert when the badge element is absent',async()=>{
  const ctx=load();
  await ctx.DG_OFFLINE_SYNC_BADGE.update();
});

test('all five offline modules load before the service and are precached',()=>{
  const head=readFileSync(new URL('../partials/head.html',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const paths=files.map(path=>path.replace('../',''));
  const service=head.indexOf('src/services/offline.js');
  for(const path of paths){
    const index=head.indexOf(path);
    assert.ok(index>=0,`${path} missing from head`);
    assert.ok(index<service,`${path} must load before offline service`);
    assert.ok(worker.includes(`/${path}`),`${path} missing from service-worker precache`);
  }
});
