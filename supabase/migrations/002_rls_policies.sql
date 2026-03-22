-- ============================================================================
-- 002_rls_policies.sql
-- Logical Boost Hub — Row Level Security policies
-- ============================================================================
-- Role hierarchy:
--   admin        → full access to all tables
--   team_editor  → full CRUD on assigned clients (via client_assignments)
--   team_viewer  → read-only on assigned clients
--   client       → read own client data + limited updates (deny action)
-- ============================================================================

-- ============================================================================
-- Helper functions
-- ============================================================================

-- Returns the current authenticated user's application role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns TRUE if the current user may access the given client_id
-- Admins can access everything; team members need a client_assignment row;
-- client-role users can only access their own client_id.
CREATE OR REPLACE FUNCTION has_client_access(check_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = auth.uid();

  -- Admins bypass all checks
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Team members: check client_assignments
  IF user_role IN ('team_editor', 'team_viewer') THEN
    RETURN EXISTS (
      SELECT 1 FROM client_assignments
      WHERE user_id = auth.uid()
        AND client_id = check_client_id
    );
  END IF;

  -- Client users: match their own client_id
  IF user_role = 'client' THEN
    RETURN EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND client_id = check_client_id
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Enable RLS on every table
-- ============================================================================
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars            ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_components    ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_instances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE creatives          ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_intel   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS table policies
-- ============================================================================

-- Admin: full access
CREATE POLICY users_admin_all ON users
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Team editor: see own row + users assigned to same clients
CREATE POLICY users_team_editor_select ON users
  FOR SELECT
  USING (
    get_user_role() = 'team_editor'
    AND (
      id = auth.uid()
      OR client_id IS NOT NULL AND has_client_access(client_id)
    )
  );

-- Team viewer: same visibility as editor
CREATE POLICY users_team_viewer_select ON users
  FOR SELECT
  USING (
    get_user_role() = 'team_viewer'
    AND (
      id = auth.uid()
      OR client_id IS NOT NULL AND has_client_access(client_id)
    )
  );

-- Client: can only see own row
CREATE POLICY users_client_select ON users
  FOR SELECT
  USING (
    get_user_role() = 'client'
    AND id = auth.uid()
  );

-- ============================================================================
-- CLIENTS table policies
-- ============================================================================

CREATE POLICY clients_admin_all ON clients
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY clients_team_editor_select ON clients
  FOR SELECT
  USING (get_user_role() = 'team_editor' AND has_client_access(id));

CREATE POLICY clients_team_editor_insert ON clients
  FOR INSERT
  WITH CHECK (get_user_role() = 'team_editor');

CREATE POLICY clients_team_editor_update ON clients
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(id));

CREATE POLICY clients_team_editor_delete ON clients
  FOR DELETE
  USING (get_user_role() = 'team_editor' AND has_client_access(id));

CREATE POLICY clients_team_viewer_select ON clients
  FOR SELECT
  USING (get_user_role() = 'team_viewer' AND has_client_access(id));

CREATE POLICY clients_client_select ON clients
  FOR SELECT
  USING (
    get_user_role() = 'client'
    AND has_client_access(id)
  );

-- ============================================================================
-- CLIENT_ASSIGNMENTS table policies
-- ============================================================================

CREATE POLICY client_assignments_admin_all ON client_assignments
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY client_assignments_team_editor_select ON client_assignments
  FOR SELECT
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY client_assignments_team_editor_insert ON client_assignments
  FOR INSERT
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY client_assignments_team_editor_update ON client_assignments
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY client_assignments_team_editor_delete ON client_assignments
  FOR DELETE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY client_assignments_team_viewer_select ON client_assignments
  FOR SELECT
  USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

