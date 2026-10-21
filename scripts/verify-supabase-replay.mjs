#!/usr/bin/env node
// Offline SQL replay only. This does not run the Supabase Docker services.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';

const db=new PGlite();
const directory=new URL('../supabase/migrations/',import.meta.url);
const files=readdirSync(directory).filter(name=>name.endsWith('.sql')).sort();
const completed=[];
try{
 // Minimal managed-platform interfaces referenced by application migrations.
 // These are test doubles, not a snapshot of Supabase internal schemas.
 await db.exec(`
  create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create schema storage;create schema realtime;create schema extensions;
  create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz,created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
  create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
  create table realtime.messages(id bigint generated always as identity,extension text,topic text,payload jsonb);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$select current_setting('test.realtime_topic',true)$$;
  grant usage on schema auth,storage,realtime to anon,authenticated,service_role;
  grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
 `);
 for(const name of files){
  try{await db.exec(readFileSync(new URL(name,directory),'utf8'));completed.push(name);}
  catch(error){console.log(JSON.stringify({status:'failed',engine:'PGlite',platform:'test doubles',completed:completed.length,total:files.length,failedMigration:name,code:error.code,message:error.message,detail:error.detail||null},null,2));process.exitCode=1;break;}
 }
 if(completed.length===files.length){
  const result=await db.query("select version(),(select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') as public_tables");
  await db.exec(readFileSync(new URL('../supabase/tests/reset-contract.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('20261021112046_replay_security_parity.sql',directory),'utf8'));
  const report={status:'passed',engine:'PGlite',platform:'test doubles',contracts:'passed',securityMigrationIdempotent:true,completed:completed.length,total:files.length,...result.rows[0]};
  if(process.argv[2]){
   const expected=JSON.parse(readFileSync(process.argv[2],'utf8'));
   const local=(await db.query(`select jsonb_build_object('columns',(select jsonb_agg(jsonb_build_object('schema',c.table_schema,'table',c.table_name,'column',c.column_name,'type',c.udt_name,'nullable',c.is_nullable,'default',c.column_default,'identity',c.identity_generation)) from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name where c.table_schema in('public','dg_archive') and t.table_type='BASE TABLE'),'policies',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'roles',roles::text,'cmd',cmd,'using',qual,'check',with_check)) from pg_policies where schemaname in('public','dg_archive','storage','realtime')),'views',(select jsonb_agg(jsonb_build_object('name',c.relname,'options',c.reloptions)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v')) as catalog`)).rows[0].catalog;
   const stable=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
   report.catalogDifferences={};
   for(const category of ['columns','policies','views']){
    const key=item=>[item.schema,item.table,item.column||item.name].filter(Boolean).join('.');
    const target=new Map(expected[category].map(item=>[key(item),item]));
    const actual=new Map(local[category].map(item=>[key(item),item]));
    report.catalogDifferences[category]={
     missing:[...target.keys()].filter(name=>!actual.has(name)),
     extra:[...actual.keys()].filter(name=>!target.has(name)),
     changed:[...target.keys()].filter(name=>actual.has(name)&&stable(target.get(name))!==stable(actual.get(name))).map(name=>({name,expected:target.get(name),actual:actual.get(name)}))
    };
   }
   if(Object.values(report.catalogDifferences).some(diff=>diff.missing.length||diff.extra.length||diff.changed.length)){report.status='catalog-drift';process.exitCode=1;}
  }
  console.log(JSON.stringify(report,null,2));
 }
}finally{await db.close();}
