-- Publish only the requesting user's explicitly accepted result. Private drafts stay private.
alter table public.report_requests add column if not exists surface_snapshot jsonb;
create or replace function public.dg_capture_surface_report() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare saved jsonb;
begin
 if TG_OP='UPDATE' then
  new.surface_snapshot:=old.surface_snapshot;
  if old.surface_snapshot is not null and new.park_id<>old.park_id then
   raise exception 'Kayıtlı analiz başka bir parka taşınamaz';
  end if;
  return new;
 end if;
 new.surface_snapshot:=null;
 if new.with_lulc is true and new.requested_by=auth.uid() then
  select payload->'acceptedResult' into saved from public.surface_reviews
   where owner=auth.uid() and park_id=new.park_id;
  if saved is not null and saved<>'null'::jsonb then
   if saved->>'schema'<>'dendrogeo-surface/2' or saved->>'parkId'<>new.park_id::text
      or saved->>'acceptedAt' is null then raise exception 'Kayıtlı analiz geçersiz'; end if;
   new.surface_snapshot:=saved;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.dg_capture_surface_report() from public,anon;
grant execute on function public.dg_capture_surface_report() to authenticated;
drop trigger if exists trg_surface_report_snapshot on public.report_requests;
create trigger trg_surface_report_snapshot before insert or update on public.report_requests
 for each row execute function public.dg_capture_surface_report();
comment on column public.report_requests.surface_snapshot is 'Immutable accepted surface result selected at publication request time; excludes private profiles and drafts.';
