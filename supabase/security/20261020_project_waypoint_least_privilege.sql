-- DendroGeo · Least-privilege reads for private measurement projects/grid.
-- Applied to Supabase only after offline CI + read-only rollback validation.
-- BEFORE: projects_select / wp_select returned TRUE for EVERY authenticated
-- visitor; any signed-in account could enumerate all 10 projects and 154
-- waypoint coordinates even with no authenticated user claim.
--
-- AFTER: owner, approved collaboration on the linked park, or DendroGeo
-- owner/admin. The existing public park discovery, published measurements,
-- mobile GIS engine, tree formulae and all table data stay unchanged.
-- The established private.is_admin and dg_is_park_member functions already
-- use verified auth.uid(), project ownership and park_collaborators.
-- No grants are broadened; anon gets no SELECT. Do not put this migration
-- into user-facing app JavaScript or bypass policies with a service key.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT TO authenticated
  USING (
    owner = (SELECT auth.uid())
    OR (SELECT private.is_admin())
    OR (
      park_id IS NOT NULL
      AND public.dg_is_park_member(park_id)
    )
  );

DROP POLICY IF EXISTS "wp_select" ON public.waypoints;
CREATE POLICY "wp_select" ON public.waypoints
  FOR SELECT TO authenticated
  USING (
    owner = (SELECT auth.uid())
    OR (SELECT private.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.projects pr
      WHERE pr.id = waypoints.project_id
        AND (
          pr.owner = (SELECT auth.uid())
          OR (
            pr.park_id IS NOT NULL
            AND public.dg_is_park_member(pr.park_id)
          )
        )
    )
  );
COMMIT;
