-- Event Signup: events, event_registrations, event_teams
-- fields column stores an array of field definitions as JSONB:
--   [{ "id": "uuid", "label": "...", "type": "text|number|select|checkbox", "required": bool, "options": ["..."] }]

CREATE TABLE IF NOT EXISTS men.events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        NOT NULL UNIQUE,
  address     text,
  maps_link   text,
  start_time  timestamptz,
  end_time    timestamptz,
  description text,
  fields      jsonb       NOT NULL DEFAULT '[]',
  price       numeric(10,2),
  team_size   integer     NOT NULL DEFAULT 1,
  published   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.events (
  LIKE men.events INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.event_teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES men.events(id) ON DELETE CASCADE,
  complete    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.event_teams (
  LIKE men.event_teams INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.event_registrations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid        NOT NULL REFERENCES men.events(id) ON DELETE CASCADE,
  payer_name       text,
  payer_email      text,
  paypal_order_id  text,
  amount_paid      numeric(10,2),
  paid             boolean     NOT NULL DEFAULT false,
  paid_at          timestamptz,
  form_data        jsonb       NOT NULL DEFAULT '{}',
  team_id          uuid,
  teammate_email   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.event_registrations (
  LIKE men.event_registrations INCLUDING ALL
);
