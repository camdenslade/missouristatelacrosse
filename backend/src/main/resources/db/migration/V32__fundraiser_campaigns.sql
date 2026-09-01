-- Turns the single hardcoded fundraiser into a real multi-campaign system: each
-- fundraiser gets its own public page (slug, description, goal, image, expense
-- breakdown) instead of just a title + external link.
ALTER TABLE fundraisers
  ADD COLUMN slug VARCHAR(64),
  ADD COLUMN description TEXT,
  ADD COLUMN goal_amount NUMERIC(10, 2),
  ADD COLUMN image TEXT,
  ADD COLUMN program VARCHAR(16) NOT NULL DEFAULT 'men',
  ADD COLUMN expenses JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN published BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill slugs for any pre-existing rows so the NOT NULL/UNIQUE constraints below can apply.
UPDATE fundraisers SET slug = substring(replace(id::text, '-', '') from 1 for 12) WHERE slug IS NULL;

ALTER TABLE fundraisers ALTER COLUMN slug SET NOT NULL;
ALTER TABLE fundraisers ADD CONSTRAINT fundraisers_slug_key UNIQUE (slug);
