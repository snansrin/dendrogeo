-- DendroGeo · Security: restrict Storage object enumeration without
-- changing existing photo URLs, uploads, public-image rendering, or data.
--
-- Previously "dendro_photos_public_read" permitted SELECT on every object to
-- PUBLIC, including anonymous callers using the Storage list endpoint.
-- DendroGeo's published measurement photo URLs use the PUBLIC bucket's
-- unauthenticated object GET route. Supabase's public-bucket implementation
-- serves those existing image URLs without requiring a SELECT/list policy.
--
-- Keep the bucket public for compatibility with accepted reports and mobile
-- map imagery. Only narrow listing / authenticated reads:
--   owner/admin: can enumerate/download all photo objects;
--   signed-in field user: own UUID prefix only;
--   anon / unauthenticated: may not enumerate any photo objects.
-- Nothing in measurements, photo binaries, Auth, GIS or carbon is mutated.
begin;

drop policy if exists "dendro_photos_authorized_select" on storage.objects;
create policy "dendro_photos_authorized_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'dendro-photos'
    and (
      (select private.is_admin())
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

drop policy if exists "dendro_photos_public_read" on storage.objects;

commit;
