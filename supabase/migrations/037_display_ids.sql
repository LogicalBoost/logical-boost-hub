-- ============================================================================
-- 037_display_ids.sql
-- Auto-assigned numeric display IDs for offers and audiences (per-client,
-- never-reused). Replaces the user-typed `code` column for ad naming.
--
-- Naming format becomes: AU{audience.display_id}_OF{offer.display_id}_BH{n}-{type}{n}-CTA{n}
-- e.g. AU11_OF3_BH1-SH1-CTA1
--
-- Never-reused semantics: when audience #5 is deleted, the next audience for
-- that client gets #6, not #5. We track that via a per-(client, entity) counter
-- table that only ever increments.
--
-- We don't drop the `code` column — leaves it as legacy metadata in case
-- something else references it. It just stops mattering for ad naming.
-- ============================================================================

-- 1. client_sequences — per-(client, entity_type) counter that only goes up.
CREATE TABLE client_sequences (
  client_id     UUID    NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  entity_type   TEXT    NOT NULL,
  next_id       INTEGER NOT NULL DEFAULT 1 CHECK (next_id >= 1),
  PRIMARY KEY (client_id, entity_type)
);

COMMENT ON TABLE client_sequences IS
  'Per-client per-entity-type counter. next_id is the value that WILL be assigned to the next row of that entity (offer / audience). Never reused after deletion.';

-- 2. display_id columns on offers and avatars (audiences). Nullable until backfill.
ALTER TABLE offers  ADD COLUMN display_id INTEGER;
ALTER TABLE avatars ADD COLUMN display_id INTEGER;

-- 3. Backfill existing rows by created_at ASC (oldest gets the lowest number).
DO $$
DECLARE
  c_id  UUID;
  v_max INTEGER;
BEGIN
  -- Offers
  FOR c_id IN SELECT DISTINCT client_id FROM offers LOOP
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n
      FROM offers WHERE client_id = c_id
    )
    UPDATE offers SET display_id = numbered.n
    FROM numbered WHERE offers.id = numbered.id;

    SELECT COALESCE(MAX(display_id), 0) INTO v_max
    FROM offers WHERE client_id = c_id;

    INSERT INTO client_sequences (client_id, entity_type, next_id)
      VALUES (c_id, 'offer', v_max + 1)
      ON CONFLICT (client_id, entity_type) DO UPDATE
      SET next_id = GREATEST(client_sequences.next_id, EXCLUDED.next_id);
  END LOOP;

  -- Audiences (avatars)
  FOR c_id IN SELECT DISTINCT client_id FROM avatars LOOP
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n
      FROM avatars WHERE client_id = c_id
    )
    UPDATE avatars SET display_id = numbered.n
    FROM numbered WHERE avatars.id = numbered.id;

    SELECT COALESCE(MAX(display_id), 0) INTO v_max
    FROM avatars WHERE client_id = c_id;

    INSERT INTO client_sequences (client_id, entity_type, next_id)
      VALUES (c_id, 'audience', v_max + 1)
      ON CONFLICT (client_id, entity_type) DO UPDATE
      SET next_id = GREATEST(client_sequences.next_id, EXCLUDED.next_id);
  END LOOP;
END $$;

-- 4. Now-NOT-NULL + per-client unique.
ALTER TABLE offers  ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE avatars ALTER COLUMN display_id SET NOT NULL;

CREATE UNIQUE INDEX offers_client_display_id_unique  ON offers  (client_id, display_id);
CREATE UNIQUE INDEX avatars_client_display_id_unique ON avatars (client_id, display_id);

