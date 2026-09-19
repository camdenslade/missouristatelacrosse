# Staging

A rehearsal copy of the site for testing changes before they reach the real one.

| | Address | Notes |
|---|---|---|
| Site | https://staging.missouristatelacrosse.com | Shared password, kept out of search engines |
| Backend | https://api-staging.missouristatelacrosse.com | Separate service, database, settings and sign-in system |

## What it is, and what it is not

Staging runs on the **same server as production**, to stay inside the monthly budget (it adds about
$1 a month). It has its own database, its own sign-in system (Cognito pool), its own image bucket
and its own settings, and it runs under hard memory and CPU limits so it cannot crowd production
out. It is good for testing **code and data changes**: new pages, new features, database migrations.
It cannot test **server changes** (operating system, firewall, sizing). For those, read the
`terraform plan`.

Safety choices:

- The database is a copy of production with personal details removed (`infra/staging/scrub.sql`).
  Emails are replaced with fake ones, payment and order details are wiped, and invite links, stream
  keys and access requests are deleted. Roster names are kept, since they are public on the site.
- Email sending is switched off, so staging cannot email anyone.
- Payments cannot work: staging has placeholder keys and no Printify token, so it cannot take a real
  payment or place a real order. See "Testing payments" below.
- Staging's image bucket is a separate copy, so an upload or delete in staging never touches
  production's images.
- A sign-in from staging is rejected by production, and the reverse, because they are separate pools.

## Signing in

- **The site's password gate:** user `staging`, password from `terraform output -raw staging_site_password`
  (run in `infra/terraform` with `AWS_PROFILE=org`).
- **The test admin account:** email and password are in Secrets Manager under
  `mostatelax/staging/test-admin`. It is an admin on both the men's and women's programs.

## Deploying to staging

Three manual GitHub workflows, each runnable from the `main` branch or a branch named `staging`:

- **Deploy staging backend:** builds and tests, then installs the jar as the staging service. The
  database migrations in the jar run against staging's database when it starts, so this is where to
  watch a new migration work before it touches real data. Like production, it checks the file's
  checksum first and rolls back automatically if the new version does not start.
- **Deploy staging frontend:** builds the site against the staging backend and publishes it.
- **Refresh staging data:** replaces staging's database with a fresh, scrubbed copy of production.
  Anything entered in staging is lost, and the test admin is recreated.

A good routine for a risky change: push it to a branch called `staging`, run the two deploy
workflows, click through it, then merge to `main` and deploy for real. Protect the `staging` branch
in GitHub (Settings, Branches): a push there can run code on the shared server.

## Testing payments

Staging cannot take payments until you give it sandbox keys. Sandbox money is not real.

1. Put a PayPal **sandbox** client id and secret in the secret `mostatelax/staging/backend`
   (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`), and Stripe **test** keys (`STRIPE_SECRET_KEY`,
   `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`).
2. Set the repository variables `STAGING_PAYPAL_CLIENT_ID` and `STAGING_STRIPE_PUBLISHABLE_KEY`.
3. Restart the staging service (redeploy it) and redeploy the staging frontend.

Never put live keys in staging. Leave `PRINTIFY_API_TOKEN` as the placeholder: Printify has no
sandbox, so a real token would place real orders.

## Where it is defined

`infra/terraform/staging.tf` (site, certificate, sign-in pool, buckets, secrets, permissions) and
`infra/staging/` (`scrub.sql`, `refresh-db.sh`, `setup-on-server.sh`). The backend reads its
allowed origins and its public address from `CORS_EXTRA_ORIGINS` and `FRONTEND_BASE_URL`, so the same
jar works in both places.
