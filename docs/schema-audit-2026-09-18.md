# Schema audit, 2026-09-18

Read-only audit of the production `lacrosse` database (schemas `men` and `women`, Flyway
V1 to V37), run ahead of the database move to the new AWS account and the auth move to
Cognito. Nothing was changed in production. The proposed fix is in
`docs/proposed/V38__schema_parity_fixes.sql`.

## Summary

- The database is small and structurally healthy. About 500 real rows. Flyway history is
  clean: 37 applied, 0 failed, no gaps. Every table has a primary key. Nothing lives in
  `public`.
- Three real bugs where `women` is behind `men`. Same root cause as V26 and V34: earlier
  migrations only reached `men`. A database built fresh from the migrations reproduces all
  three, so this is not just production data.
- The identity model is the bigger issue. A Firebase UID is copied into at least 11 places
  with almost no foreign keys between them. That design produced the Jackson Hocker and Jed
  Holliday incident, and dead-UID residue from it is still in the tables.
- One thing could not be verified from the database alone: whether every stored UID still
  exists in Firebase. See "Not verified".

## Where the data is

| Table | men | women |
|---|---|---|
| players | 83 | 13 |
| player_profiles | 34 | 1 |
| users | 41 | 2 |
| payment_receipts | 136 (127 paypal, 9 stripe) | 0 |
| dues_payments | 11 | 0 |
| invite_tokens | 58 | 0 |
| games | 50 | 11 |
| todo_status / todos | 46 / 4 | 0 / 0 |

Women is nearly empty, so its drift has not hurt anyone yet. It would the first time a
women's payment, Printify order, or event delete happens.

## Findings

### High

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | `women.payment_receipts` has no `provider` column. It is `NOT NULL DEFAULT 'paypal'` in men and the entity reads it. | V30 only reached men | V38 adds it |
| 2 | `women.printify_order_logs` has no `printify_order_id` column. | Same cause | V38 adds it |

Either one makes the first women's receipt or Printify log fail with a missing-column error.

### Medium

| # | Finding | Fix |
|---|---|---|
| 3 | `women` is missing three `ON DELETE CASCADE` foreign keys men has: `event_registrations`, `event_teams`, `raffle_entries`. Deleting a women's event or raffle would orphan its children. | V38 adds them (all three tables are empty) |
| 4 | Four foreign keys were added `NOT VALID`, so existing rows were never checked: `dues_payments.player_id` and `players.profile_id`, in both schemas. The orphan checks found zero violations. | V38 validates them |
| 5 | `women.stream_config` is a leftover. V31 dropped it from men only. Empty. | V38 drops it |
| 6 | Identity is stored in too many places (see next section), and `users` has no foreign keys at all. | Redesign, below |

### Low

| # | Finding | Note |
|---|---|---|
| 7 | No unique index on `lower(users.email)`. Zero duplicates today. | Add before Cognito, which uses email as the username |
| 8 | Dead-UID residue, listed below. | Clean up before the move |
| 9 | 39 men's players (seasons 23-24 through 25-26) have no profile, no email, no UID. | Historical roster only, not corruption. They are identifiable by name alone |
| 10 | Naming drift: `users.player_id` actually holds a profile id. The `todo_status` unique index is still called `payment_card_status_card_id_player_id_key`. The foreign key names differ between schemas (`fk_men_...` vs `fk_women_...`). | Cosmetic |

### Root cause of 1 to 5

Flyway keeps its history table only in `men` (`men.flyway_schema_history`). `women` is kept in
sync by hand, by writing `women.`-qualified statements next to the `men.` ones. Any
migration that forgets is silently wrong for women. The lint script that would have caught
this was drafted earlier but never reached `main`. Recommendation: land it, and write future
migrations that touch both schemas as a single `DO` loop over `('men','women')`.

## The identity spine

A Firebase UID currently appears in these places, per schema:

| Column | Constraint |
|---|---|
| `users.firebase_uid` | unique |
| `player_profiles.firebase_uid` | unique (non-empty) |
| `players.user_uid` | none, and one per season row |
| `invite_tokens.firebase_uid` | none |
| `dues_payments.paid_by_uid` | none |
| `todo_status.marked_by_uid` | none |
| `account_requests.uid` | none |
| `parents.id` | it is the primary key |
| `groups.created_by`, `groups.members` (jsonb) | none |
| `players.parents`, `player_profiles.parents` (jsonb) | none |

