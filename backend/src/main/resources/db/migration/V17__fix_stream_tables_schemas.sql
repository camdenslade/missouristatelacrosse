-- Ensure stream tables exist in men schema (V16 may have created them without schema prefix)
CREATE TABLE IF NOT EXISTS men.stream_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id         TEXT        NOT NULL,
    key_code        TEXT UNIQUE NOT NULL,
    tier            TEXT        NOT NULL,
    display_name    TEXT        NOT NULL,
    email           TEXT        NOT NULL,
    paypal_order_id TEXT,
    activated_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS men.stream_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id          UUID        NOT NULL REFERENCES men.stream_keys(id) ON DELETE CASCADE,
    session_token   TEXT UNIQUE NOT NULL,
    last_heartbeat  TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS men.chat_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id       TEXT        NOT NULL,
    display_name  TEXT        NOT NULL,
    message       TEXT        NOT NULL,
    is_deleted    BOOLEAN     DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS men.stream_config (
    key        TEXT PRIMARY KEY,
    value      TEXT        NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create same tables in women schema
CREATE TABLE IF NOT EXISTS women.stream_keys (
    LIKE men.stream_keys INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS women.stream_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id          UUID        NOT NULL REFERENCES women.stream_keys(id) ON DELETE CASCADE,
    session_token   TEXT UNIQUE NOT NULL,
    last_heartbeat  TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.chat_messages (
    LIKE men.chat_messages INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS women.stream_config (
    LIKE men.stream_config INCLUDING ALL
);
