ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS provider VARCHAR(16) NOT NULL DEFAULT 'paypal';
CREATE INDEX IF NOT EXISTS idx_payment_receipts_provider ON payment_receipts (provider);
