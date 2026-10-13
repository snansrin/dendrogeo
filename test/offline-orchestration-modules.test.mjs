import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
  '../src/application/offline/drain-measurement-queue.js',
  '../src/application/offline/coordinate-measurement-sync.js',
  '../src/application/offline/refresh-after-measurement-sync.js',
  '../src/ui/offline-sync-feedback.js',
  '../src/ui/offline-install-prompt.js'
];
function load(extra={}){
  const ctx={console:{error(){}},document:{getElementById(){return null;}},toast(){},addEventListener(){},...extra};
  ctx.window=ctx;vm.createContext(ctx);
  for(const path of files)vm.runInContext(readFileSync(new URL(path,import.meta.url),'utf8'),ctx);
  return ctx;
}

test('queue drain preserves foreign drafts and deletes only after successful sync',async()=>{
  const ctx=load(),events=[],records=[{id:1,data:{owner:'other'}},{id:2,data:{owner:'u1'}}];
  const result=await ctx.DG_DRAIN_OFFLINE_MEASUREMENT_QUEUE.run({owner:'u1',openDB:async()=>({close(){events.push('close');}}),readAll:async()=>records,
    remove:async(_db,id)=>events.push(`delete:${id}`),isCurrent:()=>true,syncRecord:async()=>{events.push('sync');return{saved:{id:4}};},
    onSynced:async n=>events.push(`synced:${n}`),onFailed(){},onCritical(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{synced:1,failed:0,lastError:null});
  assert.deepEqual(events,['sync','delete:2','synced:1','close']);
});

test('queue drain retains record and stops after first sync or delete failure',async()=>{
  const ctx=load(),events=[];
  const result=await ctx.DG_DRAIN_OFFLINE_MEASUREMENT_QUEUE.run({owner:'u1',openDB:async()=>({close(){}}),readAll:async()=>[{id:1,data:{owner:'u1'}},{id:2,data:{owner:'u1'}}],
    remove:async()=>{throw new Error('IDB abort');},isCurrent:()=>true,syncRecord:async()=>{events.push('sync');return{};},onSynced(){},onFailed:(n,e)=>events.push(`${n}:${e}`),onCritical(){}});
  assert.equal(result.synced,0);assert.equal(result.failed,1);assert.deepEqual(events,['sync','1:IDB abort']);
});

test('sync coordinator shares the in-flight drain and refreshes badge after completion',async()=>{
  const ctx=load(),events=[];let release;
  const gate=new Promise(resolve=>release=resolve);
  const opts={getUser:()=>({id:7}),isOnline:()=>true,updateBadge:async()=>events.push('badge'),drain:async owner=>{events.push(`drain:${owner}`);await gate;}};
  const first=ctx.DG_COORDINATE_OFFLINE_MEASUREMENT_SYNC.run(opts),second=ctx.DG_COORDINATE_OFFLINE_MEASUREMENT_SYNC.run(opts);
  await Promise.resolve();assert.deepEqual(events,['drain:7']);release();await Promise.all([first,second]);
  assert.deepEqual(events,['drain:7','badge']);
});

test('post-sync refresh touches visible panels and dirties live map once',()=>{
  const ctx=load(),events=[];
  ctx.DG_REFRESH_AFTER_OFFLINE_MEASUREMENT_SYNC.run({isVisible:id=>id==='v-map'||id==='v-records',loadDash(){events.push('dash');},loadRecords(){events.push('records');},loadAdmin(){events.push('admin');},loadWorld(){events.push('world');},markMapDirty(){events.push('dirty');},loadLiveMap(){events.push('map');}});
  assert.deepEqual(events,['records','dirty','map']);
});

test('install prompt module keeps accepted and unavailable feedback',async()=>{
  const events=[],button={style:{display:'none'}};let listener;
  const ctx=load({document:{getElementById:()=>button},addEventListener:(name,fn)=>{if(name==='beforeinstallprompt')listener=fn;},toast:(...args)=>events.push(args)});
  await ctx.DG_OFFLINE_INSTALL_PROMPT.install();assert.equal(events[0][1],'warn');
  let prompted=0;listener({preventDefault(){},prompt(){prompted++;},userChoice:Promise.resolve({outcome:'accepted'})});
  await ctx.DG_OFFLINE_INSTALL_PROMPT.install();assert.equal(prompted,1);assert.equal(button.style.display,'none');assert.equal(events[1][1],'ok');
});

test('offline orchestration modules load before the service and are precached',()=>{
  const head=readFileSync(new URL('../partials/head.html',import.meta.url),'utf8'),worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const service=head.indexOf('src/services/offline.js');
  for(const path of files){const relative=path.replace('../','');assert.ok(head.indexOf(relative)>=0,`${relative} missing from head`);assert.ok(head.indexOf(relative)<service,`${relative} must load before service`);assert.ok(worker.includes(`/${relative}`),`${relative} missing from precache`);}
});
