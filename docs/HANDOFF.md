# Missouri State Lacrosse - Operations & Handoff Guide

If you're taking this over: read this whole file once, then keep it open. It's the map
of every account, credential, and procedure needed to run the site.

Last updated: 2026-09-23, after the full migration to a dedicated AWS org account with
Terraform-managed infrastructure, Cognito sign-in, and S3/CloudFront hosting. Most of
the older companion docs listed at the bottom of this file describe the **previous**
setup (a single personal AWS account, Firebase Hosting, PayPal-only) and are now
historical background, not current operating instructions - this file supersedes them
on anything they disagree about.

---

## 1. What the site is

- **Frontend:** React 19 + TypeScript + Vite SPA, one codebase serving both the Men's
  and Women's programs (`/women/*` path prefix switches program). Static files in a
  private S3 bucket, served worldwide by **CloudFront**.
- **Backend:** Java 17 / Spring Boot 3.5 REST API on a single EC2 instance. PostgreSQL,
  nginx (TLS), and MediaMTX (RTMP/HLS streaming) all run on that same box. A second,
  isolated **staging** copy of the backend runs alongside it on the same server (see §8).
- **Auth:** Amazon Cognito. Existing accounts created under the old Firebase login
  migrate automatically the first time they sign in (a Lambda checks their old password
  against Firebase once, then Cognito takes over) - see `cognito-migration-plan.md`.
  New accounts are Cognito-only from the start.
- **Multi-tenancy:** one database, schema-per-program (`men`, `women`), chosen per
  request by the `X-Program` header.
- **Password manager:** a self-hosted Vaultwarden (Bitwarden-compatible) instance for
  officers, on its own small server - see §7.

Request flow: browser -> `https://missouristatelacrosse.com` (CloudFront + S3) ->
`/api/*` calls go to `https://api.missouristatelacrosse.com` (EC2, nginx TLS -> Spring
Boot on :8080). Everything AWS-side is defined in Terraform (`infra/terraform/`) -
`terraform plan` should always say "No changes"; if it doesn't, someone edited the
account by hand and the drift needs resolving.

---

## 2. Account & service inventory

| Service | Purpose | How you log in | ~Cost |
|---|---|---|---|
| **AWS** (org account `864145505327`, region `us-east-1`) | EC2 (backend + vault), S3, CloudFront, Cognito, Secrets Manager, SES, DNS certs | IAM user for whoever runs Terraform / deploys by hand; GitHub Actions uses no stored keys (OIDC) | ~$50/mo, budget-capped at $60 (see §9) |
| **Cognito** (pool `mostatelax-prod-users`, `us-east-1_HqmiTqIrF`) | Sign-in for the live site | managed entirely through Terraform + the AWS console | included above |
| **Vaultwarden** (`vault.missouristatelacrosse.com`) | Team password manager | invite-only; admins add officers from inside the app | included above (~$11/mo of it) |
| **Firebase** (project `missouristatelacrosse-cc913`) | Legacy auth only, kept alive until every user has migrated to Cognito (see §1). Hosting is no longer used for anything. | Google account tied to the project | free tier |
| **Cloudflare** | DNS for `missouristatelacrosse.com` | Cloudflare account | free tier |
| **Domain registrar** | `missouristatelacrosse.com` registration | confirm current registrar | ~$12/yr |
| **PayPal** | payments, one of two rails (see `payments.md`) | PayPal business account | per-txn fees |
| **Stripe** | payments, the currently **active** rail | Stripe account | 2.9% + $0.30 |
| **Printify** | team store fulfilment | Printify account | per-order |
| **GitHub** (`camdenslade/missouristatelacrosse`) | source, CI/CD | GitHub account | free |

The **old** AWS account (`390402548152`) that ran everything before the 2026-09
migration has been fully decommissioned - see `decommission-old-account.md` for what
was cleaned up there and in Cloudflare. Nothing lacrosse-related should be left in it.

---

## 3. Where every credential lives

| Credential | Location | Notes |
|---|---|---|
| Backend runtime secrets (PayPal, Stripe, Printify, DB, S3) | **AWS Secrets Manager `mostatelax/prod/backend`** (JSON) | loaded on boot by `MainApp.loadSecretsFromAWS()`. Source of truth for the backend. |
| Firebase service account (legacy login verification) | Secrets Manager `mostatelax/prod/firebase-service-account` | used only while Firebase sign-in is still supported |
| Frontend build config | GitHub repo **Variables** (Settings -> Secrets and variables -> Actions -> Variables), for the real deploy workflow | see the header comment of `.github/workflows/deploy-frontend.yml` for the exact list. **Do not** rely on a local `.env` for a production build - see the warning in that file. |
| Local dev `.env` | `/.env` (git-ignored) | for `npm run dev` only |
| Cognito web app IDs | `src/Services/cognitoAuth.ts` | public by design (pool id + client id, no secret) |
| SSH to the backend server | `backend/mostatelax-prod-key.pem` (git-ignored), allowed only from the admin's home IP | normal ops no longer need this - see §5 |
| AWS credentials for Terraform / manual ops | `~/.aws/credentials`, profile `org` | whoever administers the infrastructure |
| Vault SMTP credential | Secrets Manager `mostatelax/prod/vault-smtp` | never in git or Terraform |
| TLS certs (api + vault subdomains) | `/etc/letsencrypt/` on each box | auto-renewed by `certbot-renew.timer` |

