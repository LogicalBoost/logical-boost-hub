-- 020_client_content.sql
-- Store structured content extracted from client websites and provided by team
-- Testimonials, reviews, team members, stats, certifications, awards
-- Used by landing page builder to populate pages with real content

CREATE TABLE IF NOT EXISTS client_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'testimonial', 'review', 'team_member', 'stat',
    'certification', 'award', 'case_study', 'faq', 'process_step'
  )),
  -- Common fields
  title TEXT,                    -- Name, stat label, cert name, etc.
  body TEXT,                     -- Quote, review text, bio, description
  source TEXT,                   -- Where it came from (Google, Yelp, website, etc.)
  rating INTEGER,                -- Star rating (1-5) for reviews/testimonials
  -- Person fields (testimonials, reviews, team)
  person_name TEXT,
  person_role TEXT,              -- Job title, location, "Homeowner", etc.
  person_photo TEXT,             -- URL to photo
  -- Stat fields
  stat_value TEXT,               -- "2,100+", "4.9", "$8.2M"
  stat_label TEXT,               -- "Inspections Completed", "Star Rating"
  -- Meta
  avatar_id UUID REFERENCES avatars(id) ON DELETE SET NULL,  -- Optional: relevant to specific avatar
  sort_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_content_client_id ON client_content(client_id);
CREATE INDEX idx_client_content_type ON client_content(client_id, content_type);

-- RLS policies
ALTER TABLE client_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_content_anon_read ON client_content
  FOR SELECT TO anon USING (true);

CREATE POLICY client_content_auth_read ON client_content
  FOR SELECT TO authenticated USING (true);

CREATE POLICY client_content_auth_insert ON client_content
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY client_content_auth_update ON client_content
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY client_content_auth_delete ON client_content
  FOR DELETE TO authenticated USING (true);
