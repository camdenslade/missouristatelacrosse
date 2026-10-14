-- Per-event opt-in for the Tap to Pay app's cash option. Off by default - an admin has to
-- deliberately turn it on per event, so "Paid in Cash" doesn't show up anywhere unless
-- someone running that event actually wants it.
ALTER TABLE men.events ADD COLUMN IF NOT EXISTS accepts_cash BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE women.events ADD COLUMN IF NOT EXISTS accepts_cash BOOLEAN NOT NULL DEFAULT false;
