-- Cognito sign-in support. cognito_sub is the Cognito user's stable id, recorded the first
-- time an existing account signs in through Cognito. It sits next to firebase_uid, which stays
-- the id every other table already references until Firebase is retired.
-- Also makes email a unique login key (case-insensitive), which Cognito requires.

DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['men','women'] LOOP
    EXECUTE format('ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS cognito_sub VARCHAR(64)', s);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS users_cognito_sub_key ON %I.users (cognito_sub) WHERE cognito_sub IS NOT NULL', s);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON %I.users (lower(email)) WHERE email IS NOT NULL AND email <> ''''', s);
  END LOOP;
END $$;
