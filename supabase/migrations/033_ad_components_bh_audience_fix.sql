-- ============================================================================
-- 033_ad_components_bh_audience_fix.sql
-- Fix BH audience-tag CHECK constraint.
--
-- The original constraint used `array_length(audience_ids, 1) >= 1` to require
-- at least one tagged audience for BH rows. But Postgres returns NULL — not 0 —
-- from array_length on an empty array, and `NULL >= 1` evaluates to NULL,
-- which CHECK treats as TRUE. So a BH with audience_ids = '{}' was silently
-- accepted.
--
-- Replace with cardinality() which returns 0 for empty arrays.
-- ============================================================================
ALTER TABLE ad_components DROP CONSTRAINT ad_components_bh_audience;

ALTER TABLE ad_components
  ADD CONSTRAINT ad_components_bh_audience
  CHECK (type <> 'BH' OR cardinality(audience_ids) >= 1);
