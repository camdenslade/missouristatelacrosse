-- V10: Add image column to events; create raffles and raffle_entries tables

-- Add image to existing events tables
ALTER TABLE men.events   ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE women.events ADD COLUMN IF NOT EXISTS image text;

-- Raffles
CREATE TABLE IF NOT EXISTS men.raffles (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text         NOT NULL,
  slug                   text         NOT NULL UNIQUE,
  description            text,
  image                  text,
  ticket_price           numeric(10,2),
  max_tickets_per_person integer,
  allow_bids             boolean      NOT NULL DEFAULT false,
  published              boolean      NOT NULL DEFAULT false,
  status                 text         NOT NULL DEFAULT 'active',
  end_time               timestamptz,
  winner_name            text,
  winner_email           text,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.raffles (
  LIKE men.raffles INCLUDING ALL
);

-- Raffle entries
CREATE TABLE IF NOT EXISTS men.raffle_entries (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id        uuid         NOT NULL REFERENCES men.raffles(id) ON DELETE CASCADE,
  payer_name       text,
  payer_email      text,
  paypal_order_id  text,
  amount_paid      numeric(10,2),
  ticket_count     integer      NOT NULL DEFAULT 1,
  bid_amount       numeric(10,2),
  paid             boolean      NOT NULL DEFAULT false,
  paid_at          timestamptz,
  created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.raffle_entries (
  LIKE men.raffle_entries INCLUDING ALL
);
