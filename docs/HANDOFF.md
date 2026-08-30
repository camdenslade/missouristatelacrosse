# Missouri State Lacrosse - Operations & Handoff Guide

If you're taking this over: read this whole file once, then keep it open. It's the map
of every account, credential, and procedure needed to run the site. Companion docs:
`payments.md`, `aws-cost.md`, `ec2-scaling.md`, `ci-cd.md`, `professionalization-scan.md`,
`audit-findings.md`.

Last updated: 2026-08-30.

---

## 1. What the site is

- **Frontend:** React 19 + TypeScript + Vite SPA, one codebase serving both the Men's
  and Women's programs (`/women/*` path prefix switches program). Hosted on **Firebase
  Hosting**.
- **Backend:** Java 17 / Spring Boot 3.5 REST API on a **single EC2 instance**.
  PostgreSQL, nginx (TLS), and MediaMTX (RTMP/HLS streaming) all run on that same box.
- **Auth:** Firebase Authentication (email/password + an admin-approved account-request
  flow).
- **Multi-tenancy:** one database, schema-per-program (`men`, `women`), chosen per
  request by the `X-Program` header.

Request flow: browser -> `https://missouristatelacrosse.com` (Firebase Hosting) ->
API calls go to `https://api.missouristatelacrosse.com` (EC2, nginx TLS -> Spring Boot
on :8080).

---

## 2. Account & service inventory

