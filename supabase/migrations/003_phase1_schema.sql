-- ============================================================================
-- 003_phase1_schema.sql
-- Phase 1: Spec v2.1 — Angles as tags, not selectors
-- ============================================================================

-- funnel_instances: Remove angle columns. One instance per Avatar+Offer.
ALTER TABLE funnel_instances DROP COLUMN IF EXISTS primary_angle;
ALTER TABLE funnel_instances DROP COLUMN IF EXISTS secondary_angles;

-- Add unique constraint: one active instance per Avatar+Offer
-- (We use a partial unique index so archived instances don't conflict)
CREATE UNIQUE INDEX IF NOT EXISTS uq_funnel_instance_active
  ON funnel_instances (avatar_id, offer_id)
  WHERE status = 'active';

-- Add fields to clients for concept page selection (Phase 4 prep)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS selected_concept_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS design_direction JSONB;

-- Add deployed_url and deploy_status to landing_pages
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS deployed_url TEXT;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS deploy_status TEXT DEFAULT 'draft'
  CHECK (deploy_status IN ('draft', 'deployed', 'stale'));
