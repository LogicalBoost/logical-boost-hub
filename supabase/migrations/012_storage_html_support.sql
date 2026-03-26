-- ============================================================================
-- 012_storage_html_support.sql
-- Allow HTML files in client-assets bucket for landing page deployment
-- ============================================================================

-- Update allowed MIME types to include text/html for deployed landing pages
-- Also increase file size limit to 10MB for larger landing pages
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'text/html'],
  file_size_limit = 10485760
WHERE id = 'client-assets';
