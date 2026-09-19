#!/bin/bash
# Rebuilds the staging database from a fresh copy of production, scrubs it, and adds a test admin.
# Run on the server as root, through Systems Manager. It only ever writes to the staging database,
# and it reads production through a dump, so production is not changed.
#
# Usage: refresh-db.sh <path-to-scrub.sql>
set -euo pipefail

SCRUB="${1:?usage: refresh-db.sh <scrub.sql>}"
STAGING_DB=lacrosse_staging
STAGING_ROLE=laxapp_staging
SERVICE=laxsite-backend-staging
ADMIN_EMAIL=staging-admin@missouristatelacrosse.com

# Guard: this script must never point at production.
[ "$STAGING_DB" != "lacrosse" ] || { echo "refusing: target is the production database"; exit 1; }

systemctl stop "$SERVICE" 2>/dev/null || true

sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS $STAGING_DB" -c "CREATE DATABASE $STAGING_DB OWNER $STAGING_ROLE"

# Dump production straight into staging (nothing is written to disk).
sudo -u postgres pg_dump -Fc --no-owner --no-acl lacrosse \
  | sudo -u postgres pg_restore --no-owner --no-acl --role="$STAGING_ROLE" -d "$STAGING_DB"

sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$STAGING_DB" -f "$SCRUB"

# A test admin for both programs. Signing in is with the staging Cognito account of the same email.
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$STAGING_DB" <<SQL
INSERT INTO men.users (id, firebase_uid, email, display_name, roles, programs, created_at, updated_at)
VALUES (gen_random_uuid(), 'staging-admin-uid', '$ADMIN_EMAIL', 'Staging Admin',
        '{"men":"admin","women":"admin"}', '["men","women"]', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO women.users (id, firebase_uid, email, display_name, roles, programs, created_at, updated_at)
VALUES (gen_random_uuid(), 'staging-admin-uid', '$ADMIN_EMAIL', 'Staging Admin',
        '{"men":"admin","women":"admin"}', '["men","women"]', now(), now())
ON CONFLICT DO NOTHING;
SQL

# Belt and braces: no real-looking email may remain in the people tables.
LEFT=$(sudo -u postgres psql -At -d "$STAGING_DB" -c "select count(*) from men.users where email not like '%@staging.invalid' and email <> '$ADMIN_EMAIL'")
[ "$LEFT" = "0" ] || { echo "SCRUB CHECK FAILED: $LEFT unscrubbed user emails remain"; exit 1; }

systemctl start "$SERVICE" 2>/dev/null || true
echo "staging database refreshed and scrubbed"
