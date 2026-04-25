-- ============================================================================
-- 028_ad_builder.sql
-- Ad Builder feature
--   * adds short codes to avatars (audiences) and offers
--   * adds ad_components table (BH/SH/T/PC/CTA library)
--   * adds ads table (composition of components for a client/audience/offer)
--   * adds banner_assets table (rendered banner variations per ad)
-- Naming scheme: {OFFER_CODE}_{AUDIENCE_CODE}_BH{seq}-{BODY_TYPE}{seq}-CTA{seq}
-- IDs in name use a per-client per-type sequence (NOT the UUID PK) for
-- short, human-readable names. Codes are unique per client.
-- ============================================================================

-- ============================================================================
-- 1. Codes on offers and avatars
--    Per-client unique. Format: 2-6 uppercase letters/digits.
-- ============================================================================
ALTER TABLE offers  ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE avatars ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE offers
  ADD CONSTRAINT offers_code_format
  CHECK (code IS NULL OR code ~ '^[A-Z0-9]{2,6}$');

ALTER TABLE avatars
  ADD CONSTRAINT avatars_code_format
  CHECK (code IS NULL OR code ~ '^[A-Z0-9]{2,6}$');

-- Per-client unique (NULLs allowed; only enforce when both client_id and code set)
CREATE UNIQUE INDEX offers_client_code_unique
  ON offers (client_id, code)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX avatars_client_code_unique
  ON avatars (client_id, code)
  WHERE code IS NOT NULL;

-- ============================================================================
-- 2. ad_components — reusable copy blocks for ads (separate from copy_components)
--    Types: BH (Banner Headline), SH (Subheadline), T (Trust Signal),
--           PC (Proof Copy), CTA (Call to Action)
-- ============================================================================
CREATE TABLE ad_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('BH', 'SH', 'T', 'PC', 'CTA')),
  content         TEXT NOT NULL,
  -- BH-specific: which audience(s) this BH was written for. UUIDs of avatars.
  audience_ids    UUID[] NOT NULL DEFAULT '{}',
  -- Per-client per-type sequence number. Used in the ad name (e.g. "BH4").
  -- Stable across content edits. Computed by trigger on insert.
  per_client_seq  INTEGER NOT NULL,
  -- Bumped when `content` changes so ads can pin a snapshot version.
  version         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'denied')),
  created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ad_components IS 'Banner Headline / Subheadline / Trust / Proof / CTA copy blocks used to compose ads';
COMMENT ON COLUMN ad_components.per_client_seq IS 'Per-client per-type sequence used in ad names (BH4, T2, CTA7…). Stable across content edits.';
COMMENT ON COLUMN ad_components.version IS 'Bumps when content is edited; ads pin a version at compose time';

-- Banner Headline rules: must be tagged to >=1 audience and <=60 chars.
-- Other types are unconstrained on these fields.
ALTER TABLE ad_components
  ADD CONSTRAINT ad_components_bh_audience
  CHECK (type <> 'BH' OR array_length(audience_ids, 1) >= 1);

ALTER TABLE ad_components
  ADD CONSTRAINT ad_components_bh_length
  CHECK (type <> 'BH' OR char_length(content) <= 60);

CREATE INDEX idx_ad_components_client_type ON ad_components (client_id, type);
CREATE INDEX idx_ad_components_audiences   ON ad_components USING GIN (audience_ids);
CREATE UNIQUE INDEX ad_components_seq_unique
  ON ad_components (client_id, type, per_client_seq);

-- Per-client per-type sequence: assign per_client_seq on insert.
-- Serialises concurrent inserts for the same (client_id, type) bucket via a
-- transaction-scoped advisory lock keyed off the UUID hash + type ordinal.
CREATE OR REPLACE FUNCTION ad_components_assign_seq()
RETURNS TRIGGER AS $$
DECLARE
  v_lock_key BIGINT;
  v_next     INTEGER;
