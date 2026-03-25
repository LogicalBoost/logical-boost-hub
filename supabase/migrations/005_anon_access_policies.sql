-- ============================================================================
-- 005_anon_access_policies.sql
-- TEMPORARY: Allow unauthenticated (anon key) access to all tables
-- This enables the app to work before login/auth is implemented.
-- REMOVE these policies once auth is wired up and users are logging in.
-- ============================================================================

-- CLIENTS: anon can read/insert/update
CREATE POLICY clients_anon_select ON clients
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY clients_anon_insert ON clients
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY clients_anon_update ON clients
  FOR UPDATE
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- AVATARS: anon full access
CREATE POLICY avatars_anon_select ON avatars
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY avatars_anon_insert ON avatars
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY avatars_anon_update ON avatars
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY avatars_anon_delete ON avatars
  FOR DELETE USING (auth.uid() IS NULL);

-- OFFERS: anon full access
CREATE POLICY offers_anon_select ON offers
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY offers_anon_insert ON offers
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY offers_anon_update ON offers
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY offers_anon_delete ON offers
  FOR DELETE USING (auth.uid() IS NULL);

-- INTAKE_QUESTIONS: anon full access
CREATE POLICY intake_questions_anon_select ON intake_questions
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY intake_questions_anon_insert ON intake_questions
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY intake_questions_anon_update ON intake_questions
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY intake_questions_anon_delete ON intake_questions
  FOR DELETE USING (auth.uid() IS NULL);

-- FUNNEL_INSTANCES: anon full access
CREATE POLICY funnel_instances_anon_select ON funnel_instances
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY funnel_instances_anon_insert ON funnel_instances
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY funnel_instances_anon_update ON funnel_instances
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY funnel_instances_anon_delete ON funnel_instances
  FOR DELETE USING (auth.uid() IS NULL);

-- COPY_COMPONENTS: anon full access
CREATE POLICY copy_components_anon_select ON copy_components
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY copy_components_anon_insert ON copy_components
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY copy_components_anon_update ON copy_components
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY copy_components_anon_delete ON copy_components
  FOR DELETE USING (auth.uid() IS NULL);

-- COMPETITOR_INTEL: anon full access
CREATE POLICY competitor_intel_anon_select ON competitor_intel
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY competitor_intel_anon_insert ON competitor_intel
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY competitor_intel_anon_update ON competitor_intel
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY competitor_intel_anon_delete ON competitor_intel
  FOR DELETE USING (auth.uid() IS NULL);

-- CREATIVES: anon full access
CREATE POLICY creatives_anon_select ON creatives
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY creatives_anon_insert ON creatives
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY creatives_anon_update ON creatives
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- LANDING_PAGES: anon full access
CREATE POLICY landing_pages_anon_select ON landing_pages
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY landing_pages_anon_insert ON landing_pages
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

CREATE POLICY landing_pages_anon_update ON landing_pages
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- USERS: anon read (needed for potential profile lookups)
CREATE POLICY users_anon_select ON users
  FOR SELECT USING (auth.uid() IS NULL);

-- CLIENT_ASSIGNMENTS: anon read
CREATE POLICY client_assignments_anon_select ON client_assignments
  FOR SELECT USING (auth.uid() IS NULL);
