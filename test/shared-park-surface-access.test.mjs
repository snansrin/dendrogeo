import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('fresh analysis starts neutral while the accepted snapshot and optimistic revision remain intact',()=>{
 const window={};vm.runInNewContext(read('src/domain/surface/create-surface-review-record.js'),{window});
 const api=window.DG_CREATE_SURFACE_REVIEW_RECORD,accepted={areas:{hard:42}},saved={serverRevision:32,acceptedResult:accepted,acceptedAt:'2026-10-16',acceptedAreas:accepted.areas,corrections:{old:true},features:[{old:true}]};
 const fresh=api.create({park:{id:25},owner:'current',createdAt:'today'}),result=api.freshAnalysis(saved,fresh);
 assert.equal(result.serverRevision,32);assert.equal(result.acceptedResult,accepted);assert.equal(Object.keys(result.corrections).length,0);assert.equal(result.features.length,0);assert.equal(result.sens.green,50);assert.equal(result.draftDirty,true);assert.equal(saved.corrections.old,true);
});
test('self departure preserves other members and measurements; public map exposes only trusted cartography',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema private;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
 grant usage on schema private,auth to anon,authenticated;
 create table public.park_collaborators(park_id bigint,user_id uuid);
 create table public.profiles(id uuid,role text);
 create table public.surface_reviews(park_id bigint,owner uuid,revision integer,payload jsonb);
 create table public.measurements(owner uuid);
 insert into public.park_collaborators values(25,'00000000-0000-0000-0000-000000000001'),(25,'00000000-0000-0000-0000-000000000002');
 insert into public.measurements values('00000000-0000-0000-0000-000000000001');
 insert into public.profiles values('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','user');`);
 await db.exec(read('supabase/migrations/20261016145733_shared_park_access_and_accepted_surface.sql'));
 const result={schema:'dendrogeo-surface/2',parkId:25,acceptedAt:'2026-10-16T12:00:00Z',outer:[],holes:[],areas:{hard:12},features:[{type:'Feature',geometry:{type:'MultiPolygon',coordinates:[]},properties:{class:'hard',area_m2:12,owner:'PRIVATE'}}],displayFeatures:[]};
 await db.query('insert into surface_reviews values(25,$1,32,$2)', ['00000000-0000-0000-0000-000000000001',JSON.stringify({owner:'PRIVATE',corrections:{secret:true},acceptedResult:result})]);
 await db.query('insert into surface_reviews values(25,$1,99,$2)', ['00000000-0000-0000-0000-000000000002',JSON.stringify({acceptedResult:{...result,acceptedAt:'2027-01-01',areas:{hard:999}}})]);
 await db.exec('set role anon');
 const publicResult=(await db.query('select public.dg_accepted_park_surface(25) value')).rows[0].value;
 assert.equal(publicResult.revision,32);assert.equal(publicResult.result.areas.hard,12);assert.doesNotMatch(JSON.stringify(publicResult),/PRIVATE|corrections|owner/);
 await assert.rejects(db.query('select public.dg_leave_park(25)'),/permission denied/);
 await db.exec("reset role;set role authenticated;select set_config('request.uid','00000000-0000-0000-0000-000000000003',false)");
 assert.equal((await db.query('select public.dg_leave_park(25) value')).rows[0].value,false);
 await db.exec("select set_config('request.uid','00000000-0000-0000-0000-000000000001',false)");
 assert.equal((await db.query('select public.dg_leave_park(25) value')).rows[0].value,true);
 assert.equal((await db.query('select public.dg_leave_park(25) value')).rows[0].value,false);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from park_collaborators')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from measurements')).rows[0].n,1);
 }finally{await db.close();}
});
test('departure cancel, failure and overlapping requests cannot remove membership twice',async()=>{
 const window={};vm.runInNewContext(read('src/application/park-invites/manage-invites.js'),{window});let calls=0,resolve;
 const ports={authenticated:()=>true,confirm:()=>false,store:{leave:()=>{calls++;return new Promise(r=>resolve=r);}},onSuccess(){},onFailure(){}};
 await window.DG_MANAGE_PARK_INVITES.leave(25,ports);assert.equal(calls,0);
 ports.confirm=()=>true;const first=window.DG_MANAGE_PARK_INVITES.leave(25,ports);await window.DG_MANAGE_PARK_INVITES.leave(25,ports);assert.equal(calls,1);resolve({error:null});await first;
 ports.store.leave=async()=>({error:Error('offline')});let failed=false;ports.onFailure=()=>{failed=true;};await window.DG_MANAGE_PARK_INVITES.leave(25,ports);assert.equal(failed,true);
});
test('imagery recovery preserves native level 19 and installs no adaptive zoom handlers',()=>{
 const window={setTimeout,clearTimeout};vm.runInNewContext(read('src/adapters/map/recover-imagery-tiles.js'),{window});vm.runInNewContext(read('src/adapters/map/create-base-map-layer.js'),{window});const handlers=[];let received;
 const layer={on(event){handlers.push(event);},addTo(){}};
 const configuration={type:'sat',url:'tiles',maxZoom:22,maxNativeZoom:19};
 window.DG_CREATE_BASE_MAP_LAYER.create({leaflet:{tileLayer:(_url,options)=>{received=options;return layer;}},map:{},configuration});
 assert.equal(received.maxNativeZoom,19);assert.equal(received.maxZoom,22);assert.deepEqual(handlers,['tileunload']);
});
test('late saved-map responses and changed boundaries cannot replace the current map',async()=>{
 const window={};vm.runInNewContext(read('src/ui/accepted-park-surface.js'),{window});let release,drawn=0;
 const host={isConnected:true,hidden:true,replaceChildren(){},innerHTML:''};
 const result={schema:'dendrogeo-surface/2',parkId:25,outer:[[]],holes:[],acceptedAt:'today',features:[],areas:{}};
 const ui=window.DG_ACCEPTED_PARK_SURFACE_UI.create({load:()=>new Promise(resolve=>release=resolve),getMap:()=>({removeLayer(){}}),leaflet:{geoJSON:()=>{drawn++;return{addTo:()=>({})};}},escape:String,translate:String});
 const pending=ui.show({parkId:25,host,outer:[[]],holes:[],isCurrent:()=>true});ui.clear();release(result);await pending;assert.equal(drawn,0);
 const mismatched=ui.show({parkId:25,host,outer:[[[1,2]]],holes:[],isCurrent:()=>true});release(result);await mismatched;assert.equal(drawn,0);
 const current=ui.show({parkId:25,host,outer:[[]],holes:[],isCurrent:()=>true});release(result);await current;assert.equal(drawn,1);
});
