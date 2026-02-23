ALTER TABLE men.event_registrations
  ALTER COLUMN teammate_email
    TYPE jsonb USING (
      CASE
        WHEN teammate_email IS NULL OR trim(teammate_email) = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(trim(teammate_email))
      END
    );
ALTER TABLE men.event_registrations
  ALTER COLUMN teammate_email SET DEFAULT '[]'::jsonb;

ALTER TABLE women.event_registrations
  ALTER COLUMN teammate_email
    TYPE jsonb USING (
      CASE
        WHEN teammate_email IS NULL OR trim(teammate_email) = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(trim(teammate_email))
      END
    );
ALTER TABLE women.event_registrations
  ALTER COLUMN teammate_email SET DEFAULT '[]'::jsonb;