`users` is per schema, so a person in both programs has two unrelated `users` rows. The
only place they are the same person is Firebase.

### Dead-UID residue found

| What | Detail |
|---|---|
| Unused invite tokens for UIDs with no `users` row | 21 of 58. 10 belong to Jackson Hocker's old UID (under his Gmail and school address), 5 to Jed Holliday's old UID (Gmail and school address), 6 to test accounts |
| Unused tokens older than 14 days | 15 of the 38 unused |
| Profiles whose UID has no `users` row | 3: Cole Bourg and two Camden Slade profiles (test data) |
| `parents` row with no `users` row | 1: the deleted `csladedev@outlook.com` account |
| Dues payment by a UID with no `users` row | 1: the $1.00 test payment from 2026-07-31 |

The two players fixed on 2026-09-16 are consistent now. Their older tokens still point at
the dead UIDs. They are harmless but should go.

## Not verified

Whether every stored UID exists in live Firebase Auth. The database cannot answer that.
This is the check that would have caught the Jackson and Jed problem before anyone
complained. It needs a Firebase Auth export, which we need anyway for the Cognito password
hash import. Compare the export against every UID in the table above and list the ones
that are missing.

## Before the migration

1. Restore the old dump into the new database with `pg_restore --clean --if-exists`, so
   `flyway_schema_history` comes along. Deploy the jar with V38 included and Flyway applies
   it at boot.
2. Clean up dead tokens before the dump, or right after the restore:

   ```sql
   DELETE FROM men.invite_tokens t
   WHERE t.used_at IS NULL
     AND (NOT EXISTS (SELECT 1 FROM men.users u WHERE u.firebase_uid = t.firebase_uid)
          OR t.created_at < now() - interval '14 days');
   ```
3. Decide what to do with the test accounts (Camden Slade x2, Cole Bourg, the
   `csladedev` parent row and its $1 payment).
4. Run the Firebase reconciliation above.
5. After 3 and 4, add `CREATE UNIQUE INDEX ... ON users (lower(email))` in each schema.

## Proposed identity model (for discussion)

This is a sketch for tomorrow, not a decision.

- `users` becomes the only owner of an external identity. Add `auth_provider`
  (`firebase` or `cognito`) and `external_id`, unique together, replacing `firebase_uid`.
  Unique on `lower(email)`.
- Everything else points at `users.id`, an internal UUID that never changes when the auth
  provider does: `player_profiles.user_id`, `invite_tokens.user_id`,
  `dues_payments.paid_by_user_id`, `todo_status.marked_by_user_id`, `parents.user_id`,
  `groups`. Drop `players.user_uid`; it derives from profile to user.
- Real foreign keys on all of those, plus a unique index on `(profile_id, season)` in
  `players`.
- Migration order: add the new columns nullable, backfill from the existing UIDs, switch
  the code to read the new columns, verify, then drop the old ones. That lines up with the
  Cognito plan of running both providers until the new one is proven.

Open question that shapes everything else: keep `users` per program schema, or move it to
one shared table with a per-program roles table. One shared table matches Cognito (one user
pool, one identity per person) and removes the duplicate-`users` problem. It is also the
larger change.

## Second pass: bad and legacy rows and columns (pre-RDS)

Column fill rates for all 583 columns, code cross-reference for every table and column,
and row-level checks. Read-only.

### Must fix before the move

| # | Finding | Impact | Fix |
|---|---|---|---|
| A | Full S3 URLs (old bucket host, many with expired presigned signatures) are stored in `games.away_logo` (50 men, 11 women), `players.photo_url` (40 and 10), `teams.logo_url` (34 and 9), `raffles.image` (14), `coaches.photo_url` (4), `events.image` (4), plus jsonb `raffles.images` (13) and `gallery_folders.urls` (2 men, 6 women). `S3Service.extractKey` only matches the configured bucket's host. | After the bucket rename these images silently stop loading. | Rewrite to bare keys, and copy the objects to the new bucket. `docs/proposed/V39__normalize_stored_urls_and_backfill.sql` does the text columns. The jsonb ones need a per-element rewrite. |
| B | The 587 objects (6.9 GB) live in `mostatelacrosse-general-images` in the old account. | Bucket names are global, so the new account needs a new name and a sync. | `aws s3 sync` between accounts, then the V39 rewrite. |

