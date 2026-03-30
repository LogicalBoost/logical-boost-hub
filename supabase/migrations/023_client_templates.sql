-- Client Templates — saved from published pages for reuse
CREATE TABLE IF NOT EXISTS client_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  base_template_slug TEXT NOT NULL DEFAULT 'lead-capture-classic',
  section_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_kit_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_defaults JSONB DEFAULT '{}'::jsonb,
  source_page_id UUID REFERENCES published_pages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, slug)
);

-- RLS
ALTER TABLE client_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON client_templates
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "team_editor_access" ON client_templates
  FOR ALL USING (
    get_user_role() = 'team_editor' AND has_client_access(client_id)
  );

CREATE POLICY "team_viewer_read" ON client_templates
  FOR SELECT USING (
    get_user_role() = 'team_viewer' AND has_client_access(client_id)
  );

CREATE POLICY "client_read_own" ON client_templates
  FOR SELECT USING (
    get_user_role() = 'client'
    AND client_id = (SELECT client_id FROM users WHERE id = auth.uid())
  );
