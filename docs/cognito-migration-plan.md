# Auth migration: Firebase to Cognito

Status as of 2026-09-19: built and tested end to end against a rehearsal copy of the database.
Not deployed and not committed. Firebase is still the live auth until the deploy below.

## What exists (AWS account 864145505327, us-east-1)

| Thing | Value |
|---|---|
| User pool | `mostatelax-prod-users`, id `us-east-1_HqmiTqIrF` |
| App client | `mostatelax-web`, id `30vmrujtptv5n4iqosjaclmvla`, public (no secret), password and SRP auth |
| Migration Lambda | `mostatelax-cognito-migrate`, source in `infra/cognito-migrate/index.js` |
| Issuer (for JWT checks) | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_HqmiTqIrF` |
| Backend permissions | `CognitoUserPool` statement in the `backend-permissions` policy on `mostatelax-prod-ec2-role`, scoped to this pool |

Pool settings: email is the username (case-insensitive), invite-only (no self sign-up), min
password length 8 with no composition rules, no MFA, reset codes emailed from
`no-reply@missouristatelacrosse.com` through SES with a branded template, deletion protection
on, tokens live 60 minutes (id and access) and 30 days (refresh).

Warning: `aws cognito-idp update-user-pool` and `update-user-pool-client` reset every setting
they are not passed. Always repeat the full settings when changing one.

## Identity model (the fix for the UID drift bug)

Two ids, never confused:

- **uid**: an opaque id we own. Every table already stores it (users, profiles, players,
  parents, invites, payments) in the columns still named `firebase_uid` / `user_uid` /
  `paid_by_uid`. It does not depend on any auth provider and never changes. Existing accounts
  keep the uid they already have (all verified consistent against Firebase on 2026-09-19),
  and new accounts get a generated UUID. The Firebase-flavoured column names are historical.
- **cognito sub**: the provider's id, stored only in `users.cognito_sub`.

If a Cognito account is ever deleted and recreated, exactly one column changes. Nothing else
references the provider, so the "profile points at a deleted account" bug cannot recur.

All account creation goes through one class, `IdentityService`: find or create the account by
email, reuse an existing uid, create the Cognito user, set a password, change an email. The
three separate copies of that logic that existed before are gone.

Decision: `users` stays per program schema (the women's site may be removed).

## How sign-in works

1. The browser signs in to Cognito with email and password (password flow over TLS, not SRP,
   because the migration trigger only runs for it) and receives an ID token.
2. Every API call sends that token. `FirebaseAdminFilter` verifies it against the pool's JWKS
   (`CognitoTokenVerifier`), finds the account by `cognito_sub`, falling back to email on first
   sign-in and recording the sub, and hands controllers the account uid as before. Firebase
   tokens are still accepted until Firebase is retired.
3. `GET /api/users/me` returns the caller's account, including the uid the frontend needs.
   An identity with no account in the program gets a 401 and the UI signs out with a message.
4. Roles and program access stay in our database, never in Cognito claims.

## How existing users move over

Cognito cannot import Firebase password hashes. The migration Lambda runs the first time
someone signs in with an email Cognito has not seen: it asks Firebase whether the password is
right, and if so Cognito creates the user and stores the password. From then on that user
never touches Firebase. Forgot-password works the same way for Firebase-only users.

`firebase-users.json` (password hashes) is not needed and should be deleted.

## Onboarding and resets

- Invite links (`/set-password?inviteToken=...`) keep working and never expire. Consuming one
  calls `IdentityService.setPassword`, which sets a permanent Cognito password.
- Self-service "forgot password" and the Settings reset button use Cognito's emailed 6-digit
  code (valid one hour) on `/reset-password`. The backend `/api/onboard/forgot-password`
  endpoint was removed: a backend reset that invalidates a password would let anyone lock a
  player out, and reset links should stay short-lived.
- Changing a player's email in Manage moves the Cognito account to the new address.

## What changed in the code

Backend: `IdentityService`, `CognitoTokenVerifier`, `FirebaseAdminFilter` (either token type),
`/api/users/me`, migrations V38 (schema parity) and V39 (`users.cognito_sub` plus a unique
case-insensitive email index). Controllers are untouched.

Frontend: `Services/cognitoAuth.ts`, `AuthContext` (same `user.uid/email/displayName` shape, so
no page changed), `AuthModal`, `ResetPassword` (code flow), `SetPassword` (invite links only),
both Settings pages. The Firebase SDK is no longer bundled.

Tests: 10 verifier unit tests, 5 identity unit tests, and a 15-step end-to-end run against the
rehearsal database (onboard a new player, set a password from the invite, sign in, resolve
`/api/users/me`, permission checks, email change moves the Cognito account).

## Deploy order (matters)

The frontend and backend must change together. A new frontend against the old backend cannot
sign anyone in (no Cognito support, no `/api/users/me`).

1. New backend jar on the new box with `COGNITO_USER_POOL_ID=us-east-1_HqmiTqIrF` and
   `COGNITO_CLIENT_ID=30vmrujtptv5n4iqosjaclmvla` in the service environment.
2. Final database restore and DNS cutover to the new box (see the cutover notes).
3. Deploy the frontend.

Existing Firebase sessions keep working against the new backend until step 3. After step 3
everyone signs in again once, with the same password (Firebase-only users are migrated on that
first sign-in).

## Known behaviour changes

- Signing in on a program where a person has no account (for example a men's-only user opening
  the women's site) now says the account is not set up. It used to silently create a player
  role. Everyone onboarded through the site already has an account row.
- Passwords need 8 characters (Firebase allowed 6). A user migrated with a shorter password
  may be rejected on first sign-in and should use "Forgot password?". Watch for this.

## Retiring Firebase (after everyone has signed in, or a cutoff date)

1. Send a reset nudge to anyone who has not signed in through Cognito.
2. Remove the Firebase verifier and `FirebaseConfig`, the Firebase secret, and the migration
   Lambda and pool trigger.
3. Delete the Firebase project's users.
4. Later, optionally rename the historical `firebase_uid` columns.