| Service | Purpose | How you log in | ~Cost |
|---|---|---|---|
| **AWS** (acct `390402548152`) | EC2 backend, S3 images, SES email, Secrets Manager | root = the owner's personal email; IAM user `backenddeploy` has deploy-only keys | ~$16/mo (see `aws-cost.md`) |
| **Firebase** (project `missouristatelacrosse-cc913`) | Hosting (frontend), Authentication | Google account tied to the project | free tier |
| **Cloudflare** | DNS for `missouristatelacrosse.com`, inbound email routing | Cloudflare account | Workers Free (keep); R2 + Images/Stream bundle = **cancel** (old streaming, unused) |
| **Domain registrar** | `missouristatelacrosse.com` registration | originally Google Domains, now Squarespace/Cloudflare - confirm | ~$12/yr |
| **PayPal** | payments (currently **RESTRICTED** - see §9) | PayPal business account | per-txn fees |
| **Stripe** | payments (coded, **not yet activated** - waiting on the team's EIN) | to be created | 2.9% + $0.30 |
| **Printify** | team store fulfilment | Printify account | per-order |
| **GitHub** (`camdenslade/missouristatelacrosse`) | source, CI/CD | GitHub account | free |

**Other projects in the same AWS account** (not lacrosse - don't touch): a stopped
`versa-kimbu` EC2 instance + its ECS tasks, and `tabup` (ECR repo + S3 bucket). If the
AWS bill looks high, that's where the rest is.

---

## 3. Where every credential lives

| Credential | Location | Notes |
|---|---|---|
| Backend runtime secrets (PayPal, Printify, DB, S3, SES) | **AWS Secrets Manager `backend-prod`** (JSON) | loaded on boot by `MainApp.loadSecretsFromAWS()` before Spring starts. This is the **source of truth** for the backend. |
| Firebase service account (backend) | AWS Secrets Manager `firebase-service-account` (JSON) | used by `FirebaseConfig` to verify ID tokens |
| Frontend build config | `/.env` (git-ignored) | `VITE_API_BASE`, `VITE_PAYPAL_CLIENT_ID`, `VITE_PAYMENT_PROVIDER(_WOMEN)`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_TEAMSTORE_ENABLED*`, `VITE_DONATE_ENABLED*`. All public-safe (they ship in the browser bundle). |
| Firebase web config | `src/Services/firebaseConfig.ts` (tracked) | public by design |
| EC2 SSH key | `backend/laxsite-key.pem` (git-ignored) | `ssh -i backend/laxsite-key.pem ec2-user@api.missouristatelacrosse.com` |
| AWS deploy keys | `~/.aws/credentials` on the maintainer's machine | IAM user `backenddeploy` |
| TLS cert (api subdomain) | `/etc/letsencrypt/live/api.missouristatelacrosse.com/` on the box | auto-renewed by `certbot-renew.timer` |

**Note:** `.env` `VITE_PAYPAL_CLIENT_ID` and Secrets Manager `PAYPAL_CLIENT_ID` now
both = `AfD-0D3_SAR-...` (fixed 2026-08-30; `.env` previously had a stale `AeQ...`).
The client id is public (ships in the browser bundle). The Printify API token was
previously exposed in plaintext in the systemd unit (now removed) - **rotate it** in
the Printify dashboard and update `backend-prod`.

---

## 4. Repositories

- **`camdenslade/missouristatelacrosse`** - everything (frontend `src/`, backend
  `backend/`, infra config, `docs/`). Default branch `main`.
- Large uncommitted working tree currently exists on `main`. The P0 repo-hygiene fixes
  (migrations V1-V5, `application.properties`, `package-lock.json`, deploy scripts now
  tracked) are **staged but not committed** - the owner commits.

---

## 5. Deploy

### Frontend (Firebase Hosting)

```
npm ci
npm run build          # tsc --noEmit && vite build  (build:fast skips the tsc gate)
firebase deploy --only hosting        # needs `firebase login` once
```

`.firebaserc` pins project `missouristatelacrosse-cc913`. Output dir is `dist/`.

### Backend (EC2)

```
cd backend
./deploy-backend.sh
```

That script: runs `./gradlew test`, builds the boot jar, `scp`s it to
`ec2-user@api.missouristatelacrosse.com:~/backend/build/libs/`, then
`sudo systemctl restart laxsite-backend` and health-checks. Needs
`backend/laxsite-key.pem`.

### CI/CD (GitHub Actions - scaffolded, needs secrets)

`.github/workflows/`: `ci.yml` runs on every PR (lint/typecheck/test/build + gradle
build). `deploy-backend.yml` / `deploy-frontend.yml` are manual (`workflow_dispatch`).
To activate the deploy workflows, add repo secrets - see `ci-cd.md`.

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
entirely (no AWS account needed). Or run just the DB in Docker and the app from your
IDE: `docker compose up -d db` then `./gradlew bootRun -Dspring.profiles.active=local`.
Full detail in `backend/README.md`. External integrations (email, S3, Firebase auth,
payments) need real credentials and won't work locally - the rest of the API does.

Seed accounts: copy `backend/scripts/seed_users.example.sql` -> `seed_users.sql`, fill
in real Firebase UIDs, run against the DB.

---

## 7. Operations runbook (the EC2 box)

SSH: `ssh -i backend/laxsite-key.pem ec2-user@api.missouristatelacrosse.com`

| Thing | Command / location |
|---|---|
| App service | `sudo systemctl {status,restart,stop,start} laxsite-backend` |
| App logs | `/var/log/laxsite-backend.log` (stdout), `/var/log/laxsite-backend-error.log` |
| App config | `/etc/systemd/system/laxsite-backend.service` + drop-in `.d/10-resources.conf` (JVM caps, memory limits - see `ec2-scaling.md`) |
| Web server | `sudo systemctl restart nginx`; config `/etc/nginx/conf.d/laxsite-backend.conf` |
| Database | `sudo -u postgres psql` (PostgreSQL 16, data in `/var/lib/pgsql/data`); schemas `men`, `women` |
| Streaming | `sudo systemctl restart mediamtx`; binary `/usr/local/bin/mediamtx`, config `/etc/mediamtx/mediamtx.yml` |
| TLS cert | `/etc/letsencrypt/`; auto-renews via `certbot-renew.timer` (`systemctl list-timers`) |
| Health | `curl https://api.missouristatelacrosse.com/actuator/health` |
| Memory | `free -m` (t3.micro - see below) |
| Instance | `i-0800e9fce88ebd384`, us-east-1, Elastic IP `34.194.0.119` |

### Game-night scaling

The box runs **t3.micro** (1 GiB) normally. For a livestreamed game (stream + chat +
concurrent viewers), size it up first:

```
backend/scripts/scale-lax.sh up      # -> t3.medium, ~1 hr before
backend/scripts/scale-lax.sh down    # -> t3.micro, the next day
```

Needs an IAM permission on `backenddeploy` (`scale-lax-iam-policy.json`) - or just
resize in the EC2 console (stop -> change instance type -> start, ~2-3 min). Full
detail + the memory safety net (swap, JVM caps, cgroup limits) in `ec2-scaling.md`.

### DB backup

Nightly `pg_dump -Fc lacrosse` (all schemas) via a **systemd timer**
(`laxsite-db-backup.timer`, 07:00 UTC = 02:00 Central; AL2023 has no cron). Script:
`/usr/local/bin/laxsite-db-backup.sh`. Keeps the last **30 dumps locally** in
`/var/backups/laxsite-db/` (~400 KB each). Log: `/var/log/laxsite-db-backup.log`.

- Manual run: `sudo systemctl start laxsite-db-backup.service`
- Restore: `sudo -u postgres pg_restore -c -d lacrosse /var/backups/laxsite-db/lacrosse-<TS>.dump`

**Off-box copy is not active yet.** The box's role can't write to S3 outside the image
prefixes. To enable: attach `backend/scripts/ec2-role-db-backup-s3-policy.json` to the
`ec2-role` IAM role - then the script uploads to
`s3://mostatelacrosse-general-images/db-backups/` automatically.

**Also set up EBS snapshots** (covers the whole box, not just the DB): EC2 console ->
Lifecycle Manager -> create a policy, target the volume by tag, daily, retain ~7. ~5
min, ~$1-2/mo.

### Log rotation

`/etc/logrotate.d/laxsite-backend` - daily, keep 7, compress, `copytruncate` - covers
`laxsite-backend.log`, `laxsite-backend-error.log`, `laxsite-db-backup.log`. (Installed
2026-08-30; the runaway `laxsite-backend.log` was ~1 GB and was truncated then.)

---

## 8. Feature flags

Set in `/.env`, take effect on the next `npm run build` + `firebase deploy`:

| Flag | Effect |
|---|---|
| `VITE_PAYMENT_PROVIDER` / `_WOMEN` | `paypal` (default) or `stripe` per program - see `payments.md` |
| `VITE_TEAMSTORE_ENABLED` / `_WOMEN` | show/hide the team store |
| `VITE_DONATE_ENABLED` / `_WOMEN` | show/hide donations |

---

## 9. "When X breaks"

**Payments failing / "merchant account restricted".** This is the current state - the
PayPal account is flagged (`422 PAYEE_ACCOUNT_RESTRICTED`). Fix path: activate Stripe
(the code is done and waiting) per the go-live checklist in `payments.md`, or get a
clean PayPal business account and update `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` in
Secrets Manager `backend-prod`, then restart the backend.

**Site loads but API calls fail.** Check the backend: SSH in, `systemctl status
laxsite-backend`, `tail -100 /var/log/laxsite-backend-error.log`. Restart it. Check
`free -m` - if memory is exhausted (game night on t3.micro), `scale-lax.sh up`.

**Whole site down.** Is the EC2 instance running? (`aws ec2 describe-instances
--instance-ids i-0800e9fce88ebd384`). If stopped, start it (console or an admin CLI -
`backenddeploy` can stop but **not** start). If running but unreachable, check the
security group still allows 80/443, and that nginx + certbot are healthy.

**Frontend deploy went out broken.** `firebase hosting:rollback` (Firebase console ->
Hosting -> release history -> roll back).

**Stream won't start.** `systemctl status mediamtx`; check the OBS stream key matches
what `POST /api/stream/setup` issued; check port 1935 is open in the security group.

**TLS cert expired.** `sudo certbot renew --force-renewal && sudo systemctl reload
nginx`. (Shouldn't happen - the timer handles it.)

**DB corruption / bad migration.** Restore from the most recent `pg_dump` (once §7
backups exist). Flyway migrations are in `backend/src/main/resources/db/migration/`
(V1-V30); they run on backend startup against both schemas.

---

## 10. Cost

~$16/mo (was ~$40 before the 2026-08-30 optimization). Breakdown and the deferred
Savings Plan in `aws-cost.md`. Cloudflare: cancel the **R2 Paid** and **Images Stream
Bundle** subscriptions (leftovers from an old streaming approach - nothing uses them).

---

## 11. Known open work

- **Stripe activation** - blocked on the team's EIN; code is done (`payments.md`).
- **DB backup off-box copy + EBS snapshots** - local nightly `pg_dump` and log rotation
  are now in place (§7); the S3 off-box copy needs one IAM policy
  (`ec2-role-db-backup-s3-policy.json`) and EBS snapshots need a Lifecycle Manager
  policy - both console tasks.
- **Rotate the Printify API token** - it was exposed in plaintext.
- **Reconcile the two PayPal client IDs** (§3).
- **CI/CD deploy workflows** - add the repo secrets to activate (`ci-cd.md`).
- Repo hygiene P0 fixes are staged, not committed.
- Lower priority: Men/Women code is duplicated (mirror files), not factored into shared
  components; a few orphans (`stream_config` table, Men-only Fundraiser, no Women
  `OrderLookup`). See `professionalization-scan.md`.
- The old `audit-findings.md` has 5 still-open items from the pre-launch security pass.

---

## 12. Handoff checklist (for the departing owner)

- [ ] Transfer **AWS root** (or create an admin IAM user for the new owner and confirm
      they can reach Billing, IAM, EC2, Secrets Manager).
- [ ] Add the new owner to the **Firebase** project (`missouristatelacrosse-cc913`) as
      Owner/Editor.
- [ ] Transfer or share the **Cloudflare** account (DNS).
- [ ] Transfer the **domain registration**.
- [ ] Add the new owner as an admin on **PayPal / Stripe / Printify**.
- [ ] Give them **GitHub** repo admin.
- [ ] Hand over `backend/laxsite-key.pem` and a copy of `/.env` securely (not email).
- [ ] Walk through one real backend deploy and one frontend deploy together.
- [ ] Confirm they can SSH to the box and restart services.
- [ ] Rotate every shared credential after the handoff (SSH key, Printify token,
      PayPal/Stripe keys, AWS access keys) so the departing owner no longer has access.
