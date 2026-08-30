-- Backs the "set your password" link used by every onboarding email (player, parent, alumni)
-- and admin-triggered resends. Firebase's own generatePasswordResetLink hard-expires its
-- oobCode after 1 hour (not configurable via the Admin SDK or console), which was silently
-- breaking any onboarding email opened later than that. This table lets us issue our own
-- token instead, with no time-based expiration — the Admin SDK's updateUser(...)
-- .setPassword(...) then applies the chosen password directly once the token is verified.
-- The real "forgot password" flow (existing user requesting a reset) intentionally still
-- uses Firebase's own short-lived link — that's a different trust model.

CREATE TABLE IF NOT EXISTS men.invite_tokens (
    token UUID PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS women.invite_tokens (
    token UUID PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at TIMESTAMPTZ
);
