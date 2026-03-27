-- 014_client_assets.sql
-- Store client image assets (AI-generated hero images, uploaded photos, parallax backgrounds)
-- These are reusable across landing pages and visible in Business Overview

CREATE TABLE IF NOT EXISTS client_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('hero_image', 'parallax', 'logo', 'photo', 'other')),
  url TEXT NOT NULL,
  storage_path TEXT,
  filename TEXT,
  prompt_used TEXT,
  style TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by client
CREATE INDEX idx_client_assets_client_id ON client_assets(client_id);
CREATE INDEX idx_client_assets_type ON client_assets(client_id, asset_type);

-- RLS policies (match existing pattern)
ALTER TABLE client_assets ENABLE ROW LEVEL SECURITY;

-- Public read (anon) — same as other tables
CREATE POLICY client_assets_anon_read ON client_assets
  FOR SELECT TO anon USING (true);

-- Authenticated read
CREATE POLICY client_assets_auth_read ON client_assets
  FOR SELECT TO authenticated USING (true);

-- Authenticated insert/update/delete
CREATE POLICY client_assets_auth_insert ON client_assets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY client_assets_auth_update ON client_assets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY client_assets_auth_delete ON client_assets
  FOR DELETE TO authenticated USING (true);
