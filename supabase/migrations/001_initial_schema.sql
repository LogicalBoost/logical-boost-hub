-- ============================================================================
-- 001_initial_schema.sql
-- Logical Boost Hub — Initial database schema
-- ============================================================================

-- ============================================================================
-- 1. clients (created before users because users.client_id references clients)
-- ============================================================================
CREATE TABLE clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  website        TEXT,
  business_summary TEXT,
  services       TEXT,
  differentiators TEXT,
  trust_signals  TEXT,
  tone           TEXT,
  ad_copy_rules  JSONB,
  ad_copy_notes  TEXT,
  competitors    JSONB,
  intake_status  TEXT NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE clients IS 'Client organisations managed on the platform';

-- ============================================================================
-- 2. users (extends auth.users with app-level profile data)
-- ============================================================================
CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'team_editor', 'team_viewer', 'client')),
  client_id  UUID REFERENCES clients (id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Application user profiles linked to Supabase Auth';

-- ============================================================================
-- 3. client_assignments (many-to-many: team members ↔ clients)
-- ============================================================================
CREATE TABLE client_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

COMMENT ON TABLE client_assignments IS 'Links team members to the clients they can access';

-- ============================================================================
-- 4. avatars (ideal customer profiles per client)
-- ============================================================================
CREATE TABLE avatars (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  avatar_type          TEXT,
  description          TEXT,
  pain_points          TEXT,
  motivations          TEXT,
  objections           TEXT,
  desired_outcome      TEXT,
  trigger_events       TEXT,
  messaging_style      TEXT,
  preferred_platforms  JSONB,
  recommended_angles   JSONB,
  status               TEXT NOT NULL DEFAULT 'approved',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE avatars IS 'Customer avatars / personas for each client';

-- ============================================================================
-- 5. offers (marketing offers per client)
-- ============================================================================
CREATE TABLE offers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  offer_type        TEXT,
  headline          TEXT,
  subheadline       TEXT,
  description       TEXT,
  primary_cta       TEXT,
  conversion_type   TEXT,
  benefits          JSONB,
  proof_elements    JSONB,
  urgency_elements  JSONB,
  faq               JSONB,
  landing_page_type TEXT,
  status            TEXT NOT NULL DEFAULT 'approved',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE offers IS 'Marketing offers tied to a client';

-- ============================================================================
-- 6. funnel_instances (generated funnel combinations)
-- ============================================================================
CREATE TABLE funnel_instances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  avatar_id        UUID NOT NULL REFERENCES avatars (id) ON DELETE CASCADE,
  offer_id         UUID NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  primary_angle    TEXT,
  secondary_angles JSONB,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           TEXT NOT NULL DEFAULT 'active'
);

COMMENT ON TABLE funnel_instances IS 'A specific avatar + offer + angle combination used to generate assets';

-- ============================================================================
-- 7. copy_components (reusable copy blocks)
-- ============================================================================
CREATE TABLE copy_components (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  type               TEXT NOT NULL,
  text               TEXT NOT NULL,
  character_count    INTEGER,
  avatar_ids         JSONB,
  offer_ids          JSONB,
  angle_ids          JSONB,
  platform           TEXT,
  status             TEXT NOT NULL DEFAULT 'approved',
  funnel_instance_id UUID REFERENCES funnel_instances (id) ON DELETE SET NULL,
  parent_id          UUID REFERENCES copy_components (id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE copy_components IS 'Atomic copy blocks (headlines, hooks, CTAs, etc.)';

-- ============================================================================
-- 8. creatives (ad creative concepts)
-- ============================================================================
CREATE TABLE creatives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  funnel_instance_id  UUID NOT NULL REFERENCES funnel_instances (id) ON DELETE CASCADE,
  avatar_id           UUID NOT NULL REFERENCES avatars (id) ON DELETE CASCADE,
  offer_id            UUID NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  copy_component_ids  JSONB,
  creative_type       TEXT,
  headline            TEXT,
  support_copy        TEXT,
  cta                 TEXT,
  concept_description TEXT,
  visual_prompt       TEXT,
  image_url           TEXT,
  status              TEXT NOT NULL DEFAULT 'approved',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE creatives IS 'Ad creative concepts tied to a funnel instance';

-- ============================================================================
-- 9. landing_pages (generated landing page blueprints)
-- ============================================================================
CREATE TABLE landing_pages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  funnel_instance_id  UUID NOT NULL REFERENCES funnel_instances (id) ON DELETE CASCADE,
  avatar_id           UUID NOT NULL REFERENCES avatars (id) ON DELETE CASCADE,
  offer_id            UUID NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  copy_component_ids  JSONB,
  headline            TEXT,
  subheadline         TEXT,
  cta                 TEXT,
  sections            JSONB,
  preview_image_url   TEXT,
  status              TEXT NOT NULL DEFAULT 'approved',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE landing_pages IS 'Landing page blueprints for a funnel instance';

-- ============================================================================
-- 10. intake_questions (onboarding questionnaire per client)
-- ============================================================================
CREATE TABLE intake_questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  section    TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE intake_questions IS 'Client onboarding intake questions and answers';

-- ============================================================================
-- 11. competitor_intel (competitive research data)
-- ============================================================================
CREATE TABLE competitor_intel (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  competitor_name    TEXT NOT NULL,
  competitor_website TEXT,
  source             TEXT,
  ad_type            TEXT,
  content            TEXT,
  screenshot_url     TEXT,
  keywords           JSONB,
  notes              TEXT,
  captured_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE competitor_intel IS 'Captured competitor ads and intelligence';

-- ============================================================================
-- Indexes for common query patterns
-- ============================================================================
CREATE INDEX idx_users_client_id          ON users (client_id);
CREATE INDEX idx_users_role               ON users (role);
CREATE INDEX idx_client_assignments_user  ON client_assignments (user_id);
CREATE INDEX idx_client_assignments_client ON client_assignments (client_id);
CREATE INDEX idx_avatars_client           ON avatars (client_id);
CREATE INDEX idx_offers_client            ON offers (client_id);
CREATE INDEX idx_funnel_instances_client  ON funnel_instances (client_id);
CREATE INDEX idx_copy_components_client   ON copy_components (client_id);
CREATE INDEX idx_creatives_client         ON creatives (client_id);
CREATE INDEX idx_landing_pages_client     ON landing_pages (client_id);
CREATE INDEX idx_intake_questions_client  ON intake_questions (client_id);
CREATE INDEX idx_competitor_intel_client  ON competitor_intel (client_id);

-- ============================================================================
-- updated_at trigger function (reused across tables)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables that have an updated_at column
CREATE TRIGGER trg_users_updated_at           BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated_at         BEFORE UPDATE ON clients         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_avatars_updated_at         BEFORE UPDATE ON avatars         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_offers_updated_at          BEFORE UPDATE ON offers          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_copy_components_updated_at BEFORE UPDATE ON copy_components FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_creatives_updated_at       BEFORE UPDATE ON creatives       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_landing_pages_updated_at   BEFORE UPDATE ON landing_pages   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_intake_questions_updated_at BEFORE UPDATE ON intake_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
