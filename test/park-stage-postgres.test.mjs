import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase/migrations/20261024190000_park_stage_scopes.sql',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../supabase/migrations/0007_geo_fence.sql',import.meta.url),'utf8');
const square=(a,b,s)=>[[a,b],[a,b+s],[a+s,b+s],[a+s,b],[a,b]];
test('Isolated PostgreSQL: stage identity, exact fence, project separation, immutability, RLS and legacy preservation',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
   create table public.parks(id bigint generated always as identity primary key,osm_key text unique,osm_type text,name text,name_norm text,source text,created_by uuid,centroid_lat float8,centroid_lon float8,area_m2 float8,geom_json jsonb,country text,city text);
   create table public.projects(id bigint primary key,park_id bigint references public.parks,owner uuid);
   create table public.measurements(id bigint generated always as identity primary key,project_id bigint references public.projects,park_id bigint references public.parks,lat float8,lon float8,status text);
   alter table public.parks enable row level security;create policy read_park on public.parks for select to authenticated using(true);
   create policy insert_park on public.parks for insert to authenticated with check(created_by=auth.uid());
   create policy update_park on public.parks for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
   grant select,insert,update on public.parks,public.projects,public.measurements to authenticated;
   grant usage on all sequences in schema public to authenticated;
   insert into public.parks(osm_key,name,name_norm,source,area_m2)values('way/1','Ana Park','ana park','osm',500);
   insert into public.projects(id,park_id)values(1,1);insert into public.measurements(project_id,park_id,lat,lon,status)values(1,1,0,0,'Onaylandı');`);
  const start=legacy.indexOf('create or replace function public.dg_point_in_ring'),end=legacy.indexOf('/* Geometrisi henüz');
  await db.exec(legacy.slice(start,end));
  const before=(await db.query('select * from public.measurements')).rows;
  await db.exec(migration);await db.exec(migration);
  assert.deepEqual((await db.query('select * from public.measurements')).rows,before);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';`);
  assert.equal((await db.query('select public.dg_park_stage_ready() version')).rows[0].version,1);
  const geom={outer:[square(39,32,.01)],inner:[square(39.002,32.002,.002)]};
  const create=()=>db.query('select public.dg_create_park_stage(1,$1,$2::jsonb) scope',['Bölüm 1',JSON.stringify(geom)]);
  const stage=(await create()).rows[0].scope;
  assert.match(stage.osm_key,/^stage\/1\/[a-f0-9]{32}$/);assert.equal(stage.geom_json.stage_scope.definition,'user-defined');
  assert.equal((await create()).rows[0].scope.id,stage.id);
  await db.query('insert into public.projects(id,park_id)values(2,$1)',[stage.id]);
  await db.query('insert into public.measurements(project_id,park_id,lat,lon)values(2,$1,39.001,32.001)',[stage.id]);
  for(const [lat,lon] of [[39.003,32.003],[39.005,32.01001],[39.2,32.2],[null,32.005],[100,32.005],['NaN',32.005]]){
   await assert.rejects(db.query('insert into public.measurements(project_id,park_id,lat,lon)values(2,$1,$2,$3)',[stage.id,lat,lon]),/STAGE_OUTSIDE/);
  }
  await assert.rejects(db.query('insert into public.measurements(project_id,park_id,lat,lon)values(1,$1,39.001,32.001)',[stage.id]),/STAGE_PROJECT_MISMATCH/);
  await assert.rejects(db.query('insert into public.measurements(project_id,park_id,lat,lon)values(2,1,39.001,32.001)'),/STAGE_PROJECT_MISMATCH/);
  await assert.rejects(db.query('update public.projects set park_id=$1 where id=1',[stage.id]),/STAGE_NEW_PROJECT_REQUIRED/);
  await assert.rejects(db.query('update public.parks set geom_json=null where id=$1',[stage.id]),/STAGE_IMMUTABLE/);
  await assert.rejects(db.query("select public.dg_create_park_stage(1,'Bozuk',$1::jsonb)",[JSON.stringify({outer:[[[39,32],[40,33],[39,33],[40,32],[39,32]]],inner:[]})]),/STAGE_INVALID_RING/);
  await db.query("update public.measurements set status='Onaylandı' where id=1");
  assert.deepEqual((await db.query('select * from public.measurements where id=1')).rows,before);
  await db.exec("reset role;set role anon;");
  await assert.rejects(db.query('select public.dg_create_park_stage(1,$1,$2::jsonb)',['Yetkisiz',JSON.stringify(geom)]),/permission denied/);
  await db.exec("reset role;");
  assert.equal((await db.query("select count(*)::integer n from public.parks where osm_key='way/1' and geom_json is null")).rows[0].n,1);
 }finally{await db.close();}
});
