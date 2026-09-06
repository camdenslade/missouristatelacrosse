-- V32 (fundraiser_campaigns) and V33 (fundraiser_link_nullable) used unqualified
-- DDL (`ALTER TABLE fundraisers ...`). Flyway's default schema is "men"
-- (spring.flyway.schemas=men,women, first entry wins), so both migrations only
-- touched men.fundraisers. The Fundraiser entity runs against BOTH schemas via
-- the per-request multi-tenant connection, so every fundraiser request under the
-- "women" tenant (admin list included) currently throws a live SQL error because
-- women.fundraisers is still the V1 shape (id, title, link, active, timestamps).
-- Same class of bug as V26. Additive only, mirrors the men schema.

ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS slug VARCHAR(64);
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS goal_amount NUMERIC(10, 2);
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS program VARCHAR(16) NOT NULL DEFAULT 'women';
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS expenses JSONB NOT NULL DEFAULT '[]';
ALTER TABLE women.fundraisers ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill slugs for any pre-existing rows so the NOT NULL / UNIQUE constraints can apply.
UPDATE women.fundraisers SET slug = substring(replace(id::text, '-', '') FROM 1 FOR 12) WHERE slug IS NULL;

ALTER TABLE women.fundraisers ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fundraisers_slug_key'
          AND connamespace = 'women'::regnamespace
    ) THEN
        ALTER TABLE women.fundraisers ADD CONSTRAINT fundraisers_slug_key UNIQUE (slug);
    END IF;
END $$;

-- V33 parity: link was NOT NULL back when a fundraiser was just a title + external
-- link; it is now an optional override.
ALTER TABLE women.fundraisers ALTER COLUMN link DROP NOT NULL;