### Clean up (safe, not blocking)

| # | Finding | Action |
|---|---|---|
| C | `printify_order_logs.printify_order_id` is empty on all 7 rows, but the id is in `response_payload`. | Backfill (in V39). |
| D | Mixed-case emails: 3 users, 2 profiles, 7 players, 7 invite tokens (Nelson Barger, Carson Dahl, Jackson Hocker, Zack Poelsterl). Code compares case-insensitively in the places I checked, but Cognito treats email as the username. | Lowercase them before the unique index on `lower(email)`. Not in V39 yet because the rows also key invite tokens. |
| E | Duplicate profile: Cole Bourg twice, same email, both with a UID. | Test data. Delete both with the residue from the first section, unless you want one kept. |
| F | 2 profiles with no email and no UID (Coleton Merkel, Nik Schneider). | Roster-only players. Fine, but they cannot log in. |
| G | 9 payment receipts stuck in `CREATED` (6 PayPal 2026-07-31 to 08-07, 3 Stripe 09-01 to 09-02). | Abandoned checkouts. Keep for the record or delete, your call. Note 3 Stripe rows in `CREATED` is worth one look that Stripe webhooks are reaching the server. |
| H | `stream_keys` has 19 rows, all created 2026-02-27, 2 ever activated. `chat_messages` 126 rows from the same test period. | Test data from the streaming build. Safe to purge. |
| I | Columns with no non-default data at all: `alumni_budget.display_order`, `seasons.sort_order` (all 0, so ordering is by code), `fundraisers.description/image/expenses`, `groups.created_by`, `raffle_entries.bid_amount`, `raffles.max_tickets_per_person`. | Not legacy. Features that are wired up but unused. Leave. |
| J | `stream_config` (women only) has no code reference. | Drop (in V38). |

### Checked and clean

- No duplicate players per season. No orphan `profile_id`. All `games.season` values exist in
  `seasons` (join on `code`, not `label`).
- No dead entities: every other table has an entity or query in the backend. `custom_product`
  and `custom_product_variant` look unreferenced by name but are used by `CustomProduct` and
  `CustomProductVariant`, and are empty.
- Roles and programs on `users` are consistent (7 admin, 1 admin on both, 7 alumni, 16 player,
  10 parent, all with a matching `programs` entry).
- 15 players have a non-zero `balance`. That is live data, not legacy.

## Firebase reconciliation (2026-09-19)

Compared the 44 accounts from `firebase auth:export` against every UID stored in the men
and women schemas (users, profiles, players, unused invite tokens, parents, dues payers).
47 distinct UIDs in the database, 44 in Firebase.

Stored UIDs that do not exist in Firebase:

| Where | Who | Meaning |
|---|---|---|
| `users` | Chris Callaham (alumni, callahamc17@gmail.com) | No Firebase account for this email. Cannot log in. |
| `users` | Sam Siebert (alumni, samsiebert66@gmail.com) | Same. |
| unused invite tokens | Jackson Hocker, Jed Holliday | Known dead UIDs from the 2026-09-16 incident. Their live accounts are correct. |
| unused invite tokens | Cole Bourg (colebourg08@yahoo.com) | Test residue. |
| `player_profiles` | Cole Bourg | One of the two duplicate profiles points at a dead UID. The live UID `SkSUa6jp` belongs to the other. |
| `player_profiles` | Camden Slade (camdenslade04@gmail.com) | Test profile. |

Firebase accounts that appear nowhere in the database (no user, profile, player, invite,
parent, or recruitment row for the email): rschild1@yahoo.com, coljen22@gmail.com,
babers42@yahoo.com. Likely store customers or parents who signed up and never got a row.
They are not a bug but will be imported into Cognito unless excluded.

Every other stored UID (all other users, profiles, players, parents, dues payers) matches a
live Firebase account. The Jackson and Jed class of bug is not present anywhere else.

Action: Callaham and Siebert need a fresh onboarding (resend link from Manage Players
creates the account and repairs the UID under the current `setFirebaseUid` logic).
