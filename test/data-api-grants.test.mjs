import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {auditDataApiMigration} from '../scripts/lib/data-api-migration-policy.mjs';

const migrationName='20261021111211_explicit_data_api_grants.sql';
const migration=readFileSync(new URL('../supabase/migrations/'+migrationName,import.meta.url),'utf8');
const tables=['profiles','projects','measurements','waypoints','parks','site_visits','data_requests',
 'report_requests','report_retractions','park_invites','park_collaborators','surface_reviews','site_metric_daily'];
const identities=['projects','measurements','waypoints','parks','site_visits','data_requests'];
const authOperations={profiles:['SELECT','UPDATE'],projects:['SELECT','INSERT','UPDATE','DELETE'],
 measurements:['SELECT','INSERT','UPDATE','DELETE'],waypoints:['SELECT','INSERT','UPDATE','DELETE'],
 parks:['SELECT','INSERT','UPDATE','DELETE'],site_visits:['SELECT','INSERT'],
 data_requests:['SELECT','INSERT','UPDATE','DELETE'],report_requests:['SELECT','INSERT','UPDATE','DELETE'],
 report_retractions:['SELECT','INSERT','DELETE'],park_invites:['SELECT'],park_collaborators:['SELECT'],
 surface_reviews:['SELECT','INSERT','UPDATE'],site_metric_daily:['SELECT']};
const views={v_global:'measurements',v_country:'measurements',v_city:'measurements',v_world_agg:'measurements',
 v_park_compare:'measurements',v_my_parks:'projects',v_report_authors:'profiles'};

