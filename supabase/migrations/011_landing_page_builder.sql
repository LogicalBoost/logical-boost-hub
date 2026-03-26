-- Add landing page builder columns
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS page_html TEXT;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS section_data JSONB;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS brand_kit_snapshot JSONB;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS deploy_status TEXT NOT NULL DEFAULT 'draft';

-- Make funnel_instance_id nullable (landing pages can exist without a funnel)
ALTER TABLE landing_pages ALTER COLUMN funnel_instance_id DROP NOT NULL;