BEGIN
  v_lock_key := ('x' || substr(md5(NEW.client_id::text || ':' || NEW.type), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(per_client_seq), 0) + 1
    INTO v_next
    FROM ad_components
   WHERE client_id = NEW.client_id
     AND type      = NEW.type;

  NEW.per_client_seq := v_next;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_components_assign_seq
  BEFORE INSERT ON ad_components
  FOR EACH ROW
  EXECUTE FUNCTION ad_components_assign_seq();

-- Bump version when content changes.
CREATE OR REPLACE FUNCTION ad_components_bump_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_components_bump_version
  BEFORE UPDATE ON ad_components
  FOR EACH ROW
  EXECUTE FUNCTION ad_components_bump_version();

CREATE TRIGGER trg_ad_components_updated_at
  BEFORE UPDATE ON ad_components
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. ads — a composition of three components targeting an offer + audience.
--    Slot rules:
--      bh_component_id   -> ad_components.type = 'BH'
--      body_component_id -> ad_components.type IN ('SH','T','PC')
--      cta_component_id  -> ad_components.type = 'CTA'
--    The BH must be tagged for the chosen audience.
--    `name` is generated by trigger from offer.code/audience.code/component seqs.
-- ============================================================================
CREATE TABLE ads (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  offer_id                    UUID NOT NULL REFERENCES offers  (id) ON DELETE RESTRICT,
  -- "audience" = avatar in this codebase
  audience_id                 UUID NOT NULL REFERENCES avatars (id) ON DELETE RESTRICT,
  bh_component_id             UUID NOT NULL REFERENCES ad_components (id) ON DELETE RESTRICT,
  body_component_id           UUID NOT NULL REFERENCES ad_components (id) ON DELETE RESTRICT,
  cta_component_id            UUID NOT NULL REFERENCES ad_components (id) ON DELETE RESTRICT,
  -- Versions of each referenced component at compose time. Lets us know what
  -- copy was actually used even if the component is later edited.
  bh_component_version        INTEGER NOT NULL,
  body_component_version      INTEGER NOT NULL,
  cta_component_version       INTEGER NOT NULL,
  -- Generated name. Set by trigger; not user-editable.
  name                        TEXT NOT NULL DEFAULT '',
  status                      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'denied')),
  created_by                  UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ads IS 'Composed ads: BH + (SH|T|PC) + CTA tied to an offer and audience. Name is generated.';

CREATE INDEX idx_ads_client    ON ads (client_id);
CREATE INDEX idx_ads_offer     ON ads (offer_id);
CREATE INDEX idx_ads_audience  ON ads (audience_id);

-- Validate slot types and audience match. Also fill the version columns
-- automatically from each component's current version.
CREATE OR REPLACE FUNCTION ads_validate_and_fill()
RETURNS TRIGGER AS $$
DECLARE
  v_bh_type            TEXT;
  v_bh_audiences       UUID[];
  v_bh_version         INTEGER;
  v_body_type          TEXT;
  v_body_version       INTEGER;
  v_cta_type           TEXT;
  v_cta_version        INTEGER;
  v_offer_code         TEXT;
  v_audience_code      TEXT;
BEGIN
  SELECT type, audience_ids, version
    INTO v_bh_type, v_bh_audiences, v_bh_version
    FROM ad_components WHERE id = NEW.bh_component_id;

  SELECT type, version
    INTO v_body_type, v_body_version
    FROM ad_components WHERE id = NEW.body_component_id;

  SELECT type, version
    INTO v_cta_type, v_cta_version
    FROM ad_components WHERE id = NEW.cta_component_id;

  IF v_bh_type IS DISTINCT FROM 'BH' THEN
    RAISE EXCEPTION 'Top slot must be a Banner Headline (BH); got %', v_bh_type;
  END IF;
  IF v_body_type NOT IN ('SH', 'T', 'PC') THEN
    RAISE EXCEPTION 'Body slot must be SH, T, or PC; got %', v_body_type;
  END IF;
  IF v_cta_type IS DISTINCT FROM 'CTA' THEN
    RAISE EXCEPTION 'CTA slot must be a CTA component; got %', v_cta_type;
  END IF;
  IF NOT (NEW.audience_id = ANY(v_bh_audiences)) THEN
    RAISE EXCEPTION 'Banner Headline is not tagged for this audience';
  END IF;

  -- Pin component versions on insert; on update only if the referenced
  -- component changed (i.e. the user picked a different one).
  IF TG_OP = 'INSERT' THEN
    NEW.bh_component_version   := v_bh_version;
    NEW.body_component_version := v_body_version;
    NEW.cta_component_version  := v_cta_version;
  ELSE
    IF NEW.bh_component_id   IS DISTINCT FROM OLD.bh_component_id   THEN NEW.bh_component_version   := v_bh_version;   END IF;
    IF NEW.body_component_id IS DISTINCT FROM OLD.body_component_id THEN NEW.body_component_version := v_body_version; END IF;
    IF NEW.cta_component_id  IS DISTINCT FROM OLD.cta_component_id  THEN NEW.cta_component_version  := v_cta_version;  END IF;
  END IF;

  -- Resolve codes and component seqs to build the name.
  SELECT code INTO v_offer_code    FROM offers  WHERE id = NEW.offer_id;
  SELECT code INTO v_audience_code FROM avatars WHERE id = NEW.audience_id;

  IF v_offer_code    IS NULL THEN RAISE EXCEPTION 'Offer is missing a code';    END IF;
  IF v_audience_code IS NULL THEN RAISE EXCEPTION 'Audience is missing a code'; END IF;

  NEW.name := format(
    '%s_%s_BH%s-%s%s-CTA%s',
    v_offer_code,
    v_audience_code,
    (SELECT per_client_seq FROM ad_components WHERE id = NEW.bh_component_id),
    v_body_type,
    (SELECT per_client_seq FROM ad_components WHERE id = NEW.body_component_id),
    (SELECT per_client_seq FROM ad_components WHERE id = NEW.cta_component_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ads_validate_and_fill
  BEFORE INSERT OR UPDATE ON ads
  FOR EACH ROW
  EXECUTE FUNCTION ads_validate_and_fill();

CREATE TRIGGER trg_ads_updated_at
  BEFORE UPDATE ON ads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 4. banner_assets — rendered banner variations per ad
--    storage_path lives in the existing `client-assets` bucket under
--    banners/{client_id}/{ad.name}_V{variation}.{ext}
-- ============================================================================
CREATE TABLE banner_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id        UUID NOT NULL REFERENCES ads (id) ON DELETE CASCADE,
  variation    INTEGER NOT NULL CHECK (variation >= 1),
  source       TEXT NOT NULL CHECK (source IN ('ai', 'designer')),
  storage_path TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  created_by   UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_id, variation)
);

