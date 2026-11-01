import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function createScenario({offline=false}={}){
 const remote=new Map(),local=new Map(),events=[],warnings=[];
 const key=id=>[id.ownerId,id.projectId,id.parkId].join(':');
 const device={async read(id){return local.get(key(id))||null;},async save(id,value){if(offline)throw Error('indexedDB unavailable');local.set(key(id),structuredClone(value));}};
 const client={from(table){assert.equal(table,'project_workspace_archives');const filters={};
  return {select(){return this;},eq(column,value){filters[column]=value;return this;},
   async maybeSingle(){return{data:remote.get(key({ownerId:filters.owner,projectId:filters.project_id,parkId:filters.park_id}))||null,error:null};},
   async upsert(row){events.push('account-write');remote.set(key({ownerId:row.owner,projectId:row.project_id,parkId:row.park_id}),{payload:structuredClone(row.payload)});return{error:null};}
  };}};
 const root={};runInNewContext(readFileSync(new URL('../src/adapters/parks/live-map-project-account-store.js',import.meta.url),'utf8'),
  {window:root,console,TextEncoder,Date});
 let clock=60000;
 const store=root.DG_LIVE_MAP_PROJECT_ACCOUNT_STORE.create({client,device,now:()=>clock,warn:(...args)=>warnings.push(args.join(' '))});
 return {store,remote,local,events,warnings,device,key,advance:()=>{clock+=31000;}};
}
const identity={ownerId:'sahibi',projectId:33,parkId:53,geometry:'original geometry',engine:'core-v1'};
const plain=value=>JSON.parse(JSON.stringify(value));
const snapshot=(id=identity,savedAt='2026-11-01T10:00:00.000Z')=>({
 schema:'dendrogeo/live-map-project-snapshot/1',...id,savedAt,state:{analysis:{result:{cells:[{id:1}]}},grid:{cells:[]}}
});

test('account archive saves exact project evidence and restores to a second device',async()=>{
 const x=createScenario();const original=snapshot();
 assert.deepEqual(plain(await x.store.save(identity,original)),{local:true,account:true});
 assert.deepEqual(await x.store.read(identity),original);
 assert.equal(x.events.length,1);
 assert.equal(await x.store.read({...identity,ownerId:'other'}),null);
 assert.equal(await x.store.read({...identity,projectId:30}),null);
 assert.equal(await x.store.read({...identity,geometry:'changed'}),null);
 const second=x.store;
 x.local.clear();assert.deepEqual(await second.read(identity),original);
 assert.deepEqual(x.local.get(x.key(identity)),original,'account evidence is recovered back to device');
});

test('completion seal does not prevent read-only recovery and older devices cannot replace newer archives',async()=>{
 const x=createScenario();const first=snapshot(),newer=snapshot(identity,'2026-11-01T12:00:00.000Z');
 await x.store.save(identity,first);
 x.remote.set(x.key(identity),{payload:newer});x.store.flush(identity);
 assert.deepEqual(plain(await x.store.save(identity,first)),{local:true,account:false});
 assert.deepEqual((await x.store.read(identity)).savedAt,newer.savedAt);
 assert.equal(x.events.length,1,'older tab must not overwrite newer account evidence');
});

test('optional account archive works without IndexedDB and rejects foreign scope or oversize payload',async()=>{
 const x=createScenario({offline:true});
 assert.deepEqual(plain(await x.store.save(identity,snapshot())),{local:false,account:true});
 assert.deepEqual(await x.store.read(identity),snapshot());
 await assert.rejects(x.store.save(identity,snapshot({...identity,projectId:30})),/kapsamı geçersiz/);
});

test('archive migration is additive, account/project-scoped and protects locked scientific tables',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261101210000_project_workspace_archives.sql',import.meta.url),'utf8');
 assert.match(sql,/create table if not exists public\.project_workspace_archives/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/owner\s*=\s*\(select auth.uid\(\)\)/i);
 assert.match(sql,/p\.id\s*=\s*project_id and p\.park_id\s*=\s*park_id/i);
 assert.match(sql,/WORKSPACE_ARCHIVE_STALE/);
 assert.doesNotMatch(sql,/alter table public\.(?:parks|projects|measurements|waypoints|surface_reviews)\b/i);
});

test('project loading never executes an implicit second raster scan',()=>{
 const source=readFileSync(new URL('../src/bootstrap/live-map-project-workspace.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('async function restoreWorkspace('),source.indexOf('async function openSurfaceSaved('));
 assert.doesNotMatch(body,/openSurfaceSaved\(|runLandCoverAnalysis\(/);
 assert.match(body,/snapshots\.restore\(id\)/);
});
