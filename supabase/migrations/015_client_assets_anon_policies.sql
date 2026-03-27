-- ============================================================================
-- 015_client_assets_anon_policies.sql
-- Allow unauthenticated (anon key) access to client_assets table.
-- Matches pattern from 005_anon_access_policies.sql.
-- REMOVE once auth is wired up.
-- ============================================================================

-- Drop the overly-restrictive anon SELECT policy from 014 (it uses TO anon, not USING)
DROP POLICY IF EXISTS client_assets_anon_read ON client_assets;

-- Anon select (matches 005 pattern)
CREATE POLICY client_assets_anon_select ON client_assets
  FOR SELECT USING (auth.uid() IS NULL);

-- Anon insert
CREATE POLICY client_assets_anon_insert ON client_assets
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

-- Anon update
CREATE POLICY client_assets_anon_update ON client_assets
  FOR UPDATE USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- Anon delete
CREATE POLICY client_assets_anon_delete ON client_assets
  FOR DELETE USING (auth.uid() IS NULL);
