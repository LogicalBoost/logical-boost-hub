-- ============================================================================
-- 016_landing_page_template_system.sql
-- Replaces Stitch pipeline with template-based landing page system.
-- New tables: brand_kits, media_assets, page_templates, published_pages
-- Evolves client_assets → media_assets (adds role, avatar_id, display_name)
-- ============================================================================

-- ============================================================================
-- 1. BRAND KITS — per-client visual identity
-- ============================================================================
CREATE TABLE IF NOT EXISTS brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  primary_color VARCHAR(7) NOT NULL DEFAULT '#2E86AB',
  secondary_color VARCHAR(7) NOT NULL DEFAULT '#1B4965',
  accent_color VARCHAR(7) DEFAULT '#F4A261',
  background_color VARCHAR(7) DEFAULT '#FFFFFF',
  text_color VARCHAR(7) DEFAULT '#1A1A1A',
  heading_font VARCHAR(100) NOT NULL DEFAULT 'Barlow Condensed',
  body_font VARCHAR(100) NOT NULL DEFAULT 'Inter',
  logo_url TEXT,
  logo_dark_url TEXT,
  button_style JSONB DEFAULT '{"borderRadius": "8px", "textTransform": "uppercase"}',
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_kits_anon_select ON brand_kits FOR SELECT USING (true);
CREATE POLICY brand_kits_anon_insert ON brand_kits FOR INSERT WITH CHECK (true);
CREATE POLICY brand_kits_anon_update ON brand_kits FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY brand_kits_anon_delete ON brand_kits FOR DELETE USING (true);

