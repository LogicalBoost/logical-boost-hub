-- Migration 013: Stitch-powered landing page builder + competitor intel updates
-- Adds Stitch workflow fields to landing_pages, updates competitor_intel schema,
-- adds angle fields to funnel_instances

-- ============================================================
-- LANDING PAGES: Add Stitch pipeline fields
-- ============================================================
ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS copy_slots JSONB,
  ADD COLUMN IF NOT EXISTS stitch_job_id TEXT,
  ADD COLUMN IF NOT EXISTS stitch_preview_url TEXT,
  ADD COLUMN IF NOT EXISTS stitch_output_code TEXT,
  ADD COLUMN IF NOT EXISTS iteration_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS react_output TEXT,
  ADD COLUMN IF NOT EXISTS deploy_url TEXT;

-- Update deploy_status to support new states
-- (existing values 'draft' and 'deployed' still valid, adding new ones)
-- No enum constraint change needed since we use TEXT

-- ============================================================
-- COMPETITOR INTEL: Add new fields for unified intel hub
-- ============================================================
ALTER TABLE competitor_intel
  ADD COLUMN IF NOT EXISTS intel_type TEXT DEFAULT 'ad',
  ADD COLUMN IF NOT EXISTS angles_used JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_page_structure TEXT,
  ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

-- Make competitor_name and competitor_website nullable for industry_playbook entries
ALTER TABLE competitor_intel
  ALTER COLUMN competitor_name DROP NOT NULL;

-- ============================================================
-- FUNNEL INSTANCES: Add angle tracking
-- ============================================================
ALTER TABLE funnel_instances
  ADD COLUMN IF NOT EXISTS primary_angle TEXT,
  ADD COLUMN IF NOT EXISTS secondary_angles JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- CLIENTS: Add brand_reference_url for Stitch alt brand extraction
-- ============================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS brand_reference_url TEXT;
