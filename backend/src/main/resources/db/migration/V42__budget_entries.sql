-- Manual income/expense entries for the treasurer's budget ledger. Real payments (dues,
-- raffles, events, fundraisers, store) are pulled live from dues_payments and
-- payment_receipts, not duplicated here - this table is only for money that moves outside
-- those systems (e.g. a cash expense, a reimbursement, a bank fee).
CREATE TABLE men.budget_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type  TEXT NOT NULL, -- 'income' or 'expense'
    amount      NUMERIC(10,2) NOT NULL,
    description TEXT NOT NULL,
    entry_date  DATE NOT NULL,
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE women.budget_entries (
    LIKE men.budget_entries INCLUDING ALL
);