-- 5. Trigger function — assigns the next display_id atomically per client.
-- Honors an explicit display_id if the caller provides one (e.g. data migrations).
CREATE OR REPLACE FUNCTION assign_display_id()
RETURNS TRIGGER AS $$
DECLARE
  v_assigned    INTEGER;
  v_entity_type TEXT;
  v_lock_key    BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'offers' THEN
    v_entity_type := 'offer';
  ELSIF TG_TABLE_NAME = 'avatars' THEN
    v_entity_type := 'audience';
  ELSE
    RAISE EXCEPTION 'assign_display_id: unsupported table %', TG_TABLE_NAME;
  END IF;

  -- Caller already chose a number — leave it alone.
  IF NEW.display_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Per-(client, entity_type) advisory lock so concurrent inserts serialize.
  v_lock_key := ('x' || substr(md5(NEW.client_id::text || ':' || v_entity_type), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Read+increment in one statement.
  --
  -- First insert for (client, entity_type): no row exists, so we INSERT with
  -- next_id = 2 (meaning "we just used 1, the next one is 2") and RETURN
  -- next_id - 1 = 1 — that's the value we assigned to NEW.display_id.
  --
  -- Subsequent inserts: row exists, ON CONFLICT bumps next_id by 1; the
  -- returning expression `next_id - 1` is what we just assigned.
  INSERT INTO client_sequences (client_id, entity_type, next_id)
    VALUES (NEW.client_id, v_entity_type, 2)
    ON CONFLICT (client_id, entity_type) DO UPDATE
    SET next_id = client_sequences.next_id + 1
    RETURNING next_id - 1 INTO v_assigned;

  NEW.display_id := v_assigned;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_offers_assign_display_id
  BEFORE INSERT ON offers
  FOR EACH ROW
  EXECUTE FUNCTION assign_display_id();

CREATE TRIGGER trg_avatars_assign_display_id
  BEFORE INSERT ON avatars
  FOR EACH ROW
  EXECUTE FUNCTION assign_display_id();

-- 6. Rewrite the ads name-generation trigger to use display_id and the new
-- AU{n}_OF{n}_... format.
DROP TRIGGER IF EXISTS trg_ads_validate_and_fill ON ads;
DROP FUNCTION IF EXISTS ads_validate_and_fill();

CREATE OR REPLACE FUNCTION ads_validate_and_fill()
RETURNS TRIGGER AS $$
DECLARE
  v_offer_display_id   INTEGER;
  v_aud_display_id     INTEGER;
  v_bh_type            TEXT;
  v_bh_avatar_ids      JSONB;
  v_bh_client_id       UUID;
  v_bh_created_at      TIMESTAMPTZ;
  v_bh_seq             INTEGER;
  v_body_raw_type      TEXT;
  v_body_code          TEXT;
  v_body_seq           INTEGER;
  v_body_client_id     UUID;
  v_body_created_at    TIMESTAMPTZ;
  v_cta_raw_type       TEXT;
  v_cta_seq            INTEGER;
  v_cta_client_id      UUID;
  v_cta_created_at     TIMESTAMPTZ;
BEGIN
  SELECT display_id INTO v_offer_display_id FROM offers  WHERE id = NEW.offer_id;
  SELECT display_id INTO v_aud_display_id   FROM avatars WHERE id = NEW.audience_id;
  IF v_offer_display_id IS NULL THEN
    RAISE EXCEPTION 'Offer % is missing a display_id (data integrity)', NEW.offer_id;
  END IF;
  IF v_aud_display_id IS NULL THEN
    RAISE EXCEPTION 'Audience % is missing a display_id (data integrity)', NEW.audience_id;
  END IF;

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
  ELSIF v_body_raw_type = 'proof' THEN
    v_body_code := 'PC';
  ELSE
    RAISE EXCEPTION 'Body slot must be subheadline / hero_subheadline / proof; got %', v_body_raw_type;
  END IF;

  IF v_cta_raw_type NOT IN ('cta', 'hero_cta') THEN
    RAISE EXCEPTION 'CTA slot must be cta / hero_cta; got %', v_cta_raw_type;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.bh_component_version   := NULL;
    NEW.body_component_version := NULL;
    NEW.cta_component_version  := NULL;
  END IF;

  -- Per-client per-type seqs (same approach as before)
  SELECT COUNT(*) + 1 INTO v_bh_seq
    FROM copy_components
   WHERE client_id = NEW.client_id
     AND type = 'banner_headline'
     AND (created_at, id) < (v_bh_created_at, NEW.bh_component_id);

  SELECT COUNT(*) + 1 INTO v_body_seq
    FROM copy_components
   WHERE client_id = NEW.client_id
     AND (
       (v_body_code = 'SH' AND type IN ('subheadline','hero_subheadline'))
       OR (v_body_code = 'PC' AND type = 'proof')
     )
     AND (created_at, id) < (v_body_created_at, NEW.body_component_id);

  SELECT COUNT(*) + 1 INTO v_cta_seq
    FROM copy_components
   WHERE client_id = NEW.client_id
     AND type IN ('cta', 'hero_cta')
     AND (created_at, id) < (v_cta_created_at, NEW.cta_component_id);

  NEW.name := format(
    'AU%s_OF%s_BH%s-%s%s-CTA%s',
    v_aud_display_id,
    v_offer_display_id,
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

-- 7. Regenerate names on existing ads. The trigger always re-derives `name`
-- from the referenced offer / audience / components, so any UPDATE fires it.
UPDATE ads SET status = status;

COMMENT ON COLUMN offers.display_id  IS 'Per-client never-reused integer used in ad names (OF{display_id}). Auto-assigned by trigger.';
COMMENT ON COLUMN avatars.display_id IS 'Per-client never-reused integer used in ad names (AU{display_id}). Auto-assigned by trigger.';
