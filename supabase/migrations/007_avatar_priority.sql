-- ============================================================================
-- 007_avatar_priority.sql
-- Add priority ranking to avatars (1 = highest priority)
-- ============================================================================

ALTER TABLE avatars ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

COMMENT ON COLUMN avatars.priority IS 'Priority ranking: 1 = highest. 0 = unranked';