-- ============================================================================
-- Macro: client-scoped table policies
-- The following tables all share the same pattern — access gated by client_id.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- AVATARS
-- ---------------------------------------------------------------------------
CREATE POLICY avatars_admin_all ON avatars
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY avatars_team_editor_select ON avatars
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY avatars_team_editor_insert ON avatars
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY avatars_team_editor_update ON avatars
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY avatars_team_editor_delete ON avatars
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY avatars_team_viewer_select ON avatars
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY avatars_client_select ON avatars
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ---------------------------------------------------------------------------
-- OFFERS
-- ---------------------------------------------------------------------------
CREATE POLICY offers_admin_all ON offers
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY offers_team_editor_select ON offers
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY offers_team_editor_insert ON offers
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY offers_team_editor_update ON offers
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY offers_team_editor_delete ON offers
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY offers_team_viewer_select ON offers
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY offers_client_select ON offers
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ---------------------------------------------------------------------------
-- FUNNEL_INSTANCES
-- ---------------------------------------------------------------------------
CREATE POLICY funnel_instances_admin_all ON funnel_instances
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY funnel_instances_team_editor_select ON funnel_instances
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY funnel_instances_team_editor_insert ON funnel_instances
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY funnel_instances_team_editor_update ON funnel_instances
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY funnel_instances_team_editor_delete ON funnel_instances
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY funnel_instances_team_viewer_select ON funnel_instances
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY funnel_instances_client_select ON funnel_instances
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ---------------------------------------------------------------------------
-- COPY_COMPONENTS
-- ---------------------------------------------------------------------------
CREATE POLICY copy_components_admin_all ON copy_components
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY copy_components_team_editor_select ON copy_components
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY copy_components_team_editor_insert ON copy_components
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY copy_components_team_editor_update ON copy_components
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY copy_components_team_editor_delete ON copy_components
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY copy_components_team_viewer_select ON copy_components
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY copy_components_client_select ON copy_components
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ---------------------------------------------------------------------------
-- CREATIVES
-- ---------------------------------------------------------------------------
CREATE POLICY creatives_admin_all ON creatives
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY creatives_team_editor_select ON creatives
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY creatives_team_editor_insert ON creatives
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY creatives_team_editor_update ON creatives
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY creatives_team_editor_delete ON creatives
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY creatives_team_viewer_select ON creatives
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY creatives_client_select ON creatives
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ---------------------------------------------------------------------------
-- LANDING_PAGES
-- ---------------------------------------------------------------------------
CREATE POLICY landing_pages_admin_all ON landing_pages
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY landing_pages_team_editor_select ON landing_pages
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY landing_pages_team_editor_insert ON landing_pages
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY landing_pages_team_editor_update ON landing_pages
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY landing_pages_team_editor_delete ON landing_pages
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY landing_pages_team_viewer_select ON landing_pages
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY landing_pages_client_select ON landing_pages
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ---------------------------------------------------------------------------
-- INTAKE_QUESTIONS
-- ---------------------------------------------------------------------------
CREATE POLICY intake_questions_admin_all ON intake_questions
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY intake_questions_team_editor_select ON intake_questions
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY intake_questions_team_editor_insert ON intake_questions
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY intake_questions_team_editor_update ON intake_questions
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY intake_questions_team_editor_delete ON intake_questions
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY intake_questions_team_viewer_select ON intake_questions
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY intake_questions_client_select ON intake_questions
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- Client can update answers on their own intake questions
CREATE POLICY intake_questions_client_update ON intake_questions
  FOR UPDATE
  USING (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id));

-- ---------------------------------------------------------------------------
-- COMPETITOR_INTEL
-- ---------------------------------------------------------------------------
CREATE POLICY competitor_intel_admin_all ON competitor_intel
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY competitor_intel_team_editor_select ON competitor_intel
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY competitor_intel_team_editor_insert ON competitor_intel
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY competitor_intel_team_editor_update ON competitor_intel
  FOR UPDATE
  USING (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY competitor_intel_team_editor_delete ON competitor_intel
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY competitor_intel_team_viewer_select ON competitor_intel
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY competitor_intel_client_select ON competitor_intel
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ============================================================================
-- Client "deny" action — clients can update status to 'denied' on select tables
-- This lets a client reject proposed content (avatars, offers, creatives, etc.)
-- ============================================================================

CREATE POLICY avatars_client_update_status ON avatars
  FOR UPDATE
  USING (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id) AND status = 'denied');

CREATE POLICY offers_client_update_status ON offers
  FOR UPDATE
  USING (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id) AND status = 'denied');

CREATE POLICY copy_components_client_update_status ON copy_components
  FOR UPDATE
  USING (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id) AND status = 'denied');

CREATE POLICY creatives_client_update_status ON creatives
  FOR UPDATE
  USING (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id) AND status = 'denied');

CREATE POLICY landing_pages_client_update_status ON landing_pages
  FOR UPDATE
  USING (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id) AND status = 'denied');
