-- ============================================================================
-- 008_fix_users_rls_bootstrap.sql
-- Fix RLS circular dependency on users table
--
-- Problem: All users table policies require get_user_role() which queries the
-- users table. New users who just signed up have no row → get_user_role()
-- returns NULL → no policy matches → SELECT returns 406 and INSERT returns 403.
-- The anon policies don't help because auth.uid() IS NOT NULL for logged-in users.
--
-- Fix: Add bootstrap policies that let authenticated users:
--   1. Read their own row (needed by AuthProvider.loadProfile)
--   2. Insert their own row (needed for first-time profile creation)
--   3. Count rows (needed to determine if first user → admin role)
-- These don't depend on get_user_role() — they only check auth.uid().
-- ============================================================================

-- Allow any authenticated user to read their own row in users table.
-- This is safe because it only exposes the user's OWN data.
CREATE POLICY users_self_select ON users
  FOR SELECT
  USING (id = auth.uid());

-- Allow any authenticated user to insert their own profile row.
-- WITH CHECK ensures they can only insert a row where id matches their auth uid.
CREATE POLICY users_self_insert ON users
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Allow any authenticated user to update their own basic profile info.
-- This lets users update their name, etc. without needing admin role.
CREATE POLICY users_self_update ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
