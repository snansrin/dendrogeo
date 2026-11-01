-- Project snapshots are scoped to (owner, project_id, park_id), but a second
-- archive->parks foreign key creates an unintended many-to-many relationship
-- when PostgREST expands projects with parks (...): PGRST201 / HTTP 300.
-- Preserve the archive's owner/project FKs, primary key, payload and RLS.
-- RLS already checks projects.id=project_id AND projects.park_id=park_id.
-- Park deletion leaves historical evidence inaccessible until an owner-owned
-- project matches its original park; it never reassigns the archived scope.
alter table public.project_workspace_archives
  drop constraint if exists project_workspace_archives_park_id_fkey;