async function fixture(legacy=false){
 const db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 if(legacy)await db.exec(`alter default privileges for role postgres in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
  alter default privileges for role postgres in schema public grant usage,select on sequences to anon,authenticated,service_role;`);
 for(const table of tables){
  await db.exec(`create table public.${table}(id ${identities.includes(table)?'bigint generated always as identity':'uuid default gen_random_uuid()'} primary key,owner text,payload text,shared boolean default false);
   alter table public.${table} enable row level security;
   create policy owner_access on public.${table} for all to authenticated using(owner=current_setting('test.user_id',true)) with check(owner=current_setting('test.user_id',true));
   insert into public.${table}(owner,payload,shared) values('alice','private',false),('bob','public',true);`);
 }
 await db.exec("create policy approved_read on public.measurements for select to anon using(shared);create policy park_read on public.parks for select to anon using(true);create policy visit_write on public.site_visits for insert to anon with check(true);");
 for(const [view,table] of Object.entries(views))await db.exec(`create view public.${view} with(security_invoker=true) as select * from public.${table};`);
 return db;
}
async function policies(db){return(await db.query("select tablename,policyname,roles::text,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows;}
async function acl(db){return(await db.query("select c.relname,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','v','S') order by c.relname")).rows;}

test('explicit grants work with zero platform defaults, preserve RLS, and are idempotent',async()=>{
 const db=await fixture();
 try{
  const before=await policies(db);await db.exec(migration);const access=await acl(db);await db.exec(migration);
  assert.deepEqual(await acl(db),access);assert.deepEqual(await policies(db),before);
  for(const table of tables)for(const role of ['anon','authenticated','service_role'])for(const operation of ['SELECT','INSERT','UPDATE','DELETE']){
   const expected=role==='service_role'||(role==='authenticated'?authOperations[table].includes(operation):
    operation==='SELECT'&&['measurements','parks'].includes(table)||operation==='INSERT'&&table==='site_visits');
   const result=await db.query('select has_table_privilege($1,$2,$3) as allowed',[role,'public.'+table,operation]);
   assert.equal(result.rows[0].allowed,expected,`${role} ${operation} ${table}`);
  }
  for(const view of Object.keys(views)){
   const result=await db.query("select has_table_privilege('anon',$1,'SELECT') as allowed",['public.'+view]);
   assert.equal(result.rows[0].allowed,['v_global','v_country','v_city','v_world_agg'].includes(view));
  }
  await db.exec("set role authenticated;select set_config('test.user_id','alice',false);");
  assert.deepEqual((await db.query('select owner from public.projects')).rows,[{owner:'alice'}]);
  await db.exec("insert into public.projects(owner,payload) values('alice','new');");
  await assert.rejects(db.exec("update public.projects set owner='bob' where owner='alice'"),/row-level security/);
  await assert.rejects(db.exec("insert into public.profiles(owner) values('alice')"),/permission denied/);
  await db.exec('reset role;set role anon;');
  assert.deepEqual((await db.query('select owner from public.measurements')).rows,[{owner:'bob'}]);
  await assert.rejects(db.exec('select * from public.profiles'),/permission denied/);
  await assert.rejects(db.exec('select * from public.park_invites'),/permission denied/);
  await db.exec('insert into public.site_visits(owner) values(null);reset role;set role service_role;');
  assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n,2);
 }finally{await db.close();}
});

test('rollout preserves existing legacy ACLs but stops automatic access for future postgres objects',async()=>{
 const db=await fixture(true);
 try{
  const before=await acl(db);await db.exec(migration);assert.deepEqual(await acl(db),before);
  await db.exec('create table public.future_private(id bigint generated always as identity);');
  for(const role of ['anon','authenticated','service_role']){
   const result=await db.query("select has_table_privilege($1,'public.future_private','SELECT,INSERT,UPDATE,DELETE') as table_access,has_sequence_privilege($1,'public.future_private_id_seq','USAGE,SELECT') as sequence_access",[role]);
   assert.deepEqual(result.rows[0],{table_access:false,sequence_access:false});
  }
 }finally{await db.close();}
});

test('missing RLS aborts before any grant can expose a table',async()=>{
 const db=await fixture();
 try{
  await db.exec('alter table public.profiles disable row level security;');const before=await acl(db);
  await assert.rejects(db.exec(migration),/DATA_API_RLS_REQUIRED/);await db.exec('rollback');
  assert.deepEqual(await acl(db),before);
 }finally{await db.close();}
});

test('reusable owner-table template runs with no grants and rejects other-account access',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;
   insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
  await db.exec(readFileSync(new URL('../supabase/templates/owner-table.sql.example',import.meta.url),'utf8'));
  await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);insert into public.research_notes(user_id,note) values('00000000-0000-0000-0000-000000000001','test');");
  await assert.rejects(db.exec("update public.research_notes set user_id='00000000-0000-0000-0000-000000000002'"),/row-level security/);
  await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);");
  assert.equal((await db.query('select * from public.research_notes')).rows.length,0);
  await db.exec('reset role;set role anon;');
  await assert.rejects(db.exec('select * from public.research_notes'),/permission denied/);
  await db.exec('reset role;set role service_role;');
  assert.equal((await db.query('select * from public.research_notes')).rows.length,1);
 }finally{await db.close();}
});

test('new public tables require same-migration RLS, explicit exposure and legacy revokes',()=>{
 const template=readFileSync(new URL('../supabase/templates/owner-table.sql.example',import.meta.url),'utf8');
 assert.deepEqual(auditDataApiMigration(template),[]);
 assert.ok(auditDataApiMigration('create table public.forgotten(id int);').length>=3);
 assert.ok(auditDataApiMigration(template.replace('enable row level security','disable row level security')).some(e=>e.includes('enable RLS')));
 assert.ok(auditDataApiMigration(template.replace(/grant[^;]+;/g,'')).some(e=>e.includes('grant required API')));
 assert.ok(auditDataApiMigration(template.replace('public, anon, authenticated','anon, authenticated')).some(e=>e.includes('explicitly revoke')));
 assert.deepEqual(auditDataApiMigration('create table private.internal(id int);'),[]);
 const internal='-- data-api: internal public.internal\ncreate table public.internal(id int);alter table public.internal enable row level security;revoke all on public.internal from public,anon,authenticated;';
 assert.deepEqual(auditDataApiMigration(internal),[]);
 assert.ok(auditDataApiMigration('grant select on all tables in schema public to anon;').length);
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 for(const name of readdirSync(migrations).filter(name=>name>=migrationName&&name.endsWith('.sql')))
  assert.deepEqual(auditDataApiMigration(readFileSync(new URL(name,migrations),'utf8')),[],name);
 assert.match(readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8'),/^auto_expose_new_tables\s*=\s*false\s*$/m);
});
