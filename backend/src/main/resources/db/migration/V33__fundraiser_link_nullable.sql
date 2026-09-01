-- The `link` column predates the multi-campaign system and was required back when a
-- fundraiser was just a title + external link. It's now an optional override (a campaign
-- without one links to its own /fundraiser/{slug} page instead), but the original NOT NULL
-- constraint was never dropped, so every create/update that leaves it blank 500s.
ALTER TABLE fundraisers ALTER COLUMN link DROP NOT NULL;
