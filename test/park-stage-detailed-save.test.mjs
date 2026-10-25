import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{PGlite}from'@electric-sql/pglite';import polygon from'polygon-clipping';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),ctx=vm.createContext({window:{}});
for(const p of ['src/domain/parks/stage-geometry.js','src/domain/parks/stage-curved-boundaries.js','src/domain/parks/stage-boundary-paths.js'])vm.runInContext(read(p),ctx);
test('Detailed real Dikmen stage saves without simplifying the park while topology and size guards remain enforced',async()=>{
 const parent=JSON.parse(read('test/fixtures/park-stages/dikmen-boundary.json')).geometry,before=JSON.stringify(parent),points=parent.outer.flat(),xs=points.map(p=>p[1]),ys=points.map(p=>p[0]),left=Math.min(...xs),right=Math.max(...xs),lo=Math.min(...ys),hi=Math.max(...ys);
 const cuts=[.00001,.99999].map(y=>Array.from({length:11},(_,i)=>[lo+(hi-lo)*y,left+(right-left)*i/10]));
 const result=ctx.window.DG_PARK_STAGE_BOUNDARY_PATHS.between(parent,cuts,{polygon,clip:ctx.window.DG_PARK_STAGE_GEOMETRY.clip});assert.equal(result.geometry.outer[0].length,320);assert.equal(JSON.stringify(parent),before);
 const db=new PGlite();try{
  const source=read('supabase/migrations/20261024190000_park_stage_scopes.sql'),original=source.split('create or replace function public.dg_create_park_stage')[0];await db.exec('create role anon;create role authenticated;');await db.exec(original);
  await db.exec(`create schema auth;create function auth.uid() returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
   create table public.parks(id bigint generated always as identity primary key,osm_key text unique,osm_type text,name text,name_norm text,source text,created_by uuid,centroid_lat float8,centroid_lon float8,area_m2 float8,geom_json jsonb,country text,city text);
   insert into public.parks(osm_key,name,geom_json)values('relation/14290362','Dikmen Vadisi','{}');`);
  await db.exec(source.slice(source.indexOf('create or replace function public.dg_create_park_stage'),source.indexOf('-- Existing scopes retain')));
  const create=(label,geometry)=>db.query('select public.dg_create_park_stage(1,$1,$2::jsonb) stage',[label,JSON.stringify(geometry)]);
  const valid=async ring=>(await db.query('select public.dg_stage_valid_ring($1::jsonb) valid',[JSON.stringify(ring)])).rows[0].valid;
  assert.equal(await valid(result.geometry.outer[0]),false,'reproduces STAGE_INVALID_RING from the old 301-vertex cap');
  await assert.rejects(create('2. etap',result.geometry),/STAGE_INVALID_RING/);assert.equal((await db.query('select count(*)::int n from public.parks')).rows[0].n,1);
  const migration=read('supabase/migrations/20261025071344_stage_ring_vertex_limit.sql');await db.exec(migration);await db.exec(migration);
  for(const ring of [...result.geometry.outer,...result.geometry.inner]){assert.equal(await valid(ring),true);assert.equal(ctx.window.DG_PARK_STAGE_GEOMETRY.validateRing(ring),true);}
  const saved=(await create('2. etap',result.geometry)).rows[0].stage;assert.deepEqual(saved.geom_json.outer,JSON.parse(JSON.stringify(result.geometry.outer)));
  const editedCuts=cuts.map(line=>line.map(p=>[...p]));editedCuts[0]=editedCuts[0].map(p=>[p[0]+(hi-lo)*.015,p[1]]);
  const edit=ctx.window.DG_PARK_STAGE_BOUNDARY_PATHS.between(parent,editedCuts,{polygon,clip:ctx.window.DG_PARK_STAGE_GEOMETRY.clip}),revision=(await create('2. etap · düzenleme',edit.geometry)).rows[0].stage;
  assert.notEqual(revision.id,saved.id);assert.notDeepEqual(revision.geom_json.outer,saved.geom_json.outer);assert.deepEqual((await db.query('select geom_json from public.parks where id=$1',[saved.id])).rows[0].geom_json,saved.geom_json);assert.equal(JSON.stringify(ctx.window.DG_PARK_STAGE_GEOMETRY.candidate(revision).rings.outer),JSON.stringify(edit.geometry.outer));
  const circle=n=>{const r=Array.from({length:n},(_,i)=>[39+.01*Math.sin(i*2*Math.PI/n),32+.01*Math.cos(i*2*Math.PI/n)]);return[...r,[...r[0]]];};
  for(const [ring,expected] of [[circle(1000),true],[circle(1001),false],[[[39,32],[40,33],[39,33],[40,32],[39,32]],false],[[[39,32],[39,32.01],[39.01,32],[39.0001,32]],false]]){assert.equal(await valid(ring),expected);assert.equal(ctx.window.DG_PARK_STAGE_GEOMETRY.validateRing(ring),expected);}
  assert.equal((await db.query("select has_function_privilege('anon','public.dg_stage_valid_ring(jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
