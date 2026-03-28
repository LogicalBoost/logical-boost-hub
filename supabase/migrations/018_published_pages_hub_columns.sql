-- ============================================================================
-- 018_published_pages_hub_columns.sql
-- Add columns needed for Hub-served landing pages:
--   copy_slots (JSONB) — template copy slot data
--   media_assets (JSONB) — hero image, parallax, etc.
--   brand_kit_snapshot (JSONB) — frozen brand kit at publish time
--   template_slug (TEXT) — template identifier (e.g. 'lead-capture-classic')
-- Also: make foreign keys nullable and add client_slug unique constraint
-- ============================================================================

-- Add copy_slots column
DO $$ BEGIN
  ALTER TABLE published_pages ADD COLUMN copy_slots JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add media_assets column
DO $$ BEGIN
  ALTER TABLE published_pages ADD COLUMN media_assets JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add brand_kit_snapshot column
DO $$ BEGIN
  ALTER TABLE published_pages ADD COLUMN brand_kit_snapshot JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add template_slug for string-based template lookup
DO $$ BEGIN
  ALTER TABLE published_pages ADD COLUMN template_slug TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add client_slug for URL routing
DO $$ BEGIN
  ALTER TABLE published_pages ADD COLUMN client_slug TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Make template_id nullable (we use template_slug string instead of FK)
ALTER TABLE published_pages ALTER COLUMN template_id DROP NOT NULL;

-- Make landing_page_id nullable (pages can be published without a landing_pages record)
ALTER TABLE published_pages ALTER COLUMN landing_page_id DROP NOT NULL;

-- Make avatar_id nullable
ALTER TABLE published_pages ALTER COLUMN avatar_id DROP NOT NULL;

-- Make offer_id nullable
ALTER TABLE published_pages ALTER COLUMN offer_id DROP NOT NULL;

-- Drop the old unique constraint and add client_slug + slug unique
-- (old constraint was on slug + custom_domain which doesn't make sense)
ALTER TABLE published_pages DROP CONSTRAINT IF EXISTS published_pages_slug_custom_domain_key;

-- Add unique constraint: one slug per client
DO $$ BEGIN
  ALTER TABLE published_pages ADD CONSTRAINT published_pages_client_slug_unique UNIQUE (client_slug, slug);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
