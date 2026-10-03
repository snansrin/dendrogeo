-- Run after the request gate, whether it captures legacy areas or only validates permissions.
-- Always derive the snapshot from the requester's saved record, never from client JSON.
create or replace function public.dg_capture_surface_report() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare sr public.surface_reviews%rowtype; saved jsonb; areas jsonb;
begin
 if TG_OP='UPDATE' then
  new.surface_snapshot:=old.surface_snapshot;
  if old.surface_snapshot is not null and new.park_id is distinct from old.park_id then
   raise exception 'Kayıtlı analiz başka bir parka taşınamaz';
  end if;
  return new;
 end if;
 new.surface_snapshot:=null;
 if new.requested_by is distinct from auth.uid() or auth.uid() is null then return new; end if;
 select * into sr from public.surface_reviews where owner=auth.uid() and park_id=new.park_id;
 if not found then return new; end if;
 saved:=sr.payload->'acceptedResult';
 if saved is not null and saved<>'null'::jsonb then
  if saved->>'schema' is distinct from 'dendrogeo-surface/2'
     or saved->>'parkId' is distinct from new.park_id::text
     or nullif(saved->>'acceptedAt','') is null then raise exception 'Kayıtlı analiz geçersiz'; end if;
  new.surface_snapshot:=saved;
  new.with_lulc:=true;
 elsif jsonb_typeof(sr.payload->'acceptedAreas')='object' and nullif(sr.payload->>'acceptedAt','') is not null then
  areas:=sr.payload->'acceptedAreas';
  select jsonb_object_agg(k,case when jsonb_typeof(areas->k)='number' then areas->k else '0'::jsonb end)
   into areas from unnest(array['green','hard','building','water','pool','bare','other']) k;
  new.surface_snapshot:=jsonb_build_object('schema','dendrogeo-surface-accepted/1',
   'revision',sr.revision,'source_fingerprint',sr.source_fingerprint,
   'accepted_at',sr.payload->>'acceptedAt','areas_m2',areas);
  new.with_lulc:=false;
 end if;
 return new;
end $$;
revoke all on function public.dg_capture_surface_report() from public,anon;
grant execute on function public.dg_capture_surface_report() to authenticated;
comment on column public.report_requests.surface_snapshot is 'Immutable accepted result at request time: v2 carries reviewed public park geometry; v1 retains legacy area-only records. Private profiles and drafts are excluded.';
