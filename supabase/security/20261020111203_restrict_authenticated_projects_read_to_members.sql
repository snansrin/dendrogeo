-- Security fix applied to production Supabase on 2026-10-20
-- Migration version: 20261020111203
-- Preserve park team collaboration without revealing unrelated projects.
-- No schema, scientific-calculation, measurement, GIS, or UI changes.
ALTER POLICY projects_select ON public.projects
  TO authenticated
  USING (
    owner = (SELECT auth.uid())
    OR (SELECT private.is_admin())
    OR (park_id IS NOT NULL AND public.dg_is_park_member(park_id))
  );
