-- ============================================================================
-- 036_bh_into_copy_components.sql
-- Fold Banner Headlines into copy_components alongside the other copy types.
--
-- Rationale: the existing /copy/ page already shows every copy type as its own
-- column (subheadline, hero_subheadline, proof, cta, etc.). The user wants BH
-- to be one more column on that page, with the same row-list UX, plus a
-- "Generate with AI" button. Keeping BH in its own table forced two parallel
-- code paths in the UI for no real benefit, since copy_components already
-- supports per-client per-type filtering and an avatar_ids JSONB array which
-- is exactly what BH needs for audience tagging.
--
-- This migration:
--   1. Adds a CHECK constraint requiring BH rows to have audience tags and
--      stay under 60 chars. Other types are unconstrained on these.
--   2. Repoints ads.bh_component_id at copy_components.
--   3. Drops the banner_headlines table (empty in prod) and its triggers.
--   4. Rewrites the ads validate/fill trigger to look up BH from copy_components.
--
-- Naming convention: BH rows have type = 'banner_headline'.
-- ============================================================================

-- 1. CHECK constraints on copy_components for BH rules.
-- avatar_ids on copy_components is JSONB; jsonb_array_length is NULL on
-- non-arrays, so we coerce to 0.
ALTER TABLE copy_components
  ADD CONSTRAINT copy_components_bh_audience
  CHECK (
    type <> 'banner_headline'
    OR (avatar_ids IS NOT NULL AND jsonb_typeof(avatar_ids) = 'array' AND jsonb_array_length(avatar_ids) >= 1)
  );

ALTER TABLE copy_components
  ADD CONSTRAINT copy_components_bh_length
  CHECK (
    type <> 'banner_headline'
    OR char_length(text) <= 60
  );

-- 2. Repoint ads.bh_component_id at copy_components.
ALTER TABLE ads DROP CONSTRAINT ads_bh_banner_headline_fkey;
ALTER TABLE ads ALTER COLUMN bh_component_version DROP NOT NULL;
ALTER TABLE ads
  ADD CONSTRAINT ads_bh_component_copy_fkey
    FOREIGN KEY (bh_component_id) REFERENCES copy_components (id) ON DELETE RESTRICT;

-- 3. Drop the banner_headlines table and its supporting code. It was empty.
DROP TRIGGER IF EXISTS trg_banner_headlines_assign_seq    ON banner_headlines;
DROP TRIGGER IF EXISTS trg_banner_headlines_bump_version  ON banner_headlines;
DROP TRIGGER IF EXISTS trg_banner_headlines_updated_at    ON banner_headlines;
DROP FUNCTION IF EXISTS banner_headlines_assign_seq();
DROP FUNCTION IF EXISTS banner_headlines_bump_version();
DROP TABLE banner_headlines;

-- 4. Rewrite the ads validate/fill trigger.
DROP TRIGGER IF EXISTS trg_ads_validate_and_fill ON ads;
DROP FUNCTION IF EXISTS ads_validate_and_fill();

CREATE OR REPLACE FUNCTION ads_validate_and_fill()
RETURNS TRIGGER AS $$
DECLARE
  v_offer_code        TEXT;
  v_audience_code     TEXT;
  v_bh_type           TEXT;
  v_bh_avatar_ids     JSONB;
  v_bh_client_id      UUID;
  v_bh_created_at     TIMESTAMPTZ;
  v_bh_seq            INTEGER;
  v_body_raw_type     TEXT;
  v_body_code         TEXT;
  v_body_seq          INTEGER;
  v_body_client_id    UUID;
  v_body_created_at   TIMESTAMPTZ;
  v_cta_raw_type      TEXT;
  v_cta_seq           INTEGER;
  v_cta_client_id     UUID;
  v_cta_created_at    TIMESTAMPTZ;
