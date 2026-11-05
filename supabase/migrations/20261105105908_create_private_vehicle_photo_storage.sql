INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Users can read their own vehicle photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their own vehicle photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own vehicle photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
