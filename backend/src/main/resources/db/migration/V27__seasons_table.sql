-- New table for admin-managed seasons (arbitrary, unlimited, with one "active" season
-- per program). Must be created explicitly in BOTH schemas — unqualified DDL only ever
-- applies to the default schema ("men", per spring.flyway.schemas=men,women), which is
-- exactly the bug V26 had to fix retroactively for other tables. Not making that mistake
-- again here.

CREATE TABLE IF NOT EXISTS men.seasons (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(20) NOT NULL,
    label        VARCHAR(100),
    active       BOOLEAN NOT NULL DEFAULT false,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_men_seasons_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS women.seasons (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(20) NOT NULL,
    label        VARCHAR(100),
    active       BOOLEAN NOT NULL DEFAULT false,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_women_seasons_code UNIQUE (code)
);

-- Seed the currently-computed season (same Aug-cutoff rule as Utils/SeasonUtil.java) as
-- active in both schemas, so there's always exactly one active season before an admin
-- ever visits the new Manage Seasons panel. Historical seasons already present in
-- players/games/coaches don't need seeding here — the frontend dropdowns already union
-- the admin-managed list with whatever season strings exist in real data.
DO $$
DECLARE
    start_year INT;
    season_code TEXT;
    season_label TEXT;
BEGIN
    start_year := CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 8
                       THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
                       ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int - 1 END;
    season_code := lpad((start_year % 100)::text, 2, '0') || '-' || lpad(((start_year + 1) % 100)::text, 2, '0');
    season_label := start_year::text || '-' || (start_year + 1)::text;

    INSERT INTO men.seasons (code, label, active, sort_order)
    VALUES (season_code, season_label, true, 0)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO women.seasons (code, label, active, sort_order)
    VALUES (season_code, season_label, true, 0)
    ON CONFLICT (code) DO NOTHING;
END $$;
