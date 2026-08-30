CREATE TABLE IF NOT EXISTS men.player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text,
  name text,
  email text,
  merge_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'men_player_profiles_merge_key_uq'
      AND conrelid = 'men.player_profiles'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i'
        AND c.relname = 'men_player_profiles_merge_key_uq'
        AND n.nspname = 'men'
    ) THEN
      EXECUTE 'DROP INDEX men.men_player_profiles_merge_key_uq';
    END IF;
    EXECUTE 'ALTER TABLE men.player_profiles ADD CONSTRAINT men_player_profiles_merge_key_uq UNIQUE (merge_key)';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS men_player_profiles_firebase_uid_uq
  ON men.player_profiles (firebase_uid)
  WHERE firebase_uid IS NOT NULL AND firebase_uid <> '';

ALTER TABLE men.players ADD COLUMN IF NOT EXISTS profile_id uuid;
CREATE INDEX IF NOT EXISTS men_players_profile_id_idx ON men.players (profile_id);

UPDATE men.players
SET user_uid = COALESCE(NULLIF(user_uid, ''), NULLIF(data->>'userID', ''), NULLIF(data->>'userId', ''))
WHERE (user_uid IS NULL OR user_uid = '');

WITH player_keys AS (
  SELECT id,
    CASE
      WHEN user_uid IS NOT NULL AND user_uid <> '' THEN 'uid:' || user_uid
      WHEN email IS NOT NULL AND email <> '' THEN 'email:' || lower(email)
      WHEN data ? 'highSchool' AND COALESCE(data->>'highSchool', '') <> ''
        THEN 'namehs:' || lower(name) || '|' || lower(data->>'highSchool')
      ELSE NULL
    END AS merge_key,
    user_uid,
    name,
    email
  FROM men.players
),
distinct_keys AS (
  SELECT merge_key,
         MAX(NULLIF(user_uid, '')) AS user_uid,
         MAX(name) AS name,
         MAX(email) AS email
  FROM player_keys
  WHERE merge_key IS NOT NULL
  GROUP BY merge_key
)
INSERT INTO men.player_profiles (id, firebase_uid, name, email, merge_key)
SELECT gen_random_uuid(), user_uid, name, email, merge_key
FROM distinct_keys
ON CONFLICT ON CONSTRAINT men_player_profiles_merge_key_uq DO NOTHING;

UPDATE men.players p
SET profile_id = prof.id
FROM men.player_profiles prof
WHERE p.profile_id IS NULL
  AND (
    CASE
      WHEN p.user_uid IS NOT NULL AND p.user_uid <> '' THEN 'uid:' || p.user_uid
      WHEN p.email IS NOT NULL AND p.email <> '' THEN 'email:' || lower(p.email)
      WHEN p.data ? 'highSchool' AND COALESCE(p.data->>'highSchool', '') <> ''
        THEN 'namehs:' || lower(p.name) || '|' || lower(p.data->>'highSchool')
      ELSE NULL
    END
  ) = prof.merge_key;

UPDATE men.users u
SET player_id = prof.id
FROM men.player_profiles prof
WHERE u.player_id IS NULL
  AND prof.firebase_uid = u.firebase_uid;

CREATE TABLE IF NOT EXISTS women.player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text,
  name text,
  email text,
  merge_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'women_player_profiles_merge_key_uq'
      AND conrelid = 'women.player_profiles'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i'
        AND c.relname = 'women_player_profiles_merge_key_uq'
        AND n.nspname = 'women'
    ) THEN
      EXECUTE 'DROP INDEX women.women_player_profiles_merge_key_uq';
    END IF;
    EXECUTE 'ALTER TABLE women.player_profiles ADD CONSTRAINT women_player_profiles_merge_key_uq UNIQUE (merge_key)';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS women_player_profiles_firebase_uid_uq
  ON women.player_profiles (firebase_uid)
  WHERE firebase_uid IS NOT NULL AND firebase_uid <> '';

ALTER TABLE women.players ADD COLUMN IF NOT EXISTS profile_id uuid;
CREATE INDEX IF NOT EXISTS women_players_profile_id_idx ON women.players (profile_id);

UPDATE women.players
SET user_uid = COALESCE(NULLIF(user_uid, ''), NULLIF(data->>'userID', ''), NULLIF(data->>'userId', ''))
WHERE (user_uid IS NULL OR user_uid = '');

WITH player_keys AS (
  SELECT id,
    CASE
      WHEN user_uid IS NOT NULL AND user_uid <> '' THEN 'uid:' || user_uid
      WHEN email IS NOT NULL AND email <> '' THEN 'email:' || lower(email)
      WHEN data ? 'highSchool' AND COALESCE(data->>'highSchool', '') <> ''
        THEN 'namehs:' || lower(name) || '|' || lower(data->>'highSchool')
      ELSE NULL
    END AS merge_key,
    user_uid,
    name,
    email
  FROM women.players
),
distinct_keys AS (
  SELECT merge_key,
         MAX(NULLIF(user_uid, '')) AS user_uid,
         MAX(name) AS name,
         MAX(email) AS email
  FROM player_keys
  WHERE merge_key IS NOT NULL
  GROUP BY merge_key
)
INSERT INTO women.player_profiles (id, firebase_uid, name, email, merge_key)
SELECT gen_random_uuid(), user_uid, name, email, merge_key
FROM distinct_keys
ON CONFLICT ON CONSTRAINT women_player_profiles_merge_key_uq DO NOTHING;

UPDATE women.players p
SET profile_id = prof.id
FROM women.player_profiles prof
WHERE p.profile_id IS NULL
  AND (
    CASE
      WHEN p.user_uid IS NOT NULL AND p.user_uid <> '' THEN 'uid:' || p.user_uid
      WHEN p.email IS NOT NULL AND p.email <> '' THEN 'email:' || lower(p.email)
      WHEN p.data ? 'highSchool' AND COALESCE(p.data->>'highSchool', '') <> ''
        THEN 'namehs:' || lower(p.name) || '|' || lower(p.data->>'highSchool')
      ELSE NULL
    END
  ) = prof.merge_key;

UPDATE women.users u
SET player_id = prof.id
FROM women.player_profiles prof
WHERE u.player_id IS NULL
  AND prof.firebase_uid = u.firebase_uid;
