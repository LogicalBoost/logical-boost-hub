-- ============================================================================
-- 035_ads_use_copy_components.sql
-- Pivot the Ad Builder data model to match the spec:
--   "If they're already split per type, keep that and just add a banner_headlines
--    table with the same shape." (spec §4)
--
-- Existing copy already lives in copy_components — Subheadlines (~232 rows),
-- Proof (~252), CTAs (~270), etc. The previous migrations created a parallel
-- ad_components table that duplicated those types but stayed empty, so the
-- /ads/bulk view had nothing to combine.
--
-- This migration:
--   1. Renames ad_components -> banner_headlines (BH-only).
--   2. Repoints ads.body_component_id and ads.cta_component_id at copy_components.
--   3. Rewrites the slot-validation trigger:
--        - bh_component_id  -> banner_headlines (still requires audience tag)
--        - body_component_id -> copy_components.type IN ('subheadline','hero_subheadline','proof')
--        - cta_component_id  -> copy_components.type IN ('cta','hero_cta')
--   4. Updates the generated name: body raw type maps to a 2-letter group code
--      (subheadline/hero_subheadline -> SH; proof -> PC; cta/hero_cta -> CTA),
--      and the seq is the row's position within its group for that client
--      (ordered by created_at, id).
--
-- ad_components was empty in prod, so the rename is non-destructive.
-- (Migration 036 supersedes the BH half by moving BH into copy_components and
-- dropping the banner_headlines table entirely — the "split per type" approach
-- isn't worth the second table when copy_components already supports per-type
-- discrimination.)
-- ============================================================================

ALTER TABLE ads DROP CONSTRAINT ads_body_component_id_fkey;
ALTER TABLE ads DROP CONSTRAINT ads_cta_component_id_fkey;

ALTER TABLE ads ALTER COLUMN body_component_version DROP NOT NULL;
ALTER TABLE ads ALTER COLUMN cta_component_version  DROP NOT NULL;

ALTER TABLE ad_components RENAME TO banner_headlines;
ALTER TABLE ads RENAME CONSTRAINT ads_bh_component_id_fkey TO ads_bh_banner_headline_fkey;

ALTER TABLE banner_headlines DROP CONSTRAINT ad_components_bh_audience;
ALTER TABLE banner_headlines DROP CONSTRAINT ad_components_bh_length;
ALTER TABLE banner_headlines DROP CONSTRAINT ad_components_type_check;
ALTER TABLE banner_headlines DROP CONSTRAINT ad_components_status_check;

ALTER TABLE banner_headlines
  ADD CONSTRAINT banner_headlines_audience CHECK (cardinality(audience_ids) >= 1),
  ADD CONSTRAINT banner_headlines_length   CHECK (char_length(content) <= 60),
  ADD CONSTRAINT banner_headlines_type_bh  CHECK (type = 'BH'),
  ADD CONSTRAINT banner_headlines_status_check CHECK (status IN ('approved', 'denied'));

ALTER TABLE banner_headlines ALTER COLUMN type SET DEFAULT 'BH';

ALTER INDEX idx_ad_components_client_type RENAME TO idx_banner_headlines_client_type;
ALTER INDEX idx_ad_components_audiences   RENAME TO idx_banner_headlines_audiences;
ALTER INDEX ad_components_seq_unique      RENAME TO banner_headlines_seq_unique;

ALTER TABLE ads
  ADD CONSTRAINT ads_body_component_copy_fkey
    FOREIGN KEY (body_component_id) REFERENCES copy_components (id) ON DELETE RESTRICT;

ALTER TABLE ads
  ADD CONSTRAINT ads_cta_component_copy_fkey
    FOREIGN KEY (cta_component_id) REFERENCES copy_components (id) ON DELETE RESTRICT;

DROP TRIGGER IF EXISTS trg_ad_components_assign_seq   ON banner_headlines;
DROP TRIGGER IF EXISTS trg_ad_components_bump_version ON banner_headlines;
DROP TRIGGER IF EXISTS trg_ad_components_updated_at   ON banner_headlines;
DROP FUNCTION IF EXISTS ad_components_assign_seq();
DROP FUNCTION IF EXISTS ad_components_bump_version();

CREATE OR REPLACE FUNCTION banner_headlines_assign_seq()
RETURNS TRIGGER AS $$
DECLARE
  v_lock_key BIGINT;
  v_next     INTEGER;
