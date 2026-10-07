-- Preserve existing authorization predicates; evaluate identity once per query.
set lock_timeout = '3s';
set statement_timeout = '30s';
alter policy "dreq_insert" on public."data_requests" with check (((user_id = (select auth.uid())) AND (select private.is_active())));
alter policy "dreq_select" on public."data_requests" using (((user_id = (select auth.uid())) OR (select private.is_admin())));
alter policy "dreq_update" on public."data_requests" using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "meas_delete" on public."measurements" using (((owner = (select auth.uid())) OR (select private.is_admin())));
alter policy "meas_insert" on public."measurements" with check (((owner = (select auth.uid())) AND (select private.is_active())));
alter policy "meas_select" on public."measurements" using (((status = 'Onaylı'::text) OR (((select auth.role()) = 'authenticated'::text) AND ((owner = (select auth.uid())) OR (select private.is_admin()) OR ((park_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM projects pr
  WHERE ((pr.id = measurements.project_id) AND (pr.park_id = measurements.park_id) AND (pr.owner = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM park_collaborators c
  WHERE ((c.park_id = measurements.park_id) AND (c.user_id = (select auth.uid())))))))))));
alter policy "meas_update" on public."measurements" using ((((owner = (select auth.uid())) AND (select private.is_active())) OR (select private.is_admin()))) with check ((((owner = (select auth.uid())) AND (select private.is_active())) OR (select private.is_admin())));
alter policy "collab_select" on public."park_collaborators" using (((user_id = (select auth.uid())) OR (select private.is_admin()) OR (EXISTS ( SELECT 1
   FROM projects pr
  WHERE ((pr.park_id = park_collaborators.park_id) AND (pr.owner = (select auth.uid())))))));
alter policy "invites_select" on public."park_invites" using (((invited_by = (select auth.uid())) OR (lower(email) = ( SELECT lower(p.email) AS lower
   FROM profiles p
  WHERE (p.id = (select auth.uid())))) OR (select private.is_admin()) OR (EXISTS ( SELECT 1
   FROM projects pr
  WHERE ((pr.park_id = park_invites.park_id) AND (pr.owner = (select auth.uid())))))));
alter policy "parks_delete" on public."parks" using ((select private.is_admin()));
alter policy "parks_insert" on public."parks" with check (((created_by = (select auth.uid())) AND (select private.is_active())));
alter policy "parks_update" on public."parks" using (((created_by = (select auth.uid())) OR (select private.is_admin()))) with check (((created_by = (select auth.uid())) OR (select private.is_admin())));
alter policy "profiles_select" on public."profiles" using (((id = (select auth.uid())) OR (select private.is_admin())));
alter policy "profiles_update" on public."profiles" using (((id = (select auth.uid())) OR (select private.is_owner()))) with check (((id = (select auth.uid())) OR (select private.is_owner())));
alter policy "projects_delete" on public."projects" using (((owner = (select auth.uid())) OR (select private.is_owner())));
alter policy "projects_insert" on public."projects" with check (((owner = (select auth.uid())) AND (select private.is_active())));
alter policy "projects_update" on public."projects" using (((owner = (select auth.uid())) OR (select private.is_owner()) OR (select private.is_admin()))) with check (((owner = (select auth.uid())) OR (select private.is_owner()) OR (select private.is_admin())));
alter policy "report_requests_delete" on public."report_requests" using ((select private.is_admin()));
alter policy "report_requests_insert" on public."report_requests" with check (((select private.is_admin()) OR ((requested_by = (select auth.uid())) AND (select private.is_active()) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.owner = (select auth.uid())) AND (p.park_id = report_requests.park_id)))))));
alter policy "report_requests_update" on public."report_requests" using ((((select private.is_admin()) OR (requested_by = (select auth.uid()))) AND (status = 'Beklemede'::text))) with check ((((select private.is_admin()) OR (requested_by = (select auth.uid()))) AND (status = 'Vazgeçildi'::text)));
alter policy "report_retractions_delete" on public."report_retractions" using ((select private.is_admin()));
alter policy "report_retractions_insert" on public."report_retractions" with check (((requested_by = (select auth.uid())) AND ((select private.is_admin()) OR ((select private.is_active()) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.owner = (select auth.uid())) AND (p.park_id = report_retractions.park_id))))))));
alter policy "site_visits_insert" on public."site_visits" with check (true);
alter policy "site_visits_select" on public."site_visits" using ((select private.is_admin()));
alter policy "surface_reviews_insert" on public."surface_reviews" with check ((( SELECT auth.uid() AS uid) = owner));
alter policy "wp_delete" on public."waypoints" using (((owner = (select auth.uid())) OR (select private.is_admin()) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = waypoints.project_id) AND (p.owner = (select auth.uid())))))));
alter policy "wp_insert" on public."waypoints" with check (((owner = (select auth.uid())) OR (select private.is_admin())));
alter policy "wp_update" on public."waypoints" using (((owner = (select auth.uid())) OR (select private.is_admin()) OR (owner IS NULL) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = waypoints.project_id) AND (p.owner = (select auth.uid()))))))) with check (((owner = (select auth.uid())) OR (select private.is_admin()) OR (owner IS NULL) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = waypoints.project_id) AND (p.owner = (select auth.uid())))))));

create index if not exists idx_measurements_geo_override_by on public.measurements(geo_override_by);
create index if not exists idx_measurements_reviewed_by on public.measurements(reviewed_by);
create index if not exists idx_park_collaborators_user_id on public.park_collaborators(user_id);
create index if not exists idx_park_invites_invited_by on public.park_invites(invited_by);
create index if not exists idx_parks_created_by on public.parks(created_by);
create index if not exists idx_projects_owner on public.projects(owner);
create index if not exists idx_report_requests_requested_by on public.report_requests(requested_by);
create index if not exists idx_surface_reviews_park_id on public.surface_reviews(park_id);

-- The unique client_id index covers both duplicate nonunique indexes.
do $$begin
 if not exists(select 1 from pg_index where indexrelid='public.measurements_client_id_unique'::regclass and indisunique and indisvalid) then
  raise exception 'Unique client_id index must remain valid';
 end if;
end $$;
drop index if exists public.idx_measurements_client;
drop index if exists public.idx_measurements_client_id;
analyze public.measurements, public.projects, public.park_collaborators, public.report_requests, public.surface_reviews;
