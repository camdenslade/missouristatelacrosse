# CI / CD

GitHub Actions workflows in `.github/workflows/`.

## `ci.yml` - runs on every PR and push to `main`

Two jobs, no secrets required:

| Job | Steps |
|---|---|
| **frontend** | `npm ci` -> `npm run lint` -> `npm run typecheck` -> `npm test` -> `npm run build:fast` |
| **backend**  | `./gradlew --no-daemon build` (compiles + runs the JUnit suite; Flyway is disabled and the DB is in-memory H2 for tests) |

`lint` currently passes with 0 errors (127 warnings are allowed). If you want warnings
to fail CI later, change the script to `eslint . --max-warnings 0` and burn down the
list first.

## `deploy-backend.yml` - manual (`workflow_dispatch`)

The CI version of `backend/deploy-backend.sh`. Builds the boot jar, `scp`s it to the
EC2 host, restarts the `laxsite-backend` systemd unit, then polls `/actuator/health`.

**Repository secrets** (Settings -> Secrets and variables -> Actions -> Secrets):

| Secret | Value |
|---|---|
| `EC2_HOST` | `api.missouristatelacrosse.com` |
| `EC2_USER` | `ec2-user` |
| `EC2_SSH_KEY` | the full contents of `backend/laxsite-key.pem` |

App secrets (PayPal / Stripe / DB / S3) are **not** needed - the instance reads them
from AWS Secrets Manager at runtime via its IAM role.

## `deploy-frontend.yml` - manual (`workflow_dispatch`)

Builds the SPA and runs `firebase deploy --only hosting` for project
`missouristatelacrosse-cc913`.

**Repository secret:**

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON key for a service account with the **Firebase Hosting Admin** role |

**Repository variables** (Actions -> Variables) - these mirror the local `.env`, which
is deliberately not in git:

```
VITE_API_BASE=https://api.missouristatelacrosse.com
VITE_PAYMENT_PROVIDER=paypal
VITE_PAYMENT_PROVIDER_WOMEN=paypal
VITE_PAYPAL_CLIENT_ID=<public client id>
VITE_STRIPE_PUBLISHABLE_KEY=<pk_live_... only if provider=stripe>
VITE_TEAMSTORE_ENABLED=false
VITE_TEAMSTORE_ENABLED_WOMEN=false
VITE_DONATE_ENABLED=false
VITE_DONATE_ENABLED_WOMEN=false
```

## Making deploys automatic (later)

Both deploy workflows are manual on purpose so nothing ships to production before the
secrets are set and you've watched one run succeed. To auto-deploy on merge to `main`,
add to each deploy workflow:

```yaml
on:
  workflow_dispatch:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
```

and guard the job with `if: github.event.workflow_run.conclusion == 'success'`.

## Not covered

- No container image is built - prod runs the plain boot jar under systemd. If prod
  moves to a container runtime (see the infra backlog), add a `docker build/push` job.
- No preview deploys for PRs.
- No DB migration gating - Flyway runs on backend startup.