-- ============================================================================
-- 2. MEDIA ASSETS — replaces client_assets with richer schema
-- Migrate existing data, then drop old table
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  avatar_id UUID REFERENCES avatars(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL DEFAULT 'image',
  role VARCHAR(50) NOT NULL,
  alt_text TEXT,
  display_name VARCHAR(200),
  storage_path TEXT,
  filename TEXT,
  prompt_used TEXT,
  style TEXT,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'approved',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_media_assets_client ON media_assets(client_id);
CREATE INDEX idx_media_assets_role ON media_assets(client_id, role);
CREATE INDEX idx_media_assets_avatar ON media_assets(client_id, avatar_id);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_assets_anon_select ON media_assets FOR SELECT USING (true);
CREATE POLICY media_assets_anon_insert ON media_assets FOR INSERT WITH CHECK (true);
CREATE POLICY media_assets_anon_update ON media_assets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY media_assets_anon_delete ON media_assets FOR DELETE USING (true);

-- Migrate existing client_assets data into media_assets
INSERT INTO media_assets (client_id, file_url, file_type, role, storage_path, filename, prompt_used, style, metadata, created_at)
SELECT
  client_id,
  url,
  'image',
  asset_type,
  storage_path,
  filename,
  prompt_used,
  style,
  metadata,
  created_at
FROM client_assets
ON CONFLICT DO NOTHING;

-- Drop old client_assets table (data migrated above)
DROP TABLE IF EXISTS client_assets CASCADE;

-- ============================================================================
-- 3. PAGE TEMPLATES — template definitions with slot schemas
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  template_type VARCHAR(50) NOT NULL,
  section_schema JSONB NOT NULL,
  slot_schema JSONB NOT NULL,
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE page_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY page_templates_anon_select ON page_templates FOR SELECT USING (true);
CREATE POLICY page_templates_anon_insert ON page_templates FOR INSERT WITH CHECK (true);

-- Seed the 4 starter templates
INSERT INTO page_templates (name, slug, description, template_type, section_schema, slot_schema) VALUES
(
  'Lead Capture Classic',
  'lead-capture-classic',
  'Standard lead gen — free inspections, free quotes, consultations. Hero with right-aligned form, icon grid benefits, testimonial cards, accordion FAQ.',
  'lead_capture',
  '{"sections": ["hero", "problem", "solution", "benefits", "proof", "faq", "final_cta"]}',
  '{"hero": {"slots": [{"name": "hero_image", "role": "hero_image", "required": true}]}, "proof": {"slots": [{"name": "testimonial_photos", "role": "testimonial_photo", "required": false, "max": 3}, {"name": "certification_badges", "role": "certification_badge", "required": false, "max": 6}]}, "solution": {"slots": [{"name": "process_image", "role": "process_step", "required": false}]}, "background": {"slots": [{"name": "parallax_image", "role": "background_texture", "required": false}]}}'
),
(
  'Bold Split',
  'bold-split',
  'High-urgency offers, fear/risk angles, storm damage, emergency services. Split 50/50 hero, step-by-step process, full-width testimonial banner.',
  'lead_capture',
  '{"sections": ["hero", "problem", "solution", "benefits", "proof", "faq", "final_cta"]}',
  '{"hero": {"slots": [{"name": "hero_image", "role": "hero_image", "required": true}]}, "proof": {"slots": [{"name": "testimonial_photos", "role": "testimonial_photo", "required": false, "max": 1}, {"name": "certification_badges", "role": "certification_badge", "required": false, "max": 6}]}, "solution": {"slots": [{"name": "process_steps", "role": "process_step", "required": false, "max": 4}]}, "background": {"slots": [{"name": "parallax_image", "role": "background_texture", "required": false}]}}'
),
(
  'Social Proof Heavy',
  'social-proof-heavy',
  'Trust-first industries where credibility is the main barrier. Proof before problem, testimonial carousel, before/after section.',
  'lead_capture',
  '{"sections": ["hero", "proof", "problem", "solution", "benefits", "more_proof", "faq", "final_cta"]}',
  '{"hero": {"slots": [{"name": "hero_image", "role": "hero_image", "required": false}]}, "proof": {"slots": [{"name": "testimonial_photos", "role": "testimonial_photo", "required": false, "max": 6}, {"name": "certification_badges", "role": "certification_badge", "required": false, "max": 6}]}, "solution": {"slots": [{"name": "team_photo", "role": "team_photo", "required": false}]}, "more_proof": {"slots": [{"name": "before_after", "role": "before_after", "required": false, "max": 4}]}}'
),
(
  'Minimal Direct',
  'minimal-direct',
  'Simple offers, call-only pages, clean professional look. Minimal imagery, focused CTA.',
  'call_only',
  '{"sections": ["hero", "solution", "benefits", "proof", "final_cta"]}',
  '{"proof": {"slots": [{"name": "certification_badges", "role": "certification_badge", "required": false, "max": 6}]}}'
);

-- ============================================================================
-- 4. PUBLISHED PAGES — tracks every live landing page
-- ============================================================================
CREATE TABLE IF NOT EXISTS published_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  landing_page_id UUID NOT NULL REFERENCES landing_pages(id),
  template_id UUID NOT NULL REFERENCES page_templates(id),
  avatar_id UUID NOT NULL REFERENCES avatars(id),
  offer_id UUID NOT NULL REFERENCES offers(id),
  slug VARCHAR(30) NOT NULL,
  custom_domain VARCHAR(255),
  media_mapping JSONB,
  page_file_path TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slug, custom_domain)
);

CREATE INDEX idx_published_pages_client ON published_pages(client_id);
CREATE INDEX idx_published_pages_slug ON published_pages(slug);

ALTER TABLE published_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_pages_anon_select ON published_pages FOR SELECT USING (true);
CREATE POLICY published_pages_anon_insert ON published_pages FOR INSERT WITH CHECK (true);
CREATE POLICY published_pages_anon_update ON published_pages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY published_pages_anon_delete ON published_pages FOR DELETE USING (true);

-- ============================================================================
-- 5. ADD COLUMNS to existing landing_pages table
-- ============================================================================
-- template_id may already exist from migration 011, add if missing
DO $$ BEGIN
  ALTER TABLE landing_pages ADD COLUMN brand_kit_id UUID REFERENCES brand_kits(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE landing_pages ADD COLUMN media_mapping JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
