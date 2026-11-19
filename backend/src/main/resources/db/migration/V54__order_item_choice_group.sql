-- Items on a form that share a choice group are pick-one: a player may order only one of them.
ALTER TABLE men.order_form_items ADD COLUMN IF NOT EXISTS choice_group TEXT;
ALTER TABLE women.order_form_items ADD COLUMN IF NOT EXISTS choice_group TEXT;
