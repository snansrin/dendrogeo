import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const run=(path,root)=>{runInNewContext(readFileSync(new URL("../"+path,import.meta.url),"utf8"),{window:root,console,Date,JSON});return root;};
const identity={ownerId:"user1",projectId:33,parkId:53};
test("cloud snapshot restores only same user/project/stage; offline local failures do not hide cloud data",async()=>{
 const rows=new Map(),calls=[];
 const client={from(table){assert.equal(table,"project_workspace_snapshots");let constraints={};
  return {select(fields){assert.equal(fields,"payload");return this;},eq(k,v){constraints[k]=v;return this;},
   async maybeSingle(){calls.push(["read",constraints]);return {data:rows.get(JSON.stringify(constraints))||null,error:null};},
   async upsert(row,options){assert.equal(options.onConflict,"owner,project_id,park_id");const key=JSON.stringify({owner:row.owner,project_id:row.project_id,park_id:row.park_id});
    rows.set(key,{payload:row.payload});calls.push(["write",row.project_id,row.park_id]);return {error:null};}
  };
 }};
 const root=run("src/adapters/parks/live-map-project-snapshot-store.js",{});
 const store=root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE.create(()=>null,()=>client);
 const snapshot={savedAt:"2026-11-01T10:00:00Z",state:{grid:{cells:[{id:"cell-1"}]},analysis:null}};
 assert.equal((await store.save(identity,snapshot,{flush:true})).cloud,true);
 assert.deepEqual(JSON.parse(JSON.stringify(await store.read(identity))),snapshot);
 assert.equal(await store.read({...identity,parkId:25}),null);
 assert.equal(await store.read({...identity,ownerId:"user2"}),null);
 assert.equal(calls.filter(row=>row[0]==="write").length,1);
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
