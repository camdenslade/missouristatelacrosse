-- Several earlier migrations (V18, V19, V20, V23) used unqualified DDL
-- (e.g. `ALTER TABLE raffles ...` instead of `ALTER TABLE men.raffles ...`).
-- Flyway's default schema is "men" (spring.flyway.schemas=men,women, first entry
-- wins as the default), so every one of those statements silently only applied to
-- the men schema. The corresponding JPA entities (PaymentReceipt, Raffle,
-- AlumniBudget) are used against BOTH schemas via the runtime multi-tenant
-- connection (schema switched per request), so any request under the "women"
-- tenant touching these columns/table throws a live SQL error today. This
-- migration brings the women schema back to parity — additive only, matches the
-- men schema exactly, no data loss risk.

-- V20 parity: payment_receipts.source
ALTER TABLE women.payment_receipts ADD COLUMN IF NOT EXISTS source VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_women_payment_receipts_source ON women.payment_receipts (source);

-- V18/V19 parity: raffles.stream_data / raffles.images
ALTER TABLE women.raffles ADD COLUMN IF NOT EXISTS stream_data jsonb;
ALTER TABLE women.raffles ADD COLUMN IF NOT EXISTS images jsonb;

-- V23 parity: alumni_budget table didn't exist in women schema at all
CREATE TABLE IF NOT EXISTS women.alumni_budget (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program      VARCHAR(20),
    year         VARCHAR(10),
    category     VARCHAR(255),
    description  TEXT,
    amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    entry_type   VARCHAR(20)    NOT NULL DEFAULT 'EXPENSE',
    display_order INTEGER        NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);
