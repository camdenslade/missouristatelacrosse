-- A short note per order form item shown to players, e.g. "First-year players get this free".
ALTER TABLE men.order_form_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE women.order_form_items ADD COLUMN IF NOT EXISTS description TEXT;
