-- Reopen exact saved field evidence on another device. This is an independent
-- user-owned archive, never a replacement for immutable park/surface records.
create table if not exists public.project_workspace_archives (
  owner uuid not null references auth.users(id) on delete cascade,
  project_id bigint not null references public.projects(id) on delete cascade,
  park_id bigint not null references public.parks(id) on delete cascade,
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload->>'schema' = 'dendrogeo/live-map-project-snapshot/1'
    and jsonb_typeof(payload->'state') = 'object'
    and octet_length(payload::text) <= 8388608
  ),
  updated_at timestamptz not null default now(),
  primary key (owner, project_id, park_id)
);

alter table public.project_workspace_archives enable row level security;
revoke all on public.project_workspace_archives from public, anon, authenticated;
grant select, insert, update on public.project_workspace_archives to authenticated;

create policy dg_workspace_archive_select on public.project_workspace_archives
  for select to authenticated
  using (
    owner = (select auth.uid()) and exists (
      select 1 from public.projects p where p.id = project_id and p.park_id = park_id
    )
  );
create policy dg_workspace_archive_insert on public.project_workspace_archives
  for insert to authenticated
  with check (
    owner = (select auth.uid()) and exists (
      select 1 from public.projects p where p.id = project_id and p.park_id = park_id
    )
    and payload->>'ownerId' = owner::text
    and (payload->>'projectId')::bigint = project_id
    and (payload->>'parkId')::bigint = park_id
  );
create policy dg_workspace_archive_update on public.project_workspace_archives
  for update to authenticated
  using (
    owner = (select auth.uid()) and exists (
      select 1 from public.projects p where p.id = project_id and p.park_id = park_id
    )
  )
  with check (
    owner = (select auth.uid()) and exists (
      select 1 from public.projects p where p.id = project_id and p.park_id = park_id
    )
    and payload->>'ownerId' = owner::text
    and (payload->>'projectId')::bigint = project_id
    and (payload->>'parkId')::bigint = park_id
  );

-- A stale tab cannot overwrite a later saved field revision even if it read
-- the older version before another device committed its snapshot.
create or replace function private.dg_guard_workspace_archive_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.payload->>'savedAt') < (old.payload->>'savedAt') then
    raise exception 'WORKSPACE_ARCHIVE_STALE' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.dg_guard_workspace_archive_revision() from public, anon, authenticated;
drop trigger if exists dg_workspace_archive_revision_guard on public.project_workspace_archives;
create trigger dg_workspace_archive_revision_guard
before update on public.project_workspace_archives
for each row execute function private.dg_guard_workspace_archive_revision();
