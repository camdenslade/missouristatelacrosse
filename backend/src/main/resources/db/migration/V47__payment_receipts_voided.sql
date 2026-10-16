-- Lets the treasurer void a specific payment_receipts row out of the Budget ledger (e.g. a
-- duplicate Tap to Pay charge from testing, or anything later refunded in Stripe/PayPal -
-- there's no refund webhook wired up yet, so this is the only way to correct the ledger for
-- one today). Voiding never deletes the row or touches real money; it just excludes it from
-- the ledger query.
ALTER TABLE men.payment_receipts ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE women.payment_receipts ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false;
