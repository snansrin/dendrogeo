-- Disposable LOCAL database only. The CI runner connects to 127.0.0.1:54322.
-- All synthetic rows and probe objects are rolled back.
begin;
do $$
begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')<>13 then
  raise exception 'RESET_CONTRACT: expected 13 public application tables';
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then
  raise exception 'RESET_CONTRACT: unprotected public application table';
 end if;
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='dendro_photos_public_read') then
  raise exception 'RESET_CONTRACT: retired anonymous photo listing policy';
 end if;
 if not exists(select 1 from storage.buckets where id='dendro-photos' and public and file_size_limit=8388608 and allowed_mime_types=array['image/jpeg']::text[]) then
  raise exception 'RESET_CONTRACT: public photo URL compatibility / upload limits differ';
 end if;
end $$;

insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001','reset-one@example.invalid','{}',now()),
 ('00000000-0000-0000-0000-000000000002','reset-two@example.invalid','{}',now());
insert into public.parks(osm_key,name,name_norm,created_by) values
 ('manual/reset-one','Reset One','reset one','00000000-0000-0000-0000-000000000001'),
 ('manual/reset-two','Reset Two','reset two','00000000-0000-0000-0000-000000000002');
insert into public.projects(owner,name,park_id,label)
 select p.created_by,p.name,p.id,'fixture' from public.parks p where p.osm_key in('manual/reset-one','manual/reset-two');
insert into storage.objects(bucket_id,name) values
 ('dendro-photos','00000000-0000-0000-0000-000000000001/reset.jpg'),
 ('dendro-photos','00000000-0000-0000-0000-000000000002/reset.jpg');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$
begin
 if (select count(*) from public.projects)<>1 then raise exception 'RESET_CONTRACT: unrelated project exposed'; end if;
 if (select count(*) from storage.objects where bucket_id='dendro-photos')<>1 then raise exception 'RESET_CONTRACT: other-account photo exposed or own photo denied'; end if;
end $$;

reset role;
insert into public.park_collaborators(park_id,user_id)
 select id,'00000000-0000-0000-0000-000000000001'::uuid from public.parks where osm_key='manual/reset-two';
set local role authenticated;
do $$ begin
 if (select count(*) from public.projects)<>2 then raise exception 'RESET_CONTRACT: park collaboration access broken'; end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if has_table_privilege('anon','storage.objects','SELECT') then
  if exists(select 1 from storage.objects where bucket_id='dendro-photos') then raise exception 'RESET_CONTRACT: anonymous photo enumeration'; end if;
 end if;
end $$;

reset role;
create table public.reset_future_access_probe(id bigint generated always as identity);
do $$ declare api_role text; begin
 foreach api_role in array array['anon','authenticated','service_role'] loop
  if has_table_privilege(api_role,'public.reset_future_access_probe','SELECT,INSERT,UPDATE,DELETE')
   or has_sequence_privilege(api_role,'public.reset_future_access_probe_id_seq','USAGE,SELECT') then
   raise exception 'RESET_CONTRACT: future object exposed automatically to %',api_role;
  end if;
 end loop;
end $$;
rollback;
