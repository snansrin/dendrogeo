-- Authorization-only: scope waypoint reads to their owner, an administrator,
-- or a participant with current accepted access to the exact project.
-- Keep waypoint writes, measurements, and existing rows unchanged.
begin;

alter policy wp_select on public.waypoints to authenticated using (
  owner = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1
    from public.projects pr
    where pr.id = waypoints.project_id
      and (
        pr.owner = (select auth.uid())
        or private.dg_shared_project_access(pr.id)
      )
  )
);

commit;