---

## 4. Repositories

- **`camdenslade/missouristatelacrosse`** - everything (frontend `src/`, backend
  `backend/`, infrastructure `infra/`, `docs/`). Default branch `main`.
- `main` and `staging` are protected branches (require a PR, no force-push, no direct
  push). A `staging` branch push/PR is what the staging deploy workflows trust - keep it
  restricted to people who should be able to run code on the shared server.

---

## 5. Deploy

Both are **manual** GitHub Actions workflows (`workflow_dispatch`), run from `main`.
Neither uses stored AWS keys or SSH - GitHub proves its identity with OIDC, and each
role can only touch its own bucket or instance (`infra/terraform/iam.tf`).

### Frontend

Workflow: **Deploy frontend (S3 + CloudFront)**. Builds the site from the repo's
GitHub Actions **Variables** (never from anyone's local `.env`), syncs it to the S3
bucket, clears the CloudFront cache.

### Backend

Workflow: **Deploy backend (Systems Manager)**. Builds and tests, uploads the jar to
S3, then has the server install it through AWS Systems Manager. The server checks the
jar's checksum first and **automatically rolls back** to the previous version if the
new one doesn't come up healthy within 90 seconds
(`infra/backend/deploy-on-server.sh`).

### Fallback (only if GitHub Actions is unavailable)

`backend/deploy-backend.sh` still works from your own machine over SSH, but only from
the admin's own IP (`admin_ssh_cidr` in `infra/terraform/compute.tf`).

### Staging

Same two flows exist for staging (`Deploy staging frontend`, `Deploy staging backend`),
runnable from `main` or a branch called `staging`, plus a `Refresh staging data`
workflow that rebuilds staging's database from a scrubbed copy of production. Full
detail: `staging.md`.

---

## 6. Local development

**Frontend:**
```
npm ci
cp <get a .env from the owner>   # or build your own from docs/payments.md + this file
npm run dev                      # Vite on :5173, proxies /api to :8080
```

**Backend:** easiest is `docker compose up --build` from the repo root - brings up
Postgres + the backend on the **`local` profile**, which skips AWS Secrets Manager
entirely (no AWS account needed). Full detail in `backend/README.md`. External
integrations (email, S3, Cognito, payments) need real credentials and won't work
locally - the rest of the API does.

---

## 7. Operations runbook

Everything here is defined in `infra/terraform/` - when in doubt, that's the source of
truth, and `docs/staging.md` / the `infra/terraform/README.md` "Known gaps" section
cover the operational details not repeated here.

### The backend server (`mostatelax-prod-backend`)

No SSH needed for normal operations - manage it through **AWS Systems Manager**
(console: Systems Manager -> Session Manager, or `aws ssm send-command`). SSH still
works from the admin's own IP as a fallback.

| Thing | Command / location |
|---|---|
| App service | `systemctl {status,restart,stop,start} laxsite-backend` |
| App logs | `journalctl -u laxsite-backend` (not a log file - the service logs to the systemd journal) |
| Staging service | `systemctl {status,restart} laxsite-backend-staging`, port 8081, `journalctl -u laxsite-backend-staging` |
| Web server | `systemctl restart nginx`; config `/etc/nginx/conf.d/*.conf` |
| Database | `sudo -u postgres psql` (PostgreSQL, data in `/var/lib/pgsql/data`); schemas `men`, `women` in database `lacrosse`, plus `lacrosse_staging` |
| Streaming | `systemctl restart mediamtx`; config `/etc/mediamtx/mediamtx.yml`. Publishing requires a valid stream key - the RTMP port itself is open to the world on purpose (streams originate from away-game venues with unpredictable IPs), but MediaMTX calls back to `/api/stream/rtmp/auth` on every publish attempt. |
| TLS cert | `/etc/letsencrypt/`; auto-renews via `certbot-renew.timer` |
| Health | `curl https://api.missouristatelacrosse.com/actuator/health` |
| Instance | `i-0a9fa6a3486e95c86`, us-east-1c, Elastic IP `44.215.201.9` (`terraform output backend_instance_id`) |
| Uptime alerting | a Lambda checks both the API health endpoint and the website's home page every 5 minutes; either being down for 3 checks in a row emails `admin@` |

### DB backup

Nightly `pg_dump -Fc lacrosse` via a systemd timer (07:00 UTC), uploaded to
`s3://mostatelax-prod-backups/db/` and kept 35 days there. The EBS root volume is also
snapshotted daily (kept 7 days) by an AWS DLM policy, covering the whole box, not just
the database.

- Restore locally: `pg_dump` output is a standard `pg_restore` archive.
- A full restore rehearsal (dump -> restore -> apply pending migrations -> verify) has
  been run successfully during the migration; it is not yet on a recurring schedule.

### The vault server (`mostatelax-prod-vault`)

No SSH at all, ever - Systems Manager only. Full detail in `infra/terraform/README.md`
under "Password manager (Vaultwarden)".

---

## 8. Feature flags

Set as GitHub Actions repository **Variables**, take effect on the next frontend
deploy:

| Flag | Effect |
|---|---|
| `VITE_PAYMENT_PROVIDER` / `_WOMEN` | `paypal` or `stripe` per program - see `payments.md`. Currently **`stripe`** for both programs. |
| `VITE_TEAMSTORE_ENABLED` / `_WOMEN` | show/hide the team store |
| `VITE_DONATE_ENABLED` / `_WOMEN` | show/hide donations |

---

## 9. "When X breaks"

**Site loads but API calls fail.** `systemctl status laxsite-backend`,
`journalctl -u laxsite-backend -n 100`. Restart it. Check `free -m` for memory
pressure.

**Whole site down.** Is the EC2 instance running?
(`aws ec2 describe-instances --instance-ids i-0a9fa6a3486e95c86 --profile org`). If
running but unreachable, check the security group and that nginx + certbot are
healthy.

**A frontend or backend deploy went out broken.** The backend deploy already rolls
itself back automatically if the new version doesn't come up healthy - check the
GitHub Actions run log for what happened. For the frontend, re-run the deploy workflow
against an earlier commit, or `aws s3 sync` an older build by hand and invalidate
CloudFront.

**Stream won't start.** `systemctl status mediamtx`; check the OBS stream key matches
what `POST /api/stream/setup` issued; the RTMP auth check
(`/api/stream/rtmp/auth`) is what actually gates publishing, not the firewall.

**TLS cert expired.** `sudo certbot renew --force-renewal && sudo systemctl reload
nginx`. Shouldn't happen - the timer handles it (confirmed with a dry run during
migration).

