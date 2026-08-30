-- Adds the two highest-impact missing foreign keys flagged in the schema review:
-- dues_payments.player_id (the actual payment ledger, previously fully unconstrained) and
-- players.profile_id (the season-independent account link — its absence is the root cause
-- of the email/parent/self-access bugs fixed earlier this session).
--
-- Both added as NOT VALID: this enforces the constraint for all NEW writes immediately,
-- without requiring Postgres to validate every existing row against it during the migration.
-- That matters here specifically because there's no way to confirm from outside the database
-- whether any legacy row already violates what the constraint would require (e.g. a
-- dues_payment whose player was since deleted, or a profile_id left dangling from before the
-- linking fixes earlier this session) — if any did, a normal ADD CONSTRAINT would fail this
-- migration outright and could block startup. NOT VALID sidesteps that risk. Existing rows
-- can be validated later with VALIDATE CONSTRAINT once the data is confirmed clean (that
-- validation reads the table but does not lock it against writes, unlike the initial add).
--
-- ON DELETE behavior:
--   dues_payments -> players: RESTRICT (default) — a player with payment history must never
--     be silently deletable; that's financial history, deletion has to be a deliberate,
--     visible decision, not a side effect of removing a roster row.
--   players.profile_id -> player_profiles: SET NULL — profiles are effectively never deleted
--     by the app today, but if one ever is, losing the link (recoverable — the self-heal
--     logic already re-derives it) is the right behavior, not blocking the delete.

ALTER TABLE men.dues_payments
    ADD CONSTRAINT fk_men_dues_payments_player
    FOREIGN KEY (player_id) REFERENCES men.players (id) NOT VALID;

ALTER TABLE women.dues_payments
    ADD CONSTRAINT fk_women_dues_payments_player
    FOREIGN KEY (player_id) REFERENCES women.players (id) NOT VALID;

ALTER TABLE men.players
    ADD CONSTRAINT fk_men_players_profile
    FOREIGN KEY (profile_id) REFERENCES men.player_profiles (id) ON DELETE SET NULL NOT VALID;

ALTER TABLE women.players
    ADD CONSTRAINT fk_women_players_profile
    FOREIGN KEY (profile_id) REFERENCES women.player_profiles (id) ON DELETE SET NULL NOT VALID;
