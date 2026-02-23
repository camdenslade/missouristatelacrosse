-- V11: Add payer_phone to raffle_entries

ALTER TABLE men.raffle_entries   ADD COLUMN IF NOT EXISTS payer_phone text;
ALTER TABLE women.raffle_entries ADD COLUMN IF NOT EXISTS payer_phone text;
