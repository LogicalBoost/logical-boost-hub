-- Client phone numbers: multiple numbers per client with labels/notes
-- Used in landing page templates (header, footer, CTAs)

CREATE TABLE IF NOT EXISTS client_phone_numbers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone_number  TEXT NOT NULL,
  label         TEXT NOT NULL DEFAULT 'Main',
  notes         TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_phone_numbers_client ON client_phone_numbers(client_id);
CREATE TRIGGER update_client_phone_numbers_updated_at BEFORE UPDATE ON client_phone_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE client_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on client_phone_numbers" ON client_phone_numbers FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Team editor access on client_phone_numbers" ON client_phone_numbers FOR ALL USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY "Team viewer read on client_phone_numbers" ON client_phone_numbers FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));
CREATE POLICY "Client read own phone numbers" ON client_phone_numbers FOR SELECT USING (get_user_role() = 'client' AND client_id = (SELECT client_id FROM users WHERE id = auth.uid()));