BEGIN
  v_lock_key := ('x' || substr(md5(NEW.client_id::text || ':BH'), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(per_client_seq), 0) + 1
    INTO v_next
    FROM banner_headlines
   WHERE client_id = NEW.client_id;

  NEW.per_client_seq := v_next;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_banner_headlines_assign_seq
  BEFORE INSERT ON banner_headlines
  FOR EACH ROW
  EXECUTE FUNCTION banner_headlines_assign_seq();

CREATE OR REPLACE FUNCTION banner_headlines_bump_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_banner_headlines_bump_version
  BEFORE UPDATE ON banner_headlines
  FOR EACH ROW
  EXECUTE FUNCTION banner_headlines_bump_version();

CREATE TRIGGER trg_banner_headlines_updated_at
  BEFORE UPDATE ON banner_headlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_ads_validate_and_fill ON ads;
DROP FUNCTION IF EXISTS ads_validate_and_fill();

CREATE OR REPLACE FUNCTION ads_validate_and_fill()
RETURNS TRIGGER AS $$
DECLARE
  v_offer_code        TEXT;
  v_audience_code     TEXT;
  v_bh_audiences      UUID[];
  v_bh_version        INTEGER;
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

  SELECT audience_ids, version, per_client_seq
    INTO v_bh_audiences, v_bh_version, v_bh_seq
    FROM banner_headlines WHERE id = NEW.bh_component_id;

  IF v_bh_audiences IS NULL THEN
    RAISE EXCEPTION 'Banner Headline component % not found', NEW.bh_component_id;
  END IF;
  IF NOT (NEW.audience_id = ANY(v_bh_audiences)) THEN
    RAISE EXCEPTION 'Banner Headline is not tagged for this audience';
  END IF;

  SELECT type, client_id, created_at
    INTO v_body_raw_type, v_body_client_id, v_body_created_at
    FROM copy_components WHERE id = NEW.body_component_id;
  IF v_body_raw_type IS NULL THEN
    RAISE EXCEPTION 'Body component % not found', NEW.body_component_id;
  END IF;
  IF v_body_client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'Body component belongs to a different client';
  END IF;

  SELECT type, client_id, created_at
    INTO v_cta_raw_type, v_cta_client_id, v_cta_created_at
    FROM copy_components WHERE id = NEW.cta_component_id;
  IF v_cta_raw_type IS NULL THEN
    RAISE EXCEPTION 'CTA component % not found', NEW.cta_component_id;
  END IF;
  IF v_cta_client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'CTA component belongs to a different client';
  END IF;

  IF v_body_raw_type IN ('subheadline', 'hero_subheadline') THEN
    v_body_code := 'SH';
  ELSIF v_body_raw_type IN ('proof') THEN
    v_body_code := 'PC';
  ELSE
    RAISE EXCEPTION 'Body slot must be subheadline / hero_subheadline / proof; got %', v_body_raw_type;
  END IF;

  IF v_cta_raw_type NOT IN ('cta', 'hero_cta') THEN
    RAISE EXCEPTION 'CTA slot must be cta / hero_cta; got %', v_cta_raw_type;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.bh_component_version := v_bh_version;
    NEW.body_component_version := NULL;
    NEW.cta_component_version  := NULL;
  ELSIF NEW.bh_component_id IS DISTINCT FROM OLD.bh_component_id THEN
    NEW.bh_component_version := v_bh_version;
  END IF;

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

ALTER POLICY ad_components_admin_all                ON banner_headlines RENAME TO banner_headlines_admin_all;
ALTER POLICY ad_components_team_editor_select       ON banner_headlines RENAME TO banner_headlines_team_editor_select;
ALTER POLICY ad_components_team_editor_insert       ON banner_headlines RENAME TO banner_headlines_team_editor_insert;
ALTER POLICY ad_components_team_editor_update       ON banner_headlines RENAME TO banner_headlines_team_editor_update;
ALTER POLICY ad_components_team_editor_delete       ON banner_headlines RENAME TO banner_headlines_team_editor_delete;
ALTER POLICY ad_components_team_viewer_select       ON banner_headlines RENAME TO banner_headlines_team_viewer_select;
ALTER POLICY ad_components_client_select            ON banner_headlines RENAME TO banner_headlines_client_select;
ALTER POLICY ad_components_client_update_status     ON banner_headlines RENAME TO banner_headlines_client_update_status;

COMMENT ON TABLE banner_headlines IS
  'Banner Headlines for the Ad Builder. (Superseded by 036, which moves BH into copy_components and drops this table.)';