COMMENT ON TABLE banner_assets IS 'Rendered banner variations attached to an ad. Multiple variations per ad allowed (V1, V2, V3…)';

CREATE INDEX idx_banner_assets_ad ON banner_assets (ad_id);

-- ============================================================================
-- 5. Row Level Security — match existing per-client pattern
-- ============================================================================
ALTER TABLE ad_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_assets ENABLE ROW LEVEL SECURITY;

-- ----- ad_components ---------------------------------------------------------
CREATE POLICY ad_components_admin_all ON ad_components
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY ad_components_team_editor_select ON ad_components
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ad_components_team_editor_insert ON ad_components
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ad_components_team_editor_update ON ad_components
  FOR UPDATE
  USING      (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ad_components_team_editor_delete ON ad_components
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ad_components_team_viewer_select ON ad_components
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY ad_components_client_select ON ad_components
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

-- Client may "deny" (status only).
CREATE POLICY ad_components_client_update_status ON ad_components
  FOR UPDATE
  USING      (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id) AND status = 'denied');

-- ----- ads -------------------------------------------------------------------
CREATE POLICY ads_admin_all ON ads
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY ads_team_editor_select ON ads
  FOR SELECT USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ads_team_editor_insert ON ads
  FOR INSERT WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ads_team_editor_update ON ads
  FOR UPDATE
  USING      (get_user_role() = 'team_editor' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ads_team_editor_delete ON ads
  FOR DELETE USING (get_user_role() = 'team_editor' AND has_client_access(client_id));

CREATE POLICY ads_team_viewer_select ON ads
  FOR SELECT USING (get_user_role() = 'team_viewer' AND has_client_access(client_id));

CREATE POLICY ads_client_select ON ads
  FOR SELECT USING (get_user_role() = 'client' AND has_client_access(client_id));

CREATE POLICY ads_client_update_status ON ads
  FOR UPDATE
  USING      (get_user_role() = 'client' AND has_client_access(client_id))
  WITH CHECK (get_user_role() = 'client' AND has_client_access(client_id) AND status = 'denied');

-- ----- banner_assets ---------------------------------------------------------
-- Scoped through the parent ad's client_id.
CREATE POLICY banner_assets_admin_all ON banner_assets
  FOR ALL
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY banner_assets_team_editor_select ON banner_assets
  FOR SELECT USING (
    get_user_role() = 'team_editor'
    AND EXISTS (SELECT 1 FROM ads WHERE ads.id = banner_assets.ad_id AND has_client_access(ads.client_id))
  );

CREATE POLICY banner_assets_team_editor_insert ON banner_assets
  FOR INSERT WITH CHECK (
    get_user_role() = 'team_editor'
    AND EXISTS (SELECT 1 FROM ads WHERE ads.id = banner_assets.ad_id AND has_client_access(ads.client_id))
  );

CREATE POLICY banner_assets_team_editor_update ON banner_assets
  FOR UPDATE
  USING (
    get_user_role() = 'team_editor'
    AND EXISTS (SELECT 1 FROM ads WHERE ads.id = banner_assets.ad_id AND has_client_access(ads.client_id))
  )
  WITH CHECK (
    get_user_role() = 'team_editor'
    AND EXISTS (SELECT 1 FROM ads WHERE ads.id = banner_assets.ad_id AND has_client_access(ads.client_id))
  );

CREATE POLICY banner_assets_team_editor_delete ON banner_assets
  FOR DELETE USING (
    get_user_role() = 'team_editor'
    AND EXISTS (SELECT 1 FROM ads WHERE ads.id = banner_assets.ad_id AND has_client_access(ads.client_id))
  );

CREATE POLICY banner_assets_team_viewer_select ON banner_assets
  FOR SELECT USING (
    get_user_role() = 'team_viewer'
    AND EXISTS (SELECT 1 FROM ads WHERE ads.id = banner_assets.ad_id AND has_client_access(ads.client_id))
  );

CREATE POLICY banner_assets_client_select ON banner_assets
  FOR SELECT USING (
    get_user_role() = 'client'
    AND EXISTS (SELECT 1 FROM ads WHERE ads.id = banner_assets.ad_id AND has_client_access(ads.client_id))
  );
