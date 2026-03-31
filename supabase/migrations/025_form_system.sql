-- Form system: configurable forms, webhooks, submissions
-- Supports standard single-step and multi-step forms

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  form_type       TEXT NOT NULL DEFAULT 'standard' CHECK (form_type IN ('standard', 'multi_step')),
  fields          JSONB NOT NULL DEFAULT '[]',
  steps           JSONB DEFAULT NULL,
  settings        JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forms_client ON forms(client_id);
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Form webhooks table
CREATE TABLE IF NOT EXISTS form_webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  form_id     UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  name        TEXT,
  headers     JSONB DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_webhooks_form ON form_webhooks(form_id);
CREATE TRIGGER update_form_webhooks_updated_at BEFORE UPDATE ON form_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Form submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id           UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  published_page_id UUID REFERENCES published_pages(id) ON DELETE SET NULL,
  form_data         JSONB NOT NULL,
  page_slug         TEXT,
  client_slug       TEXT,
  page_url          TEXT,
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  utm_content       TEXT,
  utm_term          TEXT,
  referrer          TEXT,
  traffic_source    TEXT,
  user_agent        TEXT,
  ip_address        TEXT,
  webhook_status    JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_client ON form_submissions(client_id);
CREATE INDEX idx_form_submissions_created ON form_submissions(created_at DESC);

-- Add form columns to published_pages
ALTER TABLE published_pages ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES forms(id) ON DELETE SET NULL;
ALTER TABLE published_pages ADD COLUMN IF NOT EXISTS form_snapshot JSONB DEFAULT NULL;

-- RLS policies
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Forms RLS
CREATE POLICY "Admin full access on forms" ON forms FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Team editor access on forms" ON forms FOR ALL USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY "Team viewer read on forms" ON forms FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));
CREATE POLICY "Client read own forms" ON forms FOR SELECT USING (get_user_role() = 'client' AND client_id = (SELECT client_id FROM users WHERE id = auth.uid()));
-- Anon read for form submission (landing pages load form config)
CREATE POLICY "Anon read active forms" ON forms FOR SELECT USING (status = 'active');

-- Form webhooks RLS
CREATE POLICY "Admin full access on form_webhooks" ON form_webhooks FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Team editor access on form_webhooks" ON form_webhooks FOR ALL USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY "Team viewer read on form_webhooks" ON form_webhooks FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

-- Form submissions RLS
CREATE POLICY "Admin full access on form_submissions" ON form_submissions FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Team editor access on form_submissions" ON form_submissions FOR ALL USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY "Team viewer read on form_submissions" ON form_submissions FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));
CREATE POLICY "Client read own submissions" ON form_submissions FOR SELECT USING (get_user_role() = 'client' AND client_id = (SELECT client_id FROM users WHERE id = auth.uid()));
-- Anon insert for public form submissions
CREATE POLICY "Anon insert submissions" ON form_submissions FOR INSERT WITH CHECK (true);
