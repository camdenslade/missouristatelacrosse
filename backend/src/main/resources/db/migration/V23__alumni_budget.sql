CREATE TABLE alumni_budget (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program      VARCHAR(20),
    year         VARCHAR(10),
    category     VARCHAR(255),
    description  TEXT,
    amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    entry_type   VARCHAR(20)    NOT NULL DEFAULT 'EXPENSE',
    display_order INTEGER        NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);