**DB corruption / bad migration.** Restore from the most recent dump in
`s3://mostatelax-prod-backups/db/`. Flyway migrations are in
`backend/src/main/resources/db/migration/`; they run automatically on backend startup
against both schemas.

**`terraform plan` shows unexpected changes.** Someone edited the AWS account by hand
outside Terraform. Read the plan carefully before applying - it will tell you exactly
what's different.

---

## 10. Cost

~$50/mo, with a hard budget alert at $60 (`infra/terraform/monitoring.tf` - emails at
75% and 100% of actual spend, and 100% of forecast spend). The nonprofit AWS credit
grant covers this for well over a year. Livestreamed events add data-transfer cost
proportional to viewership - worth a glance at the bill after a big one.

---

## 11. Known open work

- **Firebase retirement** - deliberately deferred; see `cognito-migration-plan.md` for
  what "done" looks like (everyone migrated, then delete the Lambda, the Firebase
  secret, and the Firebase project itself).
- **EBS root volume encryption on the vault server / any future new instance** - the
  backend server's volume was encrypted 2026-09-20
  (`infra/backend/encrypt-root-volume.sh`); repeat for any newly built instance.
- **No audit trail for manual dues-balance edits** - a player's `balance` field can be
  typed over directly with no record of who changed it or when (unlike real payments,
  which are always logged). Known, low priority, not fixed.
- **Men/Women code is duplicated** (mirror files under `src/Men` / `src/Women`), not
  factored into shared components - always update both sides.
- Older docs (`aws-cost.md`, `ec2-scaling.md`, `ci-cd.md`, `professionalization-scan.md`,
  `audit-findings.md`) describe the pre-migration setup and are historical reference
  only at this point - safe to consult for background, not for current procedure.

---

## 12. Handoff checklist (for the departing owner)

- [ ] Transfer **AWS org account** root, or create an admin IAM user for the new owner.
- [ ] Add the new owner to the **Firebase** project (`missouristatelacrosse-cc913`) as
      Owner/Editor, until it's fully retired (§11).
- [ ] Transfer or share the **Cloudflare** account (DNS).
- [ ] Transfer the **domain registration**.
- [ ] Add the new owner as an admin on **PayPal / Stripe / Printify**.
- [ ] Give them **GitHub** repo admin, and make sure they're covered by the `main` /
      `staging` branch protection rules (not exempt from them).
- [ ] Add them as an officer in **Vaultwarden** and walk through where the shared
      credentials live.
- [ ] Walk through one real backend deploy and one frontend deploy together, through
      GitHub Actions (not by hand).
- [ ] Confirm they can reach the boxes through Systems Manager.
- [ ] Rotate every shared credential after the handoff so the departing owner no
      longer has access (AWS keys, Printify token, PayPal/Stripe keys, the SSH key
      pair, Vaultwarden admin access).
