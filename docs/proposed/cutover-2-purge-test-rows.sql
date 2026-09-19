-- PROPOSED, not applied. One-time cutover script, run by hand on the new database (not a Flyway migration).
-- Run after restoring the final dump. Source: docs/schema-audit-2026-09-18.md
-- test by the Firebase reconciliation (docs/schema-audit-2026-09-18.md).

-- Orphan profiles with no players attached: two Camden Slade test profiles and the Cole Bourg
-- duplicate whose Firebase account no longer exists (the live Cole profile is kept).
DELETE FROM men.player_profiles p
 WHERE p.id IN ('2972ab61-804c-485a-94c1-d765d6acdac8',
                '5c2941e5-036e-4b4d-937a-e709cddc4763',
                '5428d6ab-4e30-4ba5-adb3-fb093279c718')
   AND NOT EXISTS (SELECT 1 FROM men.players x WHERE x.profile_id = p.id);

-- Deleted test parent account, and the $1 test dues payments on the owner's own 26-27 player.
DELETE FROM men.parents WHERE id = 'TRzoF25JlOWTnfxdYYIVCrW7R1i1';
DELETE FROM men.dues_payments
 WHERE amount <= 1 AND player_id = 'f7d1ecf8-bb6e-4b2d-8048-2e2509ddb8c8';

-- Unused invite tokens for the three UIDs confirmed missing from Firebase
-- (Jackson Hocker and Jed Holliday's old accounts, and the Cole Bourg test account).
DELETE FROM men.invite_tokens
 WHERE used_at IS NULL
   AND (firebase_uid LIKE '48219ojC%' OR firebase_uid LIKE 'LQgxGLjY%' OR firebase_uid LIKE 'F7SL1k4U%');

-- Streaming test data from the February build. Keep any stream key that has a payment attached.
DELETE FROM men.chat_messages;
DELETE FROM men.stream_keys WHERE paypal_order_id IS NULL AND created_at < '2026-03-01';
