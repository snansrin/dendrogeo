import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const run=(path,root)=>{runInNewContext(readFileSync(new URL("../"+path,import.meta.url),"utf8"),{window:root,console,Date,JSON});return root;};
const identity={ownerId:"user1",projectId:33,parkId:53};
test("account-scoped workspace store restores the exact snapshot without needing IndexedDB",async()=>{
 const rows=new Map(),local={async save(){throw Error("indexedDB unavailable");},async read(){throw Error("indexedDB unavailable");}};
 let captured=null;
 const root={DG_LIVE_MAP_PROJECT_STORE:{create:()=>({})},DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE:{create:()=>local},
  DG_LIVE_MAP_PROJECT_SNAPSHOT:{reviewBasis:()=>null,create:({store})=>{captured=store;return {save:async()=>{},restore:async()=>{}};}},
  DG_LIVE_MAP_PROJECT_WORKSPACE_UI:{create:()=>({})}};
 const client={from(table){assert.equal(table,"project_workspace_snapshots");const attrs={};
  return {select(){return this;},eq(k,v){attrs[k]=v;return this;},
   async maybeSingle(){return {data:rows.get(JSON.stringify(attrs))||null,error:null};},
   async upsert(row){rows.set(JSON.stringify({owner:row.owner,project_id:row.project_id,park_id:row.park_id}),{payload:row.payload});return{error:null};}
  };}};
 const env={window:root,sb:client,document:{addEventListener(){}},USER:{id:"user1"}};
 runInNewContext(readFileSync(new URL("../src/bootstrap/live-map-project-workspace.js",import.meta.url),"utf8"),env);
 const id={ownerId:"user1",projectId:33,parkId:53,geometry:"original",engine:"core"};
 const state={schema:"dendrogeo/live-map-project-snapshot/1",...id,savedAt:"2026-11-01T09:00:00Z",state:{analysis:{result:{cells:[1]}}}};
 captured.markFlush(id);
 assert.equal((await captured.save(id,state)).savedAccount,true);
 assert.deepEqual(JSON.parse(JSON.stringify(await captured.read(id))),state);
 assert.equal(await captured.read({...id,ownerId:"other"}),null);
 assert.equal(await captured.read({...id,parkId:25}),null);
});
test("snapshot RLS migration constrains both owner and existing project-park link",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261101084800_project_workspace_snapshots.sql",import.meta.url),"utf8");
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/owner=\(select auth.uid\(\)\)/);
 assert.equal((sql.match(/p.id=project_id and p.park_id=park_id/g)||[]).length,4);
 assert.doesNotMatch(sql,/grant\s+all|to\s+anon\s*;/i);
});
test("stage re-open verifies the active polygon, not merely its park ID",()=>{
 const ui=readFileSync(new URL("../src/ui/live-map-project-workspace.js",import.meta.url),"utf8");
 const boot=readFileSync(new URL("../src/bootstrap/live-map-project-workspace.js",import.meta.url),"utf8");
 assert.match(ui,/ports.activeBoundaryMatches\?\.\(park\)===false/);
 assert.match(boot,/map.hasLayer\(PARK_LAYER\)/);
 assert.match(boot,/JSON.stringify\(PARK_POLY\)===JSON.stringify\(park.geom_json.outer\)/);
});
