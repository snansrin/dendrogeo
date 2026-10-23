-- DendroGeo · 20 Oct 2026 · least-privilege field waypoint reads.
-- PR preflight identified 10 projects/154 waypoints visible to all signed-in
-- users. While QA was running, another security deployment ALREADY narrowed
-- projects_select to owner/admin/park collaboration. This migration MUST NOT
-- overwrite it; only the still-broad waypoint SELECT policy is replaced.
-- Fail closed if the project policy regresses to unconditional true.
-- Compatible with owned projects and existing park collaborator memberships.
-- No data mutation, no schema changes, no GIS/measurement/carbon changes.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
DECLARE project_read_rule text;
BEGIN
  SELECT qual INTO project_read_rule FROM pg_policies
    WHERE schemaname='public' AND tablename='projects'
      AND policyname='projects_select' AND cmd='SELECT';
  IF project_read_rule IS NULL
     OR btrim(project_read_rule, ' ()') = 'true'
     OR position('dg_is_park_member' in project_read_rule) = 0
     OR position('auth.uid' in project_read_rule) = 0
  THEN
     RAISE EXCEPTION 'projects_select must already be restricted before waypoint policy update';
  END IF;
END $guard$;

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
