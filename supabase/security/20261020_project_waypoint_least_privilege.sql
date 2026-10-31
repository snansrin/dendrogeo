-- DendroGeo: least-privilege waypoint operations and policy maintenance.
-- Additive migration: no existing record, measurement, allometry or GIS data changes.
-- Preserve project owner's access, project-authorized collaborators and administrators.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
DECLARE project_rule text; admin_delete_rule text; stage_delete_rule text;
BEGIN
  SELECT qual INTO project_rule FROM pg_policies
   WHERE schemaname='public' AND tablename='projects'
     AND policyname='projects_select' AND cmd='SELECT';
  IF project_rule IS NULL
     OR btrim(project_rule,' ()') = 'true'
     OR position('auth.uid' in project_rule) = 0
     OR position('private.dg_shared_project_access' in project_rule) = 0
  THEN RAISE EXCEPTION 'PROJECT_ACCESS_POLICY_MISMATCH: refusing waypoint policy migration'; END IF;
  IF to_regprocedure('private.dg_shared_project_access(bigint)') IS NULL
     OR to_regprocedure('private.is_admin()') IS NULL
     OR to_regprocedure('private.is_active()') IS NULL
  THEN RAISE EXCEPTION 'PROJECT_ACCESS_HELPER_MISSING'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.waypoints'::regclass AND tgname='dg_waypoint_completion_guard' AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'PROJECT_LOCK_GUARD_MISSING'; END IF;

  SELECT qual INTO admin_delete_rule FROM pg_policies
    WHERE schemaname='public' AND tablename='parks'
      AND policyname='parks_delete' AND cmd='DELETE';
  SELECT qual INTO stage_delete_rule FROM pg_policies
    WHERE schemaname='public' AND tablename='parks'
      AND policyname='parks_stage_owner_delete' AND cmd='DELETE';
  IF admin_delete_rule IS NULL OR position('private.is_admin' in admin_delete_rule)=0
    OR stage_delete_rule IS NULL
    OR position('stage_scope' in stage_delete_rule)=0
    OR position('created_by' in stage_delete_rule)=0
    OR position('private.is_active' in stage_delete_rule)=0
  THEN RAISE EXCEPTION 'PARK_DELETE_POLICY_MISMATCH: refusing consolidation'; END IF;
END $guard$;

DROP POLICY IF EXISTS wp_select ON public.waypoints;
CREATE POLICY wp_select ON public.waypoints FOR SELECT TO authenticated
USING (
  (SELECT private.is_admin()) OR EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = waypoints.project_id
      AND (pr.owner = (SELECT auth.uid()) OR private.dg_shared_project_access(pr.id))
  )
);

DROP POLICY IF EXISTS wp_insert ON public.waypoints;
CREATE POLICY wp_insert ON public.waypoints FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.is_admin()) OR (
    owner = (SELECT auth.uid()) AND (SELECT private.is_active()) AND EXISTS (
      SELECT 1 FROM public.projects pr
      WHERE pr.id = waypoints.project_id AND NOT pr.is_locked
        AND (pr.owner = (SELECT auth.uid()) OR private.dg_shared_project_access(pr.id))
    )
  )
);

DROP POLICY IF EXISTS wp_update ON public.waypoints;
CREATE POLICY wp_update ON public.waypoints FOR UPDATE TO authenticated
USING (
  (SELECT private.is_admin()) OR EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = waypoints.project_id AND NOT pr.is_locked
      AND (pr.owner = (SELECT auth.uid()) OR (
         waypoints.owner = (SELECT auth.uid()) AND private.dg_shared_project_access(pr.id)
      ))
  )
)
WITH CHECK (
  (SELECT private.is_admin()) OR EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = waypoints.project_id AND NOT pr.is_locked
      AND (pr.owner = (SELECT auth.uid()) OR (
        owner = (SELECT auth.uid()) AND private.dg_shared_project_access(pr.id)
      ))
  )
);

DROP POLICY IF EXISTS wp_delete ON public.waypoints;
CREATE POLICY wp_delete ON public.waypoints FOR DELETE TO authenticated
USING (
  (SELECT private.is_admin()) OR EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = waypoints.project_id AND NOT pr.is_locked
      AND (pr.owner = (SELECT auth.uid()) OR (
        waypoints.owner = (SELECT auth.uid()) AND private.dg_shared_project_access(pr.id)
      ))
  )
);

-- Preserve the exact OR of existing administrator and staged-park-owner DELETE grants.
-- Combining two permissive policies avoids duplicate policy evaluation/warnings.
DROP POLICY IF EXISTS parks_stage_owner_delete ON public.parks;
DROP POLICY IF EXISTS parks_delete ON public.parks;
CREATE POLICY parks_delete ON public.parks FOR DELETE TO authenticated
USING (
  (SELECT private.is_admin()) OR (
    osm_key ~ '^stage/[0-9]+/[a-f0-9]{32}$'
    AND (geom_json -> 'stage_scope' ->> 'schema') = 'dendrogeo/park-stage/1'
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.is_active())
  )
);

-- A missing reference-side index; no existing project rows are altered.
CREATE INDEX IF NOT EXISTS idx_projects_locked_by ON public.projects (locked_by);
COMMIT;
