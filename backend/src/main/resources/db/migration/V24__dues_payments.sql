CREATE TABLE men.dues_payments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID        NOT NULL,
    amount      NUMERIC(10,2) NOT NULL,
    type        TEXT        NOT NULL DEFAULT 'PAYMENT',
    note        TEXT,
    paid_by_uid TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE women.dues_payments (
    LIKE men.dues_payments INCLUDING ALL
);

CREATE INDEX ON men.dues_payments  (player_id);
CREATE INDEX ON women.dues_payments (player_id);
