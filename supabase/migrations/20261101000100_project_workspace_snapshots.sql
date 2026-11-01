-- Preserve exact user-generated live-map evidence on each signed-in device.
-- A new, separately RLS-protected archive; no historical park, waypoint,
-- surface review, measurement or accepted-analysis row is touched.
create table if not exists public.project_workspace_snapshots (
 owner uuid not null references auth.users(id) on delete cascade,
 project_id bigint not null references public.projects(id) on delete cascade,
 park_id bigint not null references public.parks(id) on delete cascade,
 device_id uuid not null,
 payload jsonb not null,
 updated_at timestamptz not null default now(),
 constraint project_workspace_snapshots_pkey primary key(owner,project_id,park_id,device_id),
 constraint project_workspace_snapshots_payload_object check (jsonb_typeof(payload)='object'),
 constraint project_workspace_snapshots_payload_limit check (octet_length(payload::text)<=7340032)
);
alter table public.project_workspace_snapshots enable row level security;
revoke all on public.project_workspace_snapshots from anon;
grant select,insert,update on public.project_workspace_snapshots to authenticated;

-- User identity alone is insufficient: the project must still be visible
-- through its existing RLS policies and still reference the same park.
create policy project_workspace_snapshots_read on public.project_workspace_snapshots
 for select to authenticated using (
  owner=auth.uid() and exists(
   select 1 from public.projects project
   where project.id=project_workspace_snapshots.project_id and project.park_id=project_workspace_snapshots.park_id
  )
 );
create policy project_workspace_snapshots_insert on public.project_workspace_snapshots
 for insert to authenticated with check (
  owner=auth.uid() and exists(
   select 1 from public.projects project
   where project.id=project_workspace_snapshots.project_id and project.park_id=project_workspace_snapshots.park_id and project.is_locked=false
  )
 );
create policy project_workspace_snapshots_update on public.project_workspace_snapshots
 for update to authenticated using (
  owner=auth.uid() and exists(
   select 1 from public.projects project
   where project.id=project_workspace_snapshots.project_id and project.park_id=project_workspace_snapshots.park_id and project.is_locked=false
  )
 ) with check (
  owner=auth.uid() and exists(
   select 1 from public.projects project
   where project.id=project_workspace_snapshots.project_id and project.park_id=project_workspace_snapshots.park_id and project.is_locked=false
  )
 );
comment on table public.project_workspace_snapshots is
 'Per-device owner-scoped live-map backups; only archived evidence and UI grid state, never scientific acceptance.';
