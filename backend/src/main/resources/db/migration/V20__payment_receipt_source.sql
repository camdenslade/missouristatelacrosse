ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS source VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_source ON payment_receipts (source);
