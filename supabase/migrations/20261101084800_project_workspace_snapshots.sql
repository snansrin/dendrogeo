-- RLS-scoped user workspace snapshots; no surface/park/measurement mutations.
create table if not exists public.project_workspace_snapshots (
 owner uuid not null references auth.users(id) on delete cascade,
 project_id bigint not null references public.projects(id) on delete cascade,
 park_id bigint not null references public.parks(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=8388608),
 updated_at timestamptz not null default now(),
 primary key(owner,project_id,park_id)
);
alter table public.project_workspace_snapshots enable row level security;
revoke all on public.project_workspace_snapshots from public, anon;
grant select,insert,update on public.project_workspace_snapshots to authenticated;
create policy dg_workspace_read on public.project_workspace_snapshots for select to authenticated
 using (owner=(select auth.uid()) and exists
  (select 1 from public.projects p where p.id=project_id and p.park_id=park_id));
create policy dg_workspace_create on public.project_workspace_snapshots for insert to authenticated
 with check (owner=(select auth.uid()) and exists
  (select 1 from public.projects p where p.id=project_id and p.park_id=park_id));
create policy dg_workspace_update on public.project_workspace_snapshots for update to authenticated
 using (owner=(select auth.uid()) and exists
  (select 1 from public.projects p where p.id=project_id and p.park_id=park_id))
 with check (owner=(select auth.uid()) and exists
  (select 1 from public.projects p where p.id=project_id and p.park_id=park_id));
