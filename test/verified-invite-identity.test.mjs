import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('../',import.meta.url);
const migration=()=>process.env.DG_INVITE_MIGRATION?readFileSync(process.env.DG_INVITE_MIGRATION,'utf8'):readFileSync(new URL('supabase/migrations/'+readdirSync(new URL('supabase/migrations/',root)).find(p=>p.endsWith('_verified_invite_identity.sql')),root),'utf8');
const UID1='00000000-0000-0000-0000-000000000001',UID2='00000000-0000-0000-0000-000000000002',UID3='00000000-0000-0000-0000-000000000003';
const INV='10000000-0000-0000-0000-000000000001';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role authenticated; create role anon; create schema auth; create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function private.is_admin() returns boolean language sql stable as $$select false$$;
 grant usage on schema auth,private to authenticated; grant execute on function auth.uid(),private.is_admin() to authenticated;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table public.profiles(id uuid primary key,email text);
 create table public.projects(park_id bigint,owner uuid);
 create table public.park_invites(id uuid primary key,park_id bigint,email text,invited_by uuid,status text,responded_at timestamptz);
 create table public.park_collaborators(park_id bigint,user_id uuid,primary key(park_id,user_id));
 alter table public.park_invites enable row level security;
 create policy invites_select on public.park_invites for select to authenticated using(true);
 grant select on public.park_invites,public.projects to authenticated;
 insert into auth.users values ('${UID1}','attacker@example.invalid',now()),('${UID2}','recipient@example.invalid',now()),('${UID3}','recipient@example.invalid',null);
 insert into public.profiles values ('${UID1}','recipient@example.invalid'),('${UID2}','stale@example.invalid'),('${UID3}','recipient@example.invalid');
 insert into public.park_invites values ('${INV}',25,'recipient@example.invalid',null,'Beklemede',null);`);
 const original=readFileSync(new URL('supabase/migrations/0025_park_invites.sql',root),'utf8').match(/create or replace function public\.dg_invite_respond[\s\S]*?end \$\$;/i)[0];
 await db.exec(original);await db.exec(migration());return db;
}
async function identity(db,uid){await db.exec('reset role');await db.query("select set_config('request.uid',$1,false)",[uid]);await db.exec('set role authenticated');}
test('editable profile email cannot reveal or accept another account invitation',async()=>{
 const db=await fixture();try{await identity(db,UID1);
 assert.equal((await db.query('select * from public.park_invites')).rows.length,0);
 await assert.rejects(db.query('select public.dg_invite_respond($1,true)',[INV]),/INVITE_NOT_YOURS/);
 await db.exec('reset role');assert.equal((await db.query('select * from public.park_collaborators')).rows.length,0);
 }finally{await db.close();}
});
test('verified recipient works even with a stale profile email; closed invites cannot be reused',async()=>{
 const db=await fixture();try{await identity(db,UID2);
 assert.equal((await db.query('select * from public.park_invites')).rows.length,1);
 await db.query('select public.dg_invite_respond($1,true)',[INV]);
 await assert.rejects(db.query('select public.dg_invite_respond($1,true)',[INV]),/INVITE_CLOSED/);
 await db.exec('reset role');assert.equal((await db.query('select user_id from public.park_collaborators')).rows[0].user_id,UID2);
 }finally{await db.close();}
});
test('unconfirmed emails are not identities; verified recipient may decline',async()=>{
 const db=await fixture();try{await identity(db,UID3);
 assert.equal((await db.query('select * from public.park_invites')).rows.length,0);
 await assert.rejects(db.query('select public.dg_invite_respond($1,true)',[INV]),/INVITE_NOT_YOURS/);
 await identity(db,UID2);await db.query('select public.dg_invite_respond($1,false)',[INV]);await db.exec('reset role');
 assert.equal((await db.query('select status from public.park_invites')).rows[0].status,'Red');
 assert.equal((await db.query('select * from public.park_collaborators')).rows.length,0);
 }finally{await db.close();}
});
