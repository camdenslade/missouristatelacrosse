# Missouri State Lacrosse - Backend

Java 17 / Spring Boot REST API for the Missouri State Lacrosse site. Serves both the
Men's and Women's programs from a single instance using Postgres schema-per-program
multi-tenancy (`men` / `women`), selected per request by the `X-Program` header.

- Frontend: `../` (React + Vite, deployed to S3 + CloudFront)
- Auth: Amazon Cognito, with existing Firebase accounts migrating automatically on
  first sign-in - see [`../docs/cognito-migration-plan.md`](../docs/cognito-migration-plan.md)
- Payments: PayPal + Stripe - see [`../docs/payments.md`](../docs/payments.md)
- Operations, deploys, and the account/credential map: [`../docs/HANDOFF.md`](../docs/HANDOFF.md)
- Infrastructure as code: [`../infra/terraform/`](../infra/terraform/README.md)

## Stack

- Spring Boot 3.5 (web, data-jpa, websocket, actuator, validation)
- PostgreSQL + Flyway migrations (`src/main/resources/db/migration`, `V*.sql`)
- `CognitoTokenVerifier` + `FirebaseAdminFilter` for auth-token verification (both
  providers are accepted while the Firebase migration is still open)
- AWS: SES (transactional email), S3 (image storage), Cognito (sign-in), Secrets
  Manager (prod config)
- PayPal REST (hand-rolled `RestTemplate`) + Stripe Java SDK
- Printify REST for the team store
- Self-hosted RTMP/HLS streaming via MediaMTX (`/etc/mediamtx/mediamtx.yml` on the box)

## Run locally

### Fastest: Docker Compose (from the repo root)

```
docker compose up --build        # Postgres + backend on the "local" profile, :8080
docker compose down              # stop  (add -v to wipe the db volume)
```

The **`local` profile** makes this work with no AWS account: `MainApp` skips Secrets
Manager, every credential-backed `@Value` has a blank/sandbox default, and
`PayPalSDKService` logs a warning instead of failing to start. The app boots, Flyway
runs both schemas against the container Postgres, and the whole API is usable.
External integrations (SES email, S3 uploads, Firebase token verification, live
PayPal/Stripe/Printify) don't work without real credentials - expected locally.

To iterate on backend code without rebuilding the image each time, run just the DB in
Docker and the app from your IDE / Gradle:

```
docker compose up -d db
./gradlew bootRun -Dspring.profiles.active=local
```

Seed accounts: copy `scripts/seed_users.example.sql` -> `scripts/seed_users.sql`, fill
in real Firebase UIDs, run it against the DB.

### Without Docker

Prereqs: JDK 17 and a local Postgres with a `lacrosse` database, reachable as user
`postgres`. If your local Postgres has a password, set `DB_PASSWORD` (the config
defaults to no password, which matches the Docker setup's trust auth).

```
createdb lacrosse         # or: psql -c 'create database lacrosse'
cd backend
./gradlew bootRun -Dspring.profiles.active=local
```

Override the connection with `DB_URL` / `DB_USER` / `DB_PASSWORD` env vars if needed.
For a run that mimics prod config, set the env vars listed in `docs/HANDOFF.md §3` and
omit the `local` profile.

```
./gradlew build           # compile + run the test suite (H2, Flyway disabled for tests)
./gradlew test
```

Health check: `GET http://localhost:8080/actuator/health`.

## Deploy

The normal path is the **"Deploy backend (Systems Manager)"** GitHub Actions workflow
(manual, run from `main`): it builds, tests, uploads the jar to S3, and has the server
install it through AWS Systems Manager - no SSH, no stored AWS keys. It checks the
jar's checksum and automatically rolls back to the previous version if the new one
doesn't come up healthy. See [`../docs/HANDOFF.md`](../docs/HANDOFF.md) §5.

`./deploy-backend.sh` still works as a fallback from your own machine over SSH (only
from the admin's allowed IP - `admin_ssh_cidr` in `../infra/terraform/compute.tf`).
Requires `mostatelax-prod-key.pem` (git-ignored) in this directory.

## Layout

```
Controller/   REST endpoints (one per resource; *Controller)
Service/      business logic + external integrations (PayPal, Stripe, S3, SES, Printify, Firebase)
Repository/   Spring Data JPA repositories
Model/        @Entity classes
Config/       filters (FirebaseAdminFilter, ProgramFilter), CORS, secrets, tenant resolution
Dto/          request/response records
Utils/        JSON + text-sanitization helpers
```
