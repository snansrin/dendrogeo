-- Fresh installations must reproduce the reviewed 20 October security fixes.
-- The existing production project already has these policies and bucket limits.
-- No measurement, photo object, account, or scientific result is modified.
begin;

alter policy projects_select on public.projects
 to authenticated
 using (
  owner = (select auth.uid())
  or (select private.is_admin())
  or (park_id is not null and public.dg_is_park_member(park_id))
 );

drop policy if exists dendro_photos_authorized_select on storage.objects;
create policy dendro_photos_authorized_select on storage.objects
 for select to authenticated
 using (
  bucket_id='dendro-photos'
  and ((select private.is_admin())
   or (storage.foldername(name))[1]=(select auth.uid())::text)
 );
drop policy if exists dendro_photos_public_read on storage.objects;

-- Configure the empty fresh-install bucket. Existing matching buckets are a
-- no-op. Refuse to impose a different upload policy over existing photo data.
do $guard$
declare bucket_public boolean; size_limit bigint; mime_types text[];
begin
 select b.public,b.file_size_limit,b.allowed_mime_types
 into bucket_public,size_limit,mime_types
 from storage.buckets b where b.id='dendro-photos' for update;
 if not found or bucket_public is distinct from true then
  raise exception 'PHOTO_BUCKET_REPLAY: expected existing public dendro-photos bucket';
 end if;
 if size_limit is distinct from 8388608
  or mime_types is distinct from array['image/jpeg']::text[] then
  if exists(select 1 from storage.objects where bucket_id='dendro-photos') then
   raise exception 'PHOTO_BUCKET_REPLAY: review existing objects before changing upload limits';
  end if;
  update storage.buckets set file_size_limit=8388608,
   allowed_mime_types=array['image/jpeg']::text[] where id='dendro-photos';
 end if;
end $guard$;

commit;
