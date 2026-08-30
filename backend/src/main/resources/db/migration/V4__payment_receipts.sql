CREATE TABLE IF NOT EXISTS men.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE NOT NULL,
  status text,
  payer_email text,
  payer_name text,
  amount numeric(10,2),
  currency text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  receipt_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.payment_receipts (
  LIKE men.payment_receipts INCLUDING ALL
);
