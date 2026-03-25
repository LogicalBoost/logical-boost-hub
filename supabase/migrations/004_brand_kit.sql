-- ============================================================================
-- 004_brand_kit.sql
-- Add brand_kit JSONB column to clients for storing extracted brand identity
-- ============================================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_kit JSONB;

COMMENT ON COLUMN clients.brand_kit IS 'AI-extracted brand identity: colors, typography, button styles, visual identity';
