-- Part A: idempotency + verification for dues payments
ALTER TABLE men.dues_payments ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE women.dues_payments ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS men_dues_payments_paypal_order_id_uq
  ON men.dues_payments (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS women_dues_payments_paypal_order_id_uq
  ON women.dues_payments (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

-- Part B: season-independent parent links, stored on player_profiles instead of
-- (or in addition to, for backward compatibility) each season's players row.
ALTER TABLE men.player_profiles ADD COLUMN IF NOT EXISTS parents jsonb NOT NULL DEFAULT '[]';
ALTER TABLE women.player_profiles ADD COLUMN IF NOT EXISTS parents jsonb NOT NULL DEFAULT '[]';

-- Backfill: pull every distinct parent (deduped by lowercased email) currently
-- attached to any season row of a given profile, and aggregate them onto the profile.
WITH parent_elems AS (
  SELECT p.profile_id, elem
  FROM men.players p, jsonb_array_elements(COALESCE(p.parents, '[]'::jsonb)) elem
  WHERE p.profile_id IS NOT NULL
    AND elem ? 'email'
    AND COALESCE(elem->>'email', '') <> ''
),
dedup AS (
  SELECT DISTINCT ON (profile_id, lower(elem->>'email')) profile_id, elem
  FROM parent_elems
  ORDER BY profile_id, lower(elem->>'email')
),
agg AS (
  SELECT profile_id, jsonb_agg(elem) AS parents
  FROM dedup
  GROUP BY profile_id
)
UPDATE men.player_profiles prof
SET parents = agg.parents
FROM agg
WHERE prof.id = agg.profile_id;

WITH parent_elems AS (
  SELECT p.profile_id, elem
  FROM women.players p, jsonb_array_elements(COALESCE(p.parents, '[]'::jsonb)) elem
  WHERE p.profile_id IS NOT NULL
    AND elem ? 'email'
    AND COALESCE(elem->>'email', '') <> ''
),
dedup AS (
  SELECT DISTINCT ON (profile_id, lower(elem->>'email')) profile_id, elem
  FROM parent_elems
  ORDER BY profile_id, lower(elem->>'email')
),
agg AS (
  SELECT profile_id, jsonb_agg(elem) AS parents
  FROM dedup
  GROUP BY profile_id
)
UPDATE women.player_profiles prof
SET parents = agg.parents
FROM agg
WHERE prof.id = agg.profile_id;
