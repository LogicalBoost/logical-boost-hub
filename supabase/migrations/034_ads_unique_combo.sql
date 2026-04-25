-- ============================================================================
-- 034_ads_unique_combo.sql
-- Unique constraint on the ads composition tuple so the bulk-generation flow
-- can safely use ON CONFLICT DO NOTHING (idempotent re-run).
--
-- The same offer + audience + (BH, body, CTA) combination should only ever
-- exist once per client. If the user wants the same combo with different
-- design variations, those go in banner_assets (V1, V2, V3...).
-- ============================================================================

ALTER TABLE ads
  ADD CONSTRAINT ads_unique_combo
  UNIQUE (client_id, offer_id, audience_id, bh_component_id, body_component_id, cta_component_id);
