-- ============================================================================
-- 038_security_p0_fixes.sql
-- P0 fixes from the 2026-04-26 security audit. Three independent fixes,
-- bundled here for atomic deploy:
--
--   STEP 1 — close the privilege-escalation hole on `users`. Adds a
--            BEFORE UPDATE trigger that blocks non-admins from changing
--            role / client_id / status on their own row. The existing
--            users_self_update RLS policy stays intact for name updates.
--
--   STEP 2 — replace the `USING (true)` policies on six "Class C" tables
--            (brand_kits, client_content, media_assets, page_templates,
--            prompt_templates, published_pages) with role + client-scoped
--            policies that mirror the Class A pattern.
--
--   STEP 3 — scope the storage bucket `client-assets` so writes can only
--            touch paths belonging to a client the caller has access to,
--            and remove text/html from the allowed MIME types.
--
-- Service-role-key callers (edge functions) bypass RLS entirely, so all
-- existing service-role flows continue to work. The ad-hoc admin actions
-- handled by edge functions like `invite-user` continue to work because
-- the trigger short-circuits when auth.uid() IS NULL (service role).
-- ============================================================================


-- ============================================================================
-- STEP 1 — Lock sensitive columns on `users` from non-admin self-update
-- ============================================================================
-- Background: 008_fix_users_rls_bootstrap added users_self_update which
-- allows USING/CHECK (id = auth.uid()) — no column restriction. Combined
-- with the `authenticated` UPDATE grant, any signed-in user could
-- PATCH /rest/v1/users?id=eq.{their_uid} to set role='admin'.
--
-- Fix: keep the policy (so users can update their own name) but add a
-- BEFORE UPDATE trigger that raises if a non-admin tries to change
-- role, client_id, or status.

CREATE OR REPLACE FUNCTION users_lock_sensitive_columns()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Service role calls (edge functions, supabase admin client) run with
  -- auth.uid() = NULL. Trust them — they're privileged by design.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin callers bypass the lock.
  SELECT role INTO caller_role FROM users WHERE id = auth.uid();
  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Everyone else must leave sensitive columns untouched.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only admins can change a user role';
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Only admins can change a user client_id';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only admins can change a user status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_lock_sensitive ON users;
CREATE TRIGGER trg_users_lock_sensitive
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION users_lock_sensitive_columns();


-- ============================================================================
-- STEP 2 — Replace USING (true) policies on Class C tables
-- ============================================================================

-- ─── brand_kits — client-scoped ────────────────────────────────────────────
DROP POLICY IF EXISTS brand_kits_anon_select ON brand_kits;
DROP POLICY IF EXISTS brand_kits_anon_insert ON brand_kits;
DROP POLICY IF EXISTS brand_kits_anon_update ON brand_kits;
DROP POLICY IF EXISTS brand_kits_anon_delete ON brand_kits;

