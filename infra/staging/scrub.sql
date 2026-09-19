-- Removes personal details from a copy of the production database so it is safe to keep in staging.
-- Run only against the staging database, right after it is restored from production
-- (infra/staging/refresh-db.sh does this). Never run it against production.
--
-- What it does:
--   * Replaces every email with a stable fake one derived from the original, so the same person
--     still matches across tables (a player's email and their user email stay equal).
--   * Wipes payment details, order addresses, phone numbers and free-text notes.
--   * Empties tables that hold secrets or credentials (invite links, stream keys) or contact
--     requests from the public.
-- Names on the roster are public on the website and are kept.

DO $$
DECLARE
  s text;
  pair text[];
  email_columns text[][] := ARRAY[
    ['account_requests', 'email'],
    ['event_registrations', 'payer_email'],
    ['invite_tokens', 'email'],
    ['parents', 'email'],
    ['payment_receipts', 'payer_email'],
    ['player_profiles', 'email'],
    ['players', 'email'],
    ['raffle_entries', 'payer_email'],
    ['raffles', 'winner_email'],
    ['recruitment_submissions', 'email'],
    ['stream_keys', 'email'],
    ['users', 'email']
  ];
  json_email_columns text[][] := ARRAY[
    ['players', 'parents'],
    ['player_profiles', 'parents'],
    ['event_registrations', 'teammate_email'],
    ['groups', 'members']
  ];
  email_pattern constant text := '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}';
BEGIN
  FOREACH s IN ARRAY ARRAY['men', 'women'] LOOP
    FOREACH pair SLICE 1 IN ARRAY email_columns LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = s AND table_name = pair[1] AND column_name = pair[2]) THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = ''user_'' || substr(md5(lower(%I)), 1, 10) || ''@staging.invalid'' WHERE %I IS NOT NULL AND %I <> ''''',
          s, pair[1], pair[2], pair[2], pair[2], pair[2]);
      END IF;
    END LOOP;

    FOREACH pair SLICE 1 IN ARRAY json_email_columns LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = s AND table_name = pair[1] AND column_name = pair[2]) THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = regexp_replace(%I::text, %L, ''scrubbed@staging.invalid'', ''g'')::jsonb WHERE %I IS NOT NULL',
          s, pair[1], pair[2], pair[2], email_pattern, pair[2]);
      END IF;
    END LOOP;

    -- Payment and order details.
    IF to_regclass(s || '.payment_receipts') IS NOT NULL THEN
      EXECUTE format('UPDATE %I.payment_receipts SET payer_name = ''Test Payer'', payload = ''{}''::jsonb', s);
    END IF;
    IF to_regclass(s || '.printify_order_logs') IS NOT NULL THEN
      EXECUTE format('UPDATE %I.printify_order_logs SET request_payload = ''{}'', response_payload = ''{}''', s);
    END IF;
    IF to_regclass(s || '.event_registrations') IS NOT NULL THEN
      EXECUTE format('UPDATE %I.event_registrations SET payer_name = ''Test Payer''', s);
    END IF;
    IF to_regclass(s || '.raffle_entries') IS NOT NULL THEN
      EXECUTE format('UPDATE %I.raffle_entries SET payer_name = ''Test Payer'', payer_phone = ''555-0100''', s);
    END IF;
    IF to_regclass(s || '.recruitment_submissions') IS NOT NULL THEN
      EXECUTE format('UPDATE %I.recruitment_submissions SET phone = ''555-0100''', s);
    END IF;
    IF to_regclass(s || '.dues_payments') IS NOT NULL THEN
      EXECUTE format('UPDATE %I.dues_payments SET note = NULL', s);
    END IF;

    -- Credentials and inbound contact: not needed to test anything, so removed outright.
    IF to_regclass(s || '.invite_tokens') IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I.invite_tokens', s);
    END IF;
    IF to_regclass(s || '.stream_keys') IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I.stream_keys', s);
    END IF;
    IF to_regclass(s || '.account_requests') IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I.account_requests', s);
    END IF;
  END LOOP;
END $$;
