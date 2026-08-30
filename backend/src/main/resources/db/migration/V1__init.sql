CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS men;
CREATE SCHEMA IF NOT EXISTS women;

CREATE TABLE IF NOT EXISTS men.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text UNIQUE NOT NULL,
  email text,
  display_name text,
  roles jsonb NOT NULL DEFAULT '{}'::jsonb,
  programs jsonb NOT NULL DEFAULT '[]'::jsonb,
  player_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.users (
  LIKE men.users INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  uid text,
  program text NOT NULL DEFAULT 'men',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.account_requests (
  LIKE men.account_requests INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  season text,
  number text,
  position text,
  class_year text,
  photo_url text,
  balance numeric(10,2) NOT NULL DEFAULT 0,
  user_uid text,
  parents jsonb NOT NULL DEFAULT '[]'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.players (
  LIKE men.players INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.parents (
  id text PRIMARY KEY,
  email text,
  linked_players jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.parents (
  LIKE men.parents INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.groups (
  LIKE men.groups INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.articles (
  LIKE men.articles INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.fundraisers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  link text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.fundraisers (
  LIKE men.fundraisers INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_lower text,
  logo_url text,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.teams (
  LIKE men.teams INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent text,
  date timestamptz,
  time text,
  location text,
  away_logo text,
  away_link text,
  season text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.games (
  LIKE men.games INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.gallery_folders (
  id text PRIMARY KEY,
  urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.gallery_folders (
  LIKE men.gallery_folders INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.recruitment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  class_year text NOT NULL,
  position text NOT NULL,
  hometown text NOT NULL,
  high_school text NOT NULL,
  state text NOT NULL,
  instagram text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.recruitment_submissions (
  LIKE men.recruitment_submissions INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text,
  photo_url text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.coaches (
  LIKE men.coaches INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.site_content (
  content_key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.site_content (
  LIKE men.site_content INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.sponsor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_info text NOT NULL,
  request text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS women.sponsor_requests (
  LIKE men.sponsor_requests INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS men.printify_order_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  shop_id text,
  timestamp_ms bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000),
  request_payload text,
  response_payload text,
  http_status_code integer,
  success boolean NOT NULL DEFAULT false,
  error_message text
);

CREATE TABLE IF NOT EXISTS women.printify_order_logs (
  LIKE men.printify_order_logs INCLUDING ALL
);
