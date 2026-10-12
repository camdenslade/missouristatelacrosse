-- A reference link (filing portal, document, etc) and a "recurs annually" flag - many
-- filings (e.g. a Missouri annual report due August 31 every year) aren't a one-time date,
-- so marking one "filed" can roll its due date forward a year instead of needing it
-- re-entered by hand each time.
ALTER TABLE men.compliance_filings ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE men.compliance_filings ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE women.compliance_filings ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE women.compliance_filings ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false;
