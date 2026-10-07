-- Private publication data: apply ONLY after the OIDC report-reader and all
-- production workflows have passed their authenticated read health check.
-- No measurement, surface snapshot, publication or DOI data is rewritten.
set lock_timeout = '3s';
set statement_timeout = '30s';

create schema if not exists private;
revoke create on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

-- Moving the existing function preserves policy dependencies by OID. Invoker
-- compatibility wrappers keep trusted trigger bodies working without exposing
-- privileged RPC implementations in the Data API schema.
alter function public.is_admin() set schema private;
alter function public.is_owner() set schema private;
alter function public.is_active() set schema private;
alter function private.is_admin() set search_path = '';
alter function private.is_owner() set search_path = '';
alter function private.is_active() set search_path = '';
revoke all on function private.is_admin(), private.is_owner(), private.is_active() from public;
grant execute on function private.is_admin(), private.is_owner(), private.is_active() to anon, authenticated, service_role;
create function public.is_admin() returns boolean language sql stable security invoker set search_path = '' as $$select private.is_admin()$$;
create function public.is_owner() returns boolean language sql stable security invoker set search_path = '' as $$select private.is_owner()$$;
create function public.is_active() returns boolean language sql stable security invoker set search_path = '' as $$select private.is_active()$$;
revoke all on function public.is_admin(), public.is_owner(), public.is_active() from public, anon;
grant execute on function public.is_admin(), public.is_owner(), public.is_active() to authenticated, service_role;

-- Trigger functions are not RPC endpoints. Existing triggers continue running
-- with their owner's execution context; registration privileges are unchanged.
do $$declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype='trigger'::regtype loop
  execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
 end loop;
end $$;
revoke execute on function public.dg_invite_send(bigint,text,text), public.dg_invite_respond(uuid,boolean), public.dg_invite_revoke(bigint,text,text), public.dg_is_park_member(bigint) from public, anon;
grant execute on function public.dg_invite_send(bigint,text,text), public.dg_invite_respond(uuid,boolean), public.dg_invite_revoke(bigint,text,text), public.dg_is_park_member(bigint) to authenticated, service_role;
revoke execute on function public.dg_park_author(bigint) from public, anon, authenticated;
grant execute on function public.dg_park_author(bigint) to service_role;

alter function public.touch_parks() set search_path = '';
alter function public.dg_tr_title(text) set search_path = '';
alter function public.park_name_case() set search_path = '';
alter function public.dg_hav_m(double precision,double precision,double precision,double precision) set search_path = '';
alter function public.dg_point_in_ring(double precision,double precision,jsonb) set search_path = '';
alter function public.dg_point_in_park(double precision,double precision,jsonb) set search_path = '';
alter function public.dg_park_radius_m(double precision) set search_path = '';
alter function public.tg_project_requires_park() set search_path = '';

alter view public.v_my_parks set (security_invoker=true);
alter view public.v_report_authors set (security_invoker=true);
revoke all on public.v_my_parks, public.v_report_authors from anon;
grant select on public.v_my_parks, public.v_report_authors to authenticated, service_role;
revoke select on public.report_requests, public.report_retractions from anon;
grant select on public.report_requests, public.report_retractions to authenticated, service_role;
alter policy report_requests_select on public.report_requests to authenticated using (requested_by=(select auth.uid()) or (select private.is_admin()));
alter policy report_retractions_select on public.report_retractions to authenticated using (requested_by=(select auth.uid()) or (select private.is_admin()));

-- Retain the historical backup and its rows; remove it from the exposed schema.
create schema if not exists dg_archive;
revoke all on schema dg_archive from public, anon, authenticated;
alter table public.measurements_bak_0011 set schema dg_archive;
revoke all on dg_archive.measurements_bak_0011 from public, anon, authenticated;
