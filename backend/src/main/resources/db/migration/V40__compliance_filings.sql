-- VP mini-page: Missouri nonprofit annual filings, yearly IRS filings, and grant renewals
-- that need to be tracked and renewed each year.
CREATE TABLE men.compliance_filings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        TEXT NOT NULL, -- 'MO_ANNUAL', 'IRS', 'GRANT'
    name        TEXT NOT NULL,
    due_date    DATE,
    last_filed  DATE,
    status      TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'filed', 'overdue'
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE women.compliance_filings (
    LIKE men.compliance_filings INCLUDING ALL
);
