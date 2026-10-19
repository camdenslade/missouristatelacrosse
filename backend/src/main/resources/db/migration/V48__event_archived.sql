-- Archiving replaces deleting for finished events. An archived event drops off the public
-- site and the Tap to Pay app, but its row, registrations, and POS items stay, so the budget
-- ledger can still group and name its payments.
ALTER TABLE men.events ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE women.events ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
