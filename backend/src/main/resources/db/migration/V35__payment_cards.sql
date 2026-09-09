CREATE TABLE men.payment_cards (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    season      TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    description TEXT,
    link        TEXT,
    amount      NUMERIC(10,2),
    active      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE women.payment_cards (
    LIKE men.payment_cards INCLUDING ALL
);

CREATE INDEX ON men.payment_cards   (season);
CREATE INDEX ON women.payment_cards (season);

CREATE TABLE men.payment_card_status (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id       UUID        NOT NULL,
    player_id     UUID        NOT NULL,
    done          BOOLEAN     NOT NULL DEFAULT false,
    done_at       TIMESTAMPTZ,
    marked_by_uid TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (card_id, player_id)
);

CREATE TABLE women.payment_card_status (
    LIKE men.payment_card_status INCLUDING ALL
);

CREATE INDEX ON men.payment_card_status   (card_id);
CREATE INDEX ON women.payment_card_status (card_id);
CREATE INDEX ON men.payment_card_status   (player_id);
CREATE INDEX ON women.payment_card_status (player_id);