CREATE POLICY brand_kits_admin_all ON brand_kits
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY brand_kits_team_editor_select ON brand_kits
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY brand_kits_team_editor_insert ON brand_kits
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY brand_kits_team_editor_update ON brand_kits
  FOR UPDATE
  USING      (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY brand_kits_team_editor_delete ON brand_kits
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY brand_kits_team_viewer_select ON brand_kits
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY brand_kits_client_select ON brand_kits
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ─── client_content — client-scoped ────────────────────────────────────────
DROP POLICY IF EXISTS client_content_anon_read   ON client_content;
DROP POLICY IF EXISTS client_content_auth_read   ON client_content;
DROP POLICY IF EXISTS client_content_auth_insert ON client_content;
DROP POLICY IF EXISTS client_content_auth_update ON client_content;
DROP POLICY IF EXISTS client_content_auth_delete ON client_content;

CREATE POLICY client_content_admin_all ON client_content
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY client_content_team_editor_select ON client_content
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY client_content_team_editor_insert ON client_content
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY client_content_team_editor_update ON client_content
  FOR UPDATE
  USING      (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY client_content_team_editor_delete ON client_content
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY client_content_team_viewer_select ON client_content
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY client_content_client_select ON client_content
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ─── media_assets — client-scoped ──────────────────────────────────────────
DROP POLICY IF EXISTS media_assets_anon_select ON media_assets;
DROP POLICY IF EXISTS media_assets_anon_insert ON media_assets;
DROP POLICY IF EXISTS media_assets_anon_update ON media_assets;
DROP POLICY IF EXISTS media_assets_anon_delete ON media_assets;

CREATE POLICY media_assets_admin_all ON media_assets
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY media_assets_team_editor_select ON media_assets
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY media_assets_team_editor_insert ON media_assets
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY media_assets_team_editor_update ON media_assets
  FOR UPDATE
  USING      (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY media_assets_team_editor_delete ON media_assets
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY media_assets_team_viewer_select ON media_assets
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY media_assets_client_select ON media_assets
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- ─── published_pages — client-scoped ───────────────────────────────────────
-- Note: the public landing-page renderer (`/p/[client]/[slug]`) reads
-- published_pages WITHOUT a logged-in session — using only the anon key
-- but only via an edge function or server component that uses the service
-- role key. After this migration, ANY public-render path must go through
-- a service-role edge function (which already bypasses RLS) or be
-- specifically allowed. Spot-check confirms `(landing)/p/[client]/[slug]`
-- queries via supabase client which uses the anon key. We add an anon
-- SELECT policy gated on status='published' to keep public landing pages
-- working.
DROP POLICY IF EXISTS published_pages_anon_select ON published_pages;
DROP POLICY IF EXISTS published_pages_anon_insert ON published_pages;
DROP POLICY IF EXISTS published_pages_anon_update ON published_pages;
DROP POLICY IF EXISTS published_pages_anon_delete ON published_pages;

CREATE POLICY published_pages_admin_all ON published_pages
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY published_pages_team_editor_select ON published_pages
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY published_pages_team_editor_insert ON published_pages
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY published_pages_team_editor_update ON published_pages
  FOR UPDATE
  USING      (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));
CREATE POLICY published_pages_team_editor_delete ON published_pages
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY published_pages_team_viewer_select ON published_pages
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY published_pages_client_select ON published_pages
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- Public landing-page renderer needs to read published rows even without
-- a session. Restrict to 'published' status only.
CREATE POLICY published_pages_public_select_published ON published_pages
  FOR SELECT USING (status = 'published');

-- ─── page_templates — system-level (no client_id) ──────────────────────────
-- Templates are shared system resources. Authenticated users read; admins
-- write. The seeded rows from migration 016 stay intact.
DROP POLICY IF EXISTS page_templates_anon_select ON page_templates;
DROP POLICY IF EXISTS page_templates_anon_insert ON page_templates;

CREATE POLICY page_templates_admin_all ON page_templates
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY page_templates_authenticated_select ON page_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── prompt_templates — mostly system-level with client overrides ──────────
-- system rows: client_id IS NULL — admin-only write
-- client overrides: client_id set — admin or team_editor with client access
DROP POLICY IF EXISTS prompt_templates_select ON prompt_templates;
DROP POLICY IF EXISTS prompt_templates_insert ON prompt_templates;
DROP POLICY IF EXISTS prompt_templates_update ON prompt_templates;
DROP POLICY IF EXISTS prompt_templates_delete ON prompt_templates;

CREATE POLICY prompt_templates_admin_all ON prompt_templates
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Authenticated users can read all prompt templates (system + any client's).
-- Content is internal AI plumbing, not customer-sensitive data.
CREATE POLICY prompt_templates_authenticated_select ON prompt_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Team editors can write client-specific overrides for clients they have
-- access to. They cannot touch system defaults (client_id IS NULL).
CREATE POLICY prompt_templates_team_editor_insert ON prompt_templates
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'team_editor'
    AND client_id IS NOT NULL
    AND has_client_access(client_id)
  );
CREATE POLICY prompt_templates_team_editor_update ON prompt_templates
  FOR UPDATE
  USING (
    get_user_role() = 'team_editor'
    AND client_id IS NOT NULL
    AND has_client_access(client_id)
  )
  WITH CHECK (
    get_user_role() = 'team_editor'
    AND client_id IS NOT NULL
    AND has_client_access(client_id)
  );
CREATE POLICY prompt_templates_team_editor_delete ON prompt_templates
  FOR DELETE
  USING (
    get_user_role() = 'team_editor'
    AND client_id IS NOT NULL
    AND has_client_access(client_id)
  );


-- ============================================================================
-- STEP 3 — Scope the client-assets storage bucket
-- ============================================================================
-- Path conventions in this codebase:
--   {client_id}/logo-*.{ext}             — uploaded by LogoUpload component
--   {client_id}/...                      — generic client assets
--   banners/{client_id}/{ad_name}_V{n}.{ext}   — banner assets per ad
--
-- The first segment is either a UUID or the literal "banners". When it's
-- "banners", the second segment is the client UUID.

CREATE OR REPLACE FUNCTION storage_path_client_id(path TEXT)
RETURNS UUID AS $$
DECLARE
  first_seg TEXT;
BEGIN
  IF path IS NULL OR path = '' THEN
    RETURN NULL;
  END IF;
  first_seg := split_part(path, '/', 1);
  IF first_seg = 'banners' THEN
    RETURN split_part(path, '/', 2)::UUID;
  END IF;
  RETURN first_seg::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;  -- Path didn't decode to a UUID — caller-side will reject.
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop the open auth_* policies and replace with client-scoped ones.
DROP POLICY IF EXISTS storage_client_assets_auth_upload ON storage.objects;
DROP POLICY IF EXISTS storage_client_assets_auth_update ON storage.objects;
DROP POLICY IF EXISTS storage_client_assets_auth_delete ON storage.objects;

-- Insert (upload) — caller must have access to the client whose ID
-- appears in the path.
CREATE POLICY storage_client_assets_scoped_upload ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'client-assets'
    AND has_client_access(storage_path_client_id(name))
  );

-- Update (overwrite) — same check on existing path AND new path.
CREATE POLICY storage_client_assets_scoped_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'client-assets'
    AND has_client_access(storage_path_client_id(name))
  )
  WITH CHECK (
    bucket_id = 'client-assets'
    AND has_client_access(storage_path_client_id(name))
  );

-- Delete — caller must have access to the client whose ID owns the path.
CREATE POLICY storage_client_assets_scoped_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'client-assets'
    AND has_client_access(storage_path_client_id(name))
  );

-- Public read policy stays (storage_client_assets_public_read) — assets
-- are linked publicly via getPublicUrl().

-- Drop text/html from allowed MIME types. Migration 012 added it for the
-- legacy "deploy landing page to storage" flow that has since moved to
-- GitHub repos, and HTML uploads are a stored-XSS vector against the
-- bucket's public-read URL.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
WHERE id = 'client-assets';
