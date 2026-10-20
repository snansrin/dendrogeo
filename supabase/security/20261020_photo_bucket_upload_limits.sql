-- DendroGeo · Free Plan storage upload guard · 2026-10-20
-- Only storage.buckets configuration for the existing dendro-photos bucket.
-- DO NOT make the bucket private: old reports rely on existing public photo URLs.
-- Existing objects, names, owners, RLS policies and GIS/measurement code stay unchanged.
-- Compatible with both online and offline uploader: they always send image/jpeg.
-- Existing objects were checked before rollout: 63 files; maximum 755049 bytes; all image/jpeg.
-- Idempotent and fail-closed if any incompatible state appears.
BEGIN;
DO $guard$
DECLARE
  v_public boolean;
  v_count integer;
  v_incompatible integer;
BEGIN
  SELECT b.public INTO v_public
  FROM storage.buckets b WHERE b.id = 'dendro-photos' FOR UPDATE;
  IF NOT FOUND OR v_public IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'dendro-photos bucket missing or no longer public: check compatibility before setting limits';
  END IF;

  SELECT count(*) INTO v_incompatible
  FROM storage.objects o
  WHERE o.bucket_id = 'dendro-photos'
    AND (
      lower(coalesce(o.metadata->>'mimetype', '')) <> 'image/jpeg'
      OR (o.metadata->>'size') IS NULL
      OR (o.metadata->>'size') !~ '^[0-9]+$'
      OR (o.metadata->>'size')::numeric > 8388608
    );
  IF v_incompatible <> 0 THEN
    RAISE EXCEPTION 'Existing photos contain % files outside the JPEG/8MiB policy; refusing change', v_incompatible;
  END IF;

  UPDATE storage.buckets b
  SET file_size_limit = 8388608,
      allowed_mime_types = ARRAY['image/jpeg']::text[]
  WHERE b.id = 'dendro-photos'
    AND (
      b.file_size_limit IS DISTINCT FROM 8388608
      OR b.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg']::text[]
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'Unexpected Storage bucket update count: %', v_count;
  END IF;
END
$guard$;
COMMIT;
