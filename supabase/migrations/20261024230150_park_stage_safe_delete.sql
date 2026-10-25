-- Additive stage-only deletion. Existing parks, measurements and reports are not changed.
create or replace function private.dg_guard_empty_stage_delete() returns trigger
language plpgsql security definer set search_path='' as $$
declare ref record; linked boolean;
begin
 if old.osm_key not like 'stage/%' then return old; end if;
 -- A delete already holds the parent tuple lock. FK inserts cannot race past it.
 -- Definer visibility is required here: RLS-hidden dependencies must also block
 -- ON DELETE CASCADE / SET NULL. Catalog identifiers, never user SQL, are quoted.
 for ref in
  select n.nspname,t.relname,a.attname
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class t on t.oid=c.conrelid
  join pg_catalog.pg_namespace n on n.oid=t.relnamespace
  join lateral unnest(c.conkey,c.confkey) k(attnum,refnum) on true
  join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
  join pg_catalog.pg_attribute b on b.attrelid=c.confrelid and b.attnum=k.refnum
  where c.contype='f' and c.confrelid='public.parks'::regclass and b.attname='id'
 loop
  execute format('select exists(select 1 from %I.%I where %I=$1)',ref.nspname,ref.relname,ref.attname) into linked using old.id;
  if linked then raise exception 'STAGE_HAS_RECORDS: bağlı kayıtları bulunan etap silinemez' using errcode='23503'; end if;
 end loop;
 -- Retractions preserve a historical park id without an FK in the existing schema.
 if exists(select 1 from public.report_retractions where park_id=old.id) then
  raise exception 'STAGE_HAS_RECORDS: rapor geçmişi bulunan etap silinemez' using errcode='23503';
 end if;
 return old;
end $$;
revoke all on function private.dg_guard_empty_stage_delete() from public,anon,authenticated;
drop trigger if exists stage_empty_delete_guard on public.parks;
create trigger stage_empty_delete_guard before delete on public.parks
 for each row execute function private.dg_guard_empty_stage_delete();

-- Keep the existing admin policy; add only active owners of stage records.
drop policy if exists parks_stage_owner_delete on public.parks;
create policy parks_stage_owner_delete on public.parks for delete to authenticated
 using(osm_key ~ '^stage/[0-9]+/[a-f0-9]{32}$' and geom_json->'stage_scope'->>'schema'='dendrogeo/park-stage/1'
  and created_by=(select auth.uid()) and (select private.is_active()));

create or replace function public.dg_delete_empty_park_stage(p_stage bigint,p_key text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare stage public.parks; removed bigint;
begin
 if auth.uid() is null then raise exception 'STAGE_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into stage from public.parks where id=p_stage and osm_key=p_key;
 if stage.id is null or stage.osm_key !~ '^stage/[0-9]+/[a-f0-9]{32}$'
  or stage.geom_json->'stage_scope'->>'schema' is distinct from 'dendrogeo/park-stage/1' then
  raise exception 'STAGE_DELETE_TARGET_REQUIRED';
 end if;
 if stage.created_by is distinct from auth.uid() and not private.is_admin() then
  raise exception 'STAGE_DELETE_FORBIDDEN' using errcode='42501';
 end if;
 delete from public.parks where id=stage.id and osm_key=p_key returning id into removed;
 if removed is null then raise exception 'STAGE_DELETE_FORBIDDEN' using errcode='42501'; end if;
 return removed;
end $$;
create or replace function public.dg_park_stage_delete_ready() returns integer
language sql immutable security invoker set search_path='' as $$select 1$$;
revoke all on function public.dg_delete_empty_park_stage(bigint,text),public.dg_park_stage_delete_ready() from public,anon;
grant execute on function public.dg_delete_empty_park_stage(bigint,text),public.dg_park_stage_delete_ready() to authenticated;
