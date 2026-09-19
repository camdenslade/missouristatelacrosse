-- PROPOSED, not applied. One-time cutover script, run by hand on the new database (not a Flyway migration).
-- Run after restoring the final dump. Source: docs/schema-audit-2026-09-18.md
--
-- S3Service.extractKey only recognises URLs on the configured bucket's host. Rows that
-- store a full https://<old-bucket>.s3.amazonaws.com/<key>?X-Amz-... URL stop resolving
-- once the bucket name changes. Reduce them to the bare key, which the service accepts.
-- The regexp keeps the key and drops the host and any presigned query string.

DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['men','women'] LOOP
    EXECUTE format($f$UPDATE %I.games SET away_logo = regexp_replace(away_logo, '^https?://[^/]+/([^?]+).*$', '\1') WHERE away_logo ~ '^https?://[^/]+\.amazonaws\.com/'$f$, s);
    EXECUTE format($f$UPDATE %I.players SET photo_url = regexp_replace(photo_url, '^https?://[^/]+/([^?]+).*$', '\1') WHERE photo_url ~ '^https?://[^/]+\.amazonaws\.com/'$f$, s);
    EXECUTE format($f$UPDATE %I.teams SET logo_url = regexp_replace(logo_url, '^https?://[^/]+/([^?]+).*$', '\1') WHERE logo_url ~ '^https?://[^/]+\.amazonaws\.com/'$f$, s);
  END LOOP;
  UPDATE men.coaches SET photo_url = regexp_replace(photo_url, '^https?://[^/]+/([^?]+).*$', '\1') WHERE photo_url ~ '^https?://[^/]+\.amazonaws\.com/';
  UPDATE men.events SET image = regexp_replace(image, '^https?://[^/]+/([^?]+).*$', '\1') WHERE image ~ '^https?://[^/]+\.amazonaws\.com/';
  UPDATE men.raffles SET image = regexp_replace(image, '^https?://[^/]+/([^?]+).*$', '\1') WHERE image ~ '^https?://[^/]+\.amazonaws\.com/';
END $$;
-- jsonb arrays of URLs: rewrite each element the same way, leaving non-S3 elements alone.
UPDATE men.raffles SET images = (
  SELECT jsonb_agg(CASE WHEN e #>> '{}' ~ '^https?://[^/]+\.amazonaws\.com/'
                        THEN to_jsonb(regexp_replace(e #>> '{}', '^https?://[^/]+/([^?]+).*$', '\1'))
                        ELSE e END)
  FROM jsonb_array_elements(images) e)
WHERE jsonb_typeof(images) = 'array' AND images::text ~ 'amazonaws\.com';

DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['men','women'] LOOP
    EXECUTE format($f$UPDATE %I.gallery_folders SET urls = (
      SELECT jsonb_agg(CASE WHEN e #>> '{}' ~ '^https?://[^/]+\.amazonaws\.com/'
                            THEN to_jsonb(regexp_replace(e #>> '{}', '^https?://[^/]+/([^?]+).*$', '\1'))
                            ELSE e END)
      FROM jsonb_array_elements(urls) e)
      WHERE jsonb_typeof(urls) = 'array' AND urls::text ~ 'amazonaws\.com'$f$, s);
  END LOOP;
END $$;

-- printify_order_id was added later and never backfilled; the id is in the response payload.
UPDATE men.printify_order_logs
   SET printify_order_id = response_payload::json ->> 'id'
 WHERE printify_order_id IS NULL AND response_payload IS NOT NULL;
