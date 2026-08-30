-- Sanitized template for backend/scripts/seed_users.sql (which is git-ignored because
-- the real file contains team-member PII: names, emails, Firebase UIDs).
--
-- Copy this to seed_users.sql, replace the placeholder rows with real accounts, and run
-- it against the database AFTER Flyway has created the men/women schemas:
--
--   psql "$DB_URL" -f backend/scripts/seed_users.sql
--
-- Each firebase_uid must match an existing Firebase Authentication user. `roles` maps a
-- program to one of: admin | player | parent | alumni | coach. `programs` lists which
-- programs the account belongs to. `player_id` links to a men.players / women.players
-- row (NULL if not a rostered player).

BEGIN;

-- Men users
INSERT INTO men.users AS u (
    firebase_uid,
    email,
    display_name,
    roles,
    programs,
    player_id
)
VALUES
    (
        'REPLACE_WITH_FIREBASE_UID_1',
        'admin@example.com',
        'Example Admin',
        '{"men":"admin"}'::jsonb,
        '["men"]'::jsonb,
        NULL
    ),
    (
        'REPLACE_WITH_FIREBASE_UID_2',
        'player@example.com',
        'Example Player',
        '{"men":"player"}'::jsonb,
        '["men"]'::jsonb,
        NULL
    )
ON CONFLICT (firebase_uid) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    roles = EXCLUDED.roles,
    programs = EXCLUDED.programs,
    player_id = COALESCE(u.player_id, EXCLUDED.player_id);

-- Women users
INSERT INTO women.users AS u (
    firebase_uid,
    email,
    display_name,
    roles,
    programs,
    player_id
)
VALUES
    (
        'REPLACE_WITH_FIREBASE_UID_3',
        'womens-admin@example.com',
        'Example Womens Admin',
        '{"women":"admin"}'::jsonb,
        '["women"]'::jsonb,
        NULL
    )
ON CONFLICT (firebase_uid) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    roles = EXCLUDED.roles,
    programs = EXCLUDED.programs,
    player_id = COALESCE(u.player_id, EXCLUDED.player_id);

COMMIT;
