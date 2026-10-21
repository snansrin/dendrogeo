-- Data API opt-in compatibility (Supabase rollout: 2026-10-30).
-- Existing table grants and RLS policies are preserved. Historical migrations
-- are frozen; this additive migration completes their final access contract.
begin;

-- Fail atomically instead of exposing a table whose row protection is missing.
do $$
declare table_name text;
begin
 foreach table_name in array array[
  'profiles','projects','measurements','waypoints','parks','site_visits',
  'data_requests','report_requests','report_retractions','park_invites',
  'park_collaborators','surface_reviews','site_metric_daily'
 ] loop
  if not exists (
   select 1 from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=table_name
    and c.relkind in ('r','p') and c.relrowsecurity
  ) then
   raise exception 'DATA_API_RLS_REQUIRED: public.%', table_name;
  end if;
 end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Public inventory and aggregate readers. RLS still filters measurement rows.
grant select on table public.measurements, public.parks to anon;
grant insert on table public.site_visits to anon;
grant select on table public.v_global, public.v_country, public.v_city,
 public.v_world_agg to anon, authenticated, service_role;

-- Signed-in workflows; grants match existing RLS operations.
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.projects,
 public.measurements, public.waypoints, public.parks, public.data_requests,
 public.report_requests to authenticated;
grant select, insert on table public.site_visits to authenticated;
grant select, insert, delete on table public.report_retractions to authenticated;
grant select, insert, update on table public.surface_reviews to authenticated;
grant select on table public.park_invites, public.park_collaborators,
 public.site_metric_daily, public.v_park_compare, public.v_my_parks,
 public.v_report_authors to authenticated;
grant select on table public.v_park_compare, public.v_my_parks,
 public.v_report_authors to service_role;

-- Server-side report/metrics/admin workflows must not depend on default ACLs.
-- The service key remains server-only; no archive or internal schema is exposed.
grant select, insert, update, delete on table public.profiles, public.projects,
 public.measurements, public.waypoints, public.parks, public.site_visits,
 public.data_requests, public.report_requests, public.report_retractions,
 public.park_invites, public.park_collaborators, public.surface_reviews,
 public.site_metric_daily to service_role;

-- Explicit identity-sequence access; never grant on all future sequences.
grant usage, select on sequence public.site_visits_id_seq
 to anon, authenticated, service_role;
grant usage, select on sequence public.projects_id_seq,
 public.measurements_id_seq, public.waypoints_id_seq, public.parks_id_seq,
 public.data_requests_id_seq to authenticated, service_role;

-- Opt postgres-created FUTURE objects into the upcoming platform behavior.
-- This does not revoke a single existing table/sequence grant or alter RLS.
alter default privileges for role postgres in schema public
 revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
 revoke usage, select on sequences from anon, authenticated, service_role;

commit;
