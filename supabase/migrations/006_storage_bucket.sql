-- ============================================================================
-- 006_storage_bucket.sql
-- Create storage bucket for client assets (logos, images)
-- ============================================================================

-- Create the bucket for client assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-assets',
  'client-assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read public assets
CREATE POLICY storage_client_assets_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'client-assets');

-- Allow authenticated users to upload
CREATE POLICY storage_client_assets_auth_upload ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'client-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY storage_client_assets_auth_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'client-assets')
  WITH CHECK (bucket_id = 'client-assets');

-- Allow authenticated users to delete
CREATE POLICY storage_client_assets_auth_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'client-assets');

-- Add logo_url column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
