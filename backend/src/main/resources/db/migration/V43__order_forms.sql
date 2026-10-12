-- Admin-built order forms (e.g. gear orders): a form has items, each with an optional
-- price, optional image, and optional pickable options (like sizes). Players submit a
-- selection; the total posts as a CHARGE to their dues balance, same as any other charge.
CREATE TABLE men.order_forms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    description TEXT,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE men.order_form_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id     UUID NOT NULL REFERENCES men.order_forms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price       NUMERIC(10,2),
    image       TEXT,
    options     JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["S","M","L","XL"]
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE men.order_form_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id         UUID NOT NULL REFERENCES men.order_forms(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL,
    selections      JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{itemId,name,option,quantity,unitPrice,lineTotal}]
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    submitted_by_uid TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON men.order_form_items (form_id);
CREATE INDEX ON men.order_form_submissions (form_id);
CREATE INDEX ON men.order_form_submissions (player_id);

CREATE TABLE women.order_forms (LIKE men.order_forms INCLUDING ALL);
CREATE TABLE women.order_form_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id     UUID NOT NULL REFERENCES women.order_forms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price       NUMERIC(10,2),
    image       TEXT,
    options     JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order  INT NOT NULL DEFAULT 0
);
CREATE TABLE women.order_form_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id         UUID NOT NULL REFERENCES women.order_forms(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL,
    selections      JSONB NOT NULL DEFAULT '[]'::jsonb,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    submitted_by_uid TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON women.order_form_items (form_id);
CREATE INDEX ON women.order_form_submissions (form_id);
CREATE INDEX ON women.order_form_submissions (player_id);
