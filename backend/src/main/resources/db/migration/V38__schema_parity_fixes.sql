-- Migrated out of docs/proposed on 2026-09-19 after a clean rehearsal restore. Fixes men/women drift.
-- Fixes the men/women drift found in the 2026-09-18 schema audit (docs/schema-audit-2026-09-18.md).
-- Same root cause as V26 and V34: earlier migrations only reached the men schema.
-- Every statement names both schemas explicitly and is safe to run twice.

-- V30 (payment_receipt_provider) only reached men. The PaymentReceipt entity reads this
-- column, so any women's receipt read or write would fail with a missing-column error.
ALTER TABLE women.payment_receipts
    ADD COLUMN IF NOT EXISTS provider VARCHAR(16) NOT NULL DEFAULT 'paypal';

-- Same story for the Printify order id.
ALTER TABLE women.printify_order_logs
    ADD COLUMN IF NOT EXISTS printify_order_id VARCHAR(255);

-- V31 dropped the dead stream_config table from men only.
DROP TABLE IF EXISTS women.stream_config;

-- men has cascade foreign keys from event registrations, event teams, and raffle entries to
-- their parent rows. women never got them, so deleting a women's event or raffle would leave
-- orphaned children behind. All three women tables are empty today, so this cannot fail.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'event_registrations_event_id_fkey'
                     AND connamespace = 'women'::regnamespace) THEN
        ALTER TABLE women.event_registrations
            ADD CONSTRAINT event_registrations_event_id_fkey
            FOREIGN KEY (event_id) REFERENCES women.events(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'event_teams_event_id_fkey'
                     AND connamespace = 'women'::regnamespace) THEN
        ALTER TABLE women.event_teams
            ADD CONSTRAINT event_teams_event_id_fkey
            FOREIGN KEY (event_id) REFERENCES women.events(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'raffle_entries_raffle_id_fkey'
                     AND connamespace = 'women'::regnamespace) THEN
        ALTER TABLE women.raffle_entries
            ADD CONSTRAINT raffle_entries_raffle_id_fkey
            FOREIGN KEY (raffle_id) REFERENCES women.raffles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- These four foreign keys were added NOT VALID, so Postgres never checked the rows that
-- already existed. The audit found zero orphans for all four in both schemas, so it is safe
-- to validate them. Validating an already-valid constraint is a no-op.
ALTER TABLE men.dues_payments   VALIDATE CONSTRAINT fk_men_dues_payments_player;
ALTER TABLE women.dues_payments VALIDATE CONSTRAINT fk_women_dues_payments_player;
ALTER TABLE men.players         VALIDATE CONSTRAINT fk_men_players_profile;
ALTER TABLE women.players       VALIDATE CONSTRAINT fk_women_players_profile;
