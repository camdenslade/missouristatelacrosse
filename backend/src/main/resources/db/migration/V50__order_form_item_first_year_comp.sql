-- First Year Comp: an item a player gets free (one unit) in their first season on the roster.
ALTER TABLE men.order_form_items ADD COLUMN IF NOT EXISTS first_year_comp BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE women.order_form_items ADD COLUMN IF NOT EXISTS first_year_comp BOOLEAN NOT NULL DEFAULT false;
