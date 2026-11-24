-- Run after schema.sql in a Supabase project with Storage enabled.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('event-assets','event-assets',true,5242880,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=EXCLUDED.public,file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS event_asset_upload ON storage.objects;
DROP POLICY IF EXISTS event_asset_upload_scope ON storage.objects;
DROP POLICY IF EXISTS event_asset_no_anonymous_upload ON storage.objects;
DROP POLICY IF EXISTS event_asset_no_anonymous_list ON storage.objects;
DROP POLICY IF EXISTS event_asset_list_scope ON storage.objects;
DROP POLICY IF EXISTS event_asset_immutable ON storage.objects;
DROP POLICY IF EXISTS event_asset_no_delete ON storage.objects;
CREATE POLICY event_asset_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='event-assets');
-- Restrictive policies also constrain any permissive policies installed for other buckets.
CREATE POLICY event_asset_upload_scope ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id<>'event-assets' OR (
    name ~ '^[a-f0-9-]{36}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.](png|jpg|webp)$'
    AND split_part(name,'/',1) IN (SELECT m.workspace_id::text FROM public.workspace_members m WHERE m.user_id=(SELECT auth.uid()))
  ));
CREATE POLICY event_asset_no_anonymous_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO anon
  WITH CHECK (bucket_id<>'event-assets');
-- Public URLs serve known objects. Listing draft filenames through the Storage API is private.
CREATE POLICY event_asset_no_anonymous_list ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
  USING (bucket_id<>'event-assets');
CREATE POLICY event_asset_list_scope ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id<>'event-assets' OR split_part(name,'/',1) IN
    (SELECT m.workspace_id::text FROM public.workspace_members m WHERE m.user_id=(SELECT auth.uid())));
CREATE POLICY event_asset_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
  USING (bucket_id<>'event-assets') WITH CHECK (bucket_id<>'event-assets');
CREATE POLICY event_asset_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
  USING (bucket_id<>'event-assets');
COMMIT;