BEGIN
  SELECT code INTO v_offer_code    FROM offers  WHERE id = NEW.offer_id;
  SELECT code INTO v_audience_code FROM avatars WHERE id = NEW.audience_id;
  IF v_offer_code    IS NULL THEN RAISE EXCEPTION 'Offer is missing a code';    END IF;
  IF v_audience_code IS NULL THEN RAISE EXCEPTION 'Audience is missing a code'; END IF;

  -- BH lookup from copy_components.
  SELECT type, avatar_ids, client_id, created_at
    INTO v_bh_type, v_bh_avatar_ids, v_bh_client_id, v_bh_created_at
    FROM copy_components WHERE id = NEW.bh_component_id;

  IF v_bh_type IS NULL THEN
    RAISE EXCEPTION 'Banner Headline component % not found', NEW.bh_component_id;
  END IF;
  IF v_bh_type <> 'banner_headline' THEN
    RAISE EXCEPTION 'BH slot must be a banner_headline copy component; got %', v_bh_type;
  END IF;
  IF v_bh_client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'Banner Headline belongs to a different client';
  END IF;
  IF v_bh_avatar_ids IS NULL OR NOT (v_bh_avatar_ids ? NEW.audience_id::text) THEN
    RAISE EXCEPTION 'Banner Headline is not tagged for this audience';
  END IF;

  -- Body and CTA: same as 035 — copy_components by raw type.
  SELECT type, client_id, created_at
    INTO v_body_raw_type, v_body_client_id, v_body_created_at
    FROM copy_components WHERE id = NEW.body_component_id;
  IF v_body_raw_type IS NULL THEN RAISE EXCEPTION 'Body component % not found', NEW.body_component_id; END IF;
  IF v_body_client_id <> NEW.client_id THEN RAISE EXCEPTION 'Body component belongs to a different client'; END IF;

  SELECT type, client_id, created_at
    INTO v_cta_raw_type, v_cta_client_id, v_cta_created_at
    FROM copy_components WHERE id = NEW.cta_component_id;
  IF v_cta_raw_type IS NULL THEN RAISE EXCEPTION 'CTA component % not found', NEW.cta_component_id; END IF;
  IF v_cta_client_id <> NEW.client_id THEN RAISE EXCEPTION 'CTA component belongs to a different client'; END IF;

  IF v_body_raw_type IN ('subheadline', 'hero_subheadline') THEN
    v_body_code := 'SH';
  ELSIF v_body_raw_type = 'proof' THEN
    v_body_code := 'PC';
  ELSE
    RAISE EXCEPTION 'Body slot must be subheadline / hero_subheadline / proof; got %', v_body_raw_type;
  END IF;

  IF v_cta_raw_type NOT IN ('cta', 'hero_cta') THEN
    RAISE EXCEPTION 'CTA slot must be cta / hero_cta; got %', v_cta_raw_type;
  END IF;

  -- Versions: copy_components has no version column; clear them.
  IF TG_OP = 'INSERT' THEN
    NEW.bh_component_version   := NULL;
    NEW.body_component_version := NULL;
    NEW.cta_component_version  := NULL;
  END IF;

  -- Per-client per-type seq for BH (over banner_headline rows).
  SELECT COUNT(*) + 1
    INTO v_bh_seq
    FROM copy_components
   WHERE client_id = NEW.client_id
     AND type = 'banner_headline'
     AND (created_at, id) < (v_bh_created_at, NEW.bh_component_id);

  SELECT COUNT(*) + 1
    INTO v_body_seq
    FROM copy_components
   WHERE client_id = NEW.client_id
     AND (
       (v_body_code = 'SH' AND type IN ('subheadline','hero_subheadline'))
       OR (v_body_code = 'PC' AND type = 'proof')
     )
     AND (created_at, id) < (v_body_created_at, NEW.body_component_id);

  SELECT COUNT(*) + 1
    INTO v_cta_seq
    FROM copy_components
   WHERE client_id = NEW.client_id
     AND type IN ('cta', 'hero_cta')
     AND (created_at, id) < (v_cta_created_at, NEW.cta_component_id);

  NEW.name := format(
    '%s_%s_BH%s-%s%s-CTA%s',
    v_offer_code,
    v_audience_code,
    v_bh_seq,
    v_body_code,
    v_body_seq,
    v_cta_seq
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ads_validate_and_fill
  BEFORE INSERT OR UPDATE ON ads
  FOR EACH ROW
  EXECUTE FUNCTION ads_validate_and_fill();

-- An index on (client_id, type) already exists for general copy_components
-- queries; no extra index needed for BH lookups.

COMMENT ON CONSTRAINT copy_components_bh_audience ON copy_components IS
  'Banner Headlines must be tagged to ≥1 audience via avatar_ids.';
COMMENT ON CONSTRAINT copy_components_bh_length ON copy_components IS
  'Banner Headlines must be ≤ 60 characters.';
