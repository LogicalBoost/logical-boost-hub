-- 039_sample_data_settings.sql
--
-- Per-client sample-data tuning for the Stats page.
--
-- The Stats page renders sample (mock) data driven by a deterministic
-- generator. Until now the generator produced fixed-shape output, so demos
-- never reflected the client's actual targets. This migration stores
-- per-client tuning knobs (target cost-per-conversion, daily conversion
-- range, funnel rates) and a master toggle for showing sample vs. real data.
--
-- Shape (all keys optional; missing keys fall back to generator defaults):
--   {
--     "use_sample_data":             true,
--     "target_cost_per_conversion":  55,
--     "target_daily_conversions":    [8, 18],
--     "qualified_to_conversion_rate": 0.20,
--     "lead_to_qualified_rate":       0.40
--   }
--
-- ── RLS posture ────────────────────────────────────────────────────────
-- This column inherits the existing clients-table RLS from
-- 002_rls_policies.sql:
--   - admin               → full SELECT/UPDATE
--   - team_editor         → SELECT/UPDATE on assigned clients
--   - team_viewer         → SELECT only
--   - client (own row)    → SELECT only — NO UPDATE policy exists for the
--                           client role, so clients physically cannot write
--                           this column even if they POST it. This is the
--                           desired security posture: clients must not be
--                           able to fake their own demo numbers.
--
-- No new policies are added here; the existing structure already blocks
-- client-role writes to every column on the clients table.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sample_data_settings JSONB;

COMMENT ON COLUMN clients.sample_data_settings IS
  'Admin-only tuning for the Stats page mock generator. See migration 039.';

-- ── Seed: SmarterHome.ai ───────────────────────────────────────────────
-- Concrete request from product: SmarterHome.ai wants total cost-per-
-- conversion under $60. Set target to $55 so the demo lands ~$55 with
-- realistic variance and stays under their goal most days. Other knobs
-- left null so the generator uses its sensible defaults.
--
-- Name match is case-insensitive and matches "SmarterHome", "SmarterHome.ai",
-- or any "smarterhome%" variant in case the production row was named
-- slightly differently. No-op if no row matches.
UPDATE clients
SET sample_data_settings = jsonb_build_object(
  'use_sample_data',            true,
  'target_cost_per_conversion', 55
)
WHERE name ILIKE 'smarterhome%'
  AND sample_data_settings IS NULL;
