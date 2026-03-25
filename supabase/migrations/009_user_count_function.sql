-- ============================================================================
-- 009_user_count_function.sql
-- Provide a safe way to check if any users exist (for first-user admin logic)
--
-- Problem: The AuthProvider counts users to determine if the new signup is the
-- first user (→ admin role). But with RLS, a new user can only see their own
-- row (which doesn't exist yet), so the count is always 0 — making every
-- new user an admin.
--
-- Fix: A SECURITY DEFINER function that returns the total user count,
-- callable via supabase.rpc('get_user_count').
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM users
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users so they can call it via RPC
GRANT EXECUTE ON FUNCTION get_user_count() TO authenticated;
