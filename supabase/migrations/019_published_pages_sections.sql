-- ============================================================================
-- 019_published_pages_sections.sql
-- Add sections column (JSONB array) for AI-generated landing page content.
-- When sections is populated, templates render directly from this array
-- instead of converting from flat copy_slots.
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE published_pages ADD COLUMN sections JSONB DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMENT ON COLUMN published_pages.sections IS 'AI-generated Section[] array for template rendering. When present, takes priority over copy_slots conversion.';
