-- Text message subscribers. People only get here by entering their own number and checking
-- the consent box on /text-updates, which is what the 10DLC campaign registration describes.
-- The consent wording, page, IP, and time are kept as the record of each opt-in.
CREATE TABLE IF NOT EXISTS men.sms_subscribers (
    phone          TEXT PRIMARY KEY,
    name           TEXT,
    consent_text   TEXT NOT NULL,
    source         TEXT,
    ip             TEXT,
    user_agent     TEXT,
    opted_in_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    opted_out_at   TIMESTAMPTZ,
    confirmed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS women.sms_subscribers (
    phone          TEXT PRIMARY KEY,
    name           TEXT,
    consent_text   TEXT NOT NULL,
    source         TEXT,
    ip             TEXT,
    user_agent     TEXT,
    opted_in_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    opted_out_at   TIMESTAMPTZ,
    confirmed_at   TIMESTAMPTZ
);
