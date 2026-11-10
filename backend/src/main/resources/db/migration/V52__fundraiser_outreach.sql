-- Player-driven fundraiser outreach, run entirely on the site: each player gets a share
-- code, enters contacts, and the site emails the ask plus reminders. Donations made
-- through a player's link are credited to that player at checkout creation.
ALTER TABLE men.fundraisers ADD COLUMN IF NOT EXISTS outreach_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE men.fundraisers ADD COLUMN IF NOT EXISTS outreach_launch_at TIMESTAMPTZ;
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS outreach_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS outreach_launch_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS men.fundraiser_player_codes (
    player_id  UUID PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS men.fundraiser_contacts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fundraiser_id  UUID NOT NULL,
    player_id      UUID NOT NULL,
    name           TEXT,
    email          TEXT NOT NULL,
    token          TEXT NOT NULL UNIQUE,
    emails_sent    INT NOT NULL DEFAULT 0,
    last_sent_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fundraiser_contacts_unique_email
    ON men.fundraiser_contacts (fundraiser_id, lower(email));
CREATE INDEX IF NOT EXISTS fundraiser_contacts_player ON men.fundraiser_contacts (fundraiser_id, player_id);

CREATE TABLE IF NOT EXISTS men.fundraiser_referrals (
    order_id      TEXT PRIMARY KEY,
    fundraiser_id UUID NOT NULL,
    player_id     UUID NOT NULL,
    contact_id    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fundraiser_referrals_fundraiser ON men.fundraiser_referrals (fundraiser_id);

CREATE TABLE IF NOT EXISTS men.email_unsubscribes (
    email      TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.fundraiser_player_codes (LIKE men.fundraiser_player_codes INCLUDING ALL);
CREATE TABLE IF NOT EXISTS women.fundraiser_contacts (LIKE men.fundraiser_contacts INCLUDING ALL);
CREATE TABLE IF NOT EXISTS women.fundraiser_referrals (LIKE men.fundraiser_referrals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS women.email_unsubscribes (LIKE men.email_unsubscribes INCLUDING ALL);
