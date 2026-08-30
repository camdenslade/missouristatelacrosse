# Professionalization Scan — Findings Report

Read-only sweep of the repo (frontend `src/`, backend `backend/src/`, infra, docs)
done 2026-08-29, ahead of the graduation handoff. Scope is **code quality, consistency,
tooling, and maintainability** — not a security audit (that already happened; see
`docs/audit-findings.md`, 75 items closed, 5 open).

Priorities: **P0** blocks a clean handoff / fresh clone, **P1** real risk or friction,
**P2** consistency / hygiene, **P3** cosmetic.

## Progress (2026-08-29, staged not committed)

**P0 — all done.** Migrations V1-V5, `application.properties`,
`application-test.properties`, `package-lock.json`, `deploy-backend.sh`, `ssh.sh`,
`.firebaserc` now tracked. Root + backend `.gitignore` rewritten from clean templates.
`backend/scripts/seed_users.sql` stays ignored (PII); added sanitized
`seed_users.example.sql`. `firebaseConfig.ts` was already tracked.

**P1 — done:** #5 (firebase.json + WebConfig CORS now point at the EC2 backend; EB is
dead per owner, teardown added to cost list), #6 (DEBUG logging removed), #7
(`show-details=when-authorized`), #8 (multipart 1000MB -> 20MB), #9 (deleted duplicate
`SecretsConfig`; `MainApp.loadSecretsFromAWS` is the sole loader), #10 (removed 2
placebo `assertTrue(true)` tests + TODO to widen coverage), #11 (`bcole@example.com` ->
`printify.custom-order-notify` config key, default `17bacole@gmail.com`), #12 (store
receipt email name bug `first_name`->`firstName` fixed both programs).
Backend `./gradlew build` + frontend `vite build` green after all of it.

**P1 — remaining:** none (all addressed).

**P2 mechanical — done:** #13 (128 stale `// src/*.jsx` line-1 header comments stripped
repo-wide), #18 (`.nvmrc` = 20, `engines: node >=20 <23`), #20 (dead `cloudflare.*`
test props + `cloudflareInputUid` type field removed), #21 (`deploy-backend.sh` now
resolves the boot jar by glob, not a hardcoded name). #17 was already done in P0.

**P2 tooling batch — done:** #14 + #15 + #16 as one step —
- `typescript-eslint` added; `eslint.config.js` rewritten to lint `**/*.{ts,tsx,js,jsx}`
  with `tseslint.configs.recommended` + the existing react/hooks/import rules.
- `package.json` scripts: `lint`, `lint:fix`, `typecheck` (`tsc --noEmit`), `test`
  (`vitest run --passWithNoTests`); `build` now runs `tsc --noEmit && vite build`
  (`build:fast` is the un-gated escape hatch).
- `no-console` rule (allows `warn`/`error`); `@typescript-eslint/no-unused-vars` with
  `^_` ignore.
- All **15 pre-existing `tsc` errors fixed** (EmailCenter generics, ManagePlayers Role
  cast, Store `SetCartFn` widened, OrderLookup `string[]`, GalleryEdit cast, Schedule
  `?? undefined`).
- `eslint . --fix` run once: auto-fixed `prefer-const` + bulk `import/order` across
  ~15 files (import reordering only, no logic change).
- Remaining **3 lint errors fixed by hand**: `no-control-regex` in `validation.ts`
  (intentional — disabled with a note), and a real `react-hooks/rules-of-hooks`
  violation in `Payments.tsx` both programs (`availableSeasons` `useMemo` was after an
  early `return`; hoisted above it).
- Result: **`npm run lint` = 0 errors** (127 warnings remain — mostly `any`,
  `import/order`, `exhaustive-deps`; informational). `npm run typecheck` = clean.
  Frontend + backend builds green.

**P2 #22 orphans — done (2026-08-30):**
- dead `stream_config` table dropped via `V31__drop_dead_stream_config.sql` (verified:
  no `@Entity`, no code refs; per-game stream config lives in `game.data`)
- dead config removed from `application.properties`: `firebase.credentials` +
  `spring.cloud.gcp.firestore.enabled` (no `spring-cloud-gcp` dep consumes them;
  `FirebaseConfig` loads from Secrets Manager)
- Women `OrderLookup` was a **non-issue** - `App.tsx` already routes
  `/women/order-lookup` to the shared program-aware `OrderLookup` component
- Men-only Fundraiser left as-is (works; hard-codes a specific trip - low priority)

**Warnings cleanup (2026-08-30):** `npm run lint` went **130 -> 33 warnings**
(0 errors). Removed dead vars/imports, deleted unused `Global/Common/Spinner.tsx` and
`isGameLive`, converted breadcrumb `console.log`s to `console.error`/removed, fixed an
empty `else {}`. Turned `@typescript-eslint/no-explicit-any` **off** (63 warnings -
pervasive, low-value to chase). Remaining 33 are all `react-hooks/exhaustive-deps` -
kept as warn (standard; many are the intentional stable-ref pattern, unsafe to
auto-fix).

**P2 — remaining:** #19 (Men/Women mirror de-duplication) - its own effort.

**P3 + emoji/comment cleanup — done:**
- #23: `backend/HELP.md` (stock Spring Initializr file) deleted; real
  `backend/README.md` written (stack, local run, deploy, layout).
- #24: root `README.md` Tech Stack corrected (was "Firebase Storage / Firestore" on
  the frontend - storage is S3, frontend is React 19 + TS + Vite; backend list now
  names Postgres/Flyway/S3/streaming).
- **All emoji / decorative glyphs stripped repo-wide** (standing rule: none, ever):
  - true emoji removed (`AccountRequestService` log string; `ManageEvents` labels)
  - every comment divider removed - no `// --- Foo ---`, no box-drawing `──`, no
    `----`/`====` rules anywhere in `src/`, `backend/src/`, `nginx-rtmp.conf`
    (only the vendored `gradlew`/`gradlew.bat` `####` banners remain - Gradle's own)
  - `→` in comments -> `->`
  - UI glyphs migrated to `lucide-react` (already a dep): `✕` close buttons -> `<X>`;
    `▲▼▾▸▴` expand/sort carets -> `<ChevronUp/Down/Right>` in `Modal`, `Cart`,
    `MainContent`, `ManageEvents`, `LiveGameUI`, `PlayerRow` (Men + Women)
  - `✓ Copied` / `✓ Paid up` -> plain text
  - `docs/audit-findings.md` 38 status markers -> text tags
  - `•`/`••••` kept where it functionally masks secret values in the UI
  Verified: repo-wide sweep of all tracked text files is clean. `tsc` + `eslint` + both
  builds green.

**Scan status: closed.** Everything actionable in P0-P3 is done. Open items are the
three flagged large efforts (#19 mirror de-dup, #22 orphans, the lucide icon
migration) plus the separately-tracked workstreams (CI/CD, infra/cost, YouTube).

---

## P0 — a fresh clone cannot reproduce this project

### 1. DB migrations `V1`–`V5` are git-ignored and not tracked
`.gitignore` (root) explicitly lists `V1__init.sql` … `V5__normalize_player_defaults.sql`.
`git ls-files` shows only `V7`+ tracked. `V6` doesn't exist on disk at all (numbering
gap). A new maintainer who clones cannot build the database from scratch — Flyway would
start at `V7` against an empty schema and every migration fails.
**Fix:** remove those lines from `.gitignore`, `git add` V1–V5, confirm the V6 gap is
intentional (Flyway tolerates gaps, but document why).

### 2. `backend/src/main/resources/application.properties` is git-ignored
Not tracked. It contains **no secrets** — every value is `${ENV_VAR:default}`. It's
baked into the jar at build time, so today it only works because it exists on the one
machine that runs `deploy-backend.sh`. A fresh clone won't compile/run.
This also means the `stripe.*` lines just added for the Stripe rail are **not in
version control**.
**Fix:** either track the file as-is (preferred — no secrets in it) or commit
`application.properties.example` and have the deploy step copy it.

### 3. `package-lock.json` is git-ignored
No reproducible installs — `npm install` resolves fresh every time, so two people get
different dependency trees. Standard practice is to commit the lockfile.
**Fix:** remove from `.gitignore`, commit it.

### 4. Deploy/ops scripts are git-ignored
`.gitignore` lists `backend/deploy-backend.sh`, `backend/ssh.sh`,
`backend/scripts/seed_users.sql`, `src/Services/firebaseConfig.ts`, `.firebaserc`.
The person taking over inherits zero deploy tooling from the repo.
**Fix:** track the scripts (scrub any host/key specifics into env vars). `.firebaserc`
has no secrets — track it. `firebaseConfig.ts` holds only the public Firebase web
config — track it (it's already shipped in the client bundle).

---

## P1 — real risk or friction

### 5. Two backends? `firebase.json` and the app disagree on the API host
- `firebase.json` rewrites `/api/**` → `https://laxsite-backend-env.eba-…elasticbeanstalk.com/api`
- `apiClient.ts` calls `import.meta.env.VITE_API_BASE` = `https://api.missouristatelacrosse.com` (the EC2 box)

The app builds **absolute** URLs, so the `firebase.json` rewrite is dead code and the
Elastic Beanstalk environment is either unused or a second live deployment. An idle EB
env (+ its load balancer + the ACM cert behind the `_89aa5633….api` DNS record) is a
recurring AWS charge. **Resolve which backend is real**, delete the other, drop the
stale rewrite. (Feeds the cost-cut work.)

### 6. Prod logging leaks request bodies
`application.properties`:
```
logging.level.org.springframework.web.client.RestTemplate=DEBUG
logging.level.org.springframework.http.converter.json=DEBUG
```
DEBUG on `RestTemplate` logs full outbound request/response bodies — that includes the
PayPal OAuth calls and order payloads. **Fix:** drop both lines (or set `INFO`/`WARN`).

### 7. `management.endpoint.health.show-details=always`
`/actuator/health` is exposed and returns component details (DB, disk, etc.) to
unauthenticated callers. `management.endpoints.web.exposure.include=health` limits it to
health only, which is good, but `show-details` should be `when-authorized` or
`never` in prod.

### 8. `spring.servlet.multipart.max-file-size=1000MB`
A 1 GB per-file upload ceiling on a small EC2 box is a trivial memory-exhaustion DoS.
`max-request-size` is 25MB, which partly contains it, but the file size should come
down to something realistic (e.g. 15–20MB for images; the compression helper already
shrinks client-side).

### 9. Duplicate AWS Secrets Manager loaders
`MainApp.loadSecretsFromAWS()` (runs in `main()`) and
`Config/SecretsConfig.java` (`@PostConstruct`, `@Profile("!test")`) both fetch the
`backend-prod` secret and `System.setProperty(...)` the same keys. They've already
drifted (only `MainApp` had the Stripe keys until this pass). **Fix:** delete one —
keep `SecretsConfig` (Spring-managed, testable) or keep `MainApp` (runs before the
context, so `@Value` always sees the props). Pick one, delete the other.

### 10. `SecurityRegressionTest` has placebo assertions
`assertTrue(true, "verified by design")` in `testOrderLogsResponse_DoesNotContainApiTokens`
and `testOrderLogsEndpoint_NoWriteOperations`. They pass unconditionally and test
nothing. Coverage is also narrow — only the order-logs endpoint, nothing on the payment
or auth surface. **Fix:** make them real or delete them; add real coverage for the
`FirebaseAdminFilter` prefix matrix.

### 11. `bcole@example.com` hard-coded in `PrintifyController`
Custom-order notification email recipient is a literal in code (line ~228). Move to
config; the `example.com` suggests it was never a real address.

### 12. Store checkout email name bug (pre-existing)
`useStore.ts` (both programs) reads `shipping?.first_name` / `shipping?.last_name`, but
`Checkout.tsx` builds the object with `firstName` / `lastName`. Every store receipt
email greets the customer as `" "` (empty). Preserved as-is during the Stripe swap to
keep that change payments-only. One-line fix.

---

## P2 — consistency & hygiene

### 13. Stale per-file path header comments — 122 files
122 of ~206 `.ts`/`.tsx` files start with a comment like `// src/App.jsx` left over from
the JS→TS migration. Many are now **wrong**:
- `ProtectedRoutes.tsx` → `// src/Global/Authentication/ProtectedRoute.jsx`
- `RequestAccessForm.tsx` → `…/Authentcation/…` (typo)
- `RosterRedirect.tsx` → `// src/Global/ScheduleRedirect.jsx` (and `ScheduleRedirect.tsx` → `RosterRedirect.jsx` — swapped)
- `Donate.tsx` → `// src/Men/Pages/Donate/Donate.jsx` (missing `/Local`)
- every one still says `.jsx`/`.js`

**Fix:** delete them all (a filename comment atop the file it names is pure noise) with
one codemod. This is also step 1 of the emoji/comment cleanup.

### 14. ESLint doesn't lint the codebase
`eslint.config.js` `files: ["**/*.js", "**/*.jsx"]` — the project is 154 `.tsx` + 52
`.ts` files and **4** `.js` files. No `typescript-eslint` parser configured. So lint is
effectively off. There is also no `lint`, `typecheck`, or `test` script in
`package.json` (only `dev`/`build`/`preview`), and `build` is `vite build` alone — no
`tsc` gate, so type errors ship.
**Fix:** add `typescript-eslint`, lint `.ts/.tsx`, add `"typecheck": "tsc --noEmit"`
and `"lint": "eslint ."` scripts.

### 15. Pre-existing TypeScript errors ship
`tsc --noEmit` reports ~15 errors today (EmailCenter `unknown`→`Group[]`,
ManagePlayers `Role`, Store `CartSetter`, OrderLookup `never`, Schedule `Player[]`,
GalleryEdit `string[]`). None block `vite build`. Fix them, then add the `tsc` gate
(#14) so they can't come back.

### 16. `no-unused-vars: "warn"` + 121 `console.*` calls + 49 `any`
Frontend has 121 `console.*` (12 are `console.log`), 49 `: any` / `as any`. Backend has
53 `printStackTrace` / `System.out.println` (should be SLF4J), 2 `catch (Exception
ignored) {}`. Not urgent individually; a lint gate (#14) plus a `no-console` rule
(allowing `warn`/`error`) would stop the bleed.

### 17. `.gitignore` is malformed / redundant
Root `.gitignore` has entries like `/Official Missouri State Lacrosse Site/*.iml` and
`/Official Missouri State Lacrosse Site/out/` — the repo folder name pasted as if it
were a subdirectory; these match nothing. `Thumbs.db`, `.DS_Store`, `*.log`, firebase
debug patterns are each listed 2–3×. Backend `.gitignore` ignores
`application-*.properties` which also hides `application-test.properties` intent.
**Fix:** rewrite from a standard Node + Java template.

### 18. Node version unpinned
No `.nvmrc` / `.node-version` / `engines`. Backend pins Java 17 via Gradle; frontend
pins nothing. Add `.nvmrc` (e.g. `20`) and `"engines": { "node": ">=20" }`.

### 19. Men/Women mirror duplication
`src/Men/Local/**` and `src/Women/Local/**` are hand-kept copies. `docs/audit-findings.md`
item at line 283 already flags `useStore.ts` as fully duplicated; the Stripe pass had
to edit ~9 pairs of files identically. Real drift exists (Women `useStore` navigated to
a 404 route until recently; Women `Checkout` had a different `SetCartFn` type). Longer
term: factor the page bodies into shared components parameterized by `program`, leaving
each side a thin wrapper. Large effort — flag, don't attempt piecemeal.

### 20. Dead Cloudflare Stream scaffolding
`backend/src/test/resources/application-test.properties` has
`cloudflare.account-id` / `cloudflare.api-token` / `cloudflare.stream-signing-key`;
`src/types/api.ts` has an unused `cloudflareInputUid` field. Nothing in
`backend/src/main` reads any of it (streaming is self-hosted nginx-rtmp). The
Cloudflare Stream/R2/Images products are being cancelled. **Fix:** delete the three
test props and the `cloudflareInputUid` field.

### 21. `deploy-backend.sh` jar name is a coincidence, not a contract
Script hard-codes `build/libs/laxsite-backend-0.0.1-SNAPSHOT.jar`; `bootJar` also emits
`…-plain.jar`. Works today because `settings.gradle` `rootProject.name` and `version`
line up. If either changes the deploy silently uploads a stale jar. Use a glob or a
Gradle-emitted path.

### 22. Other orphans (from `docs/audit-findings.md`, still open)
- `stream_config` table (`V16`/`V17`) — no `@Entity`, no code references.
- Fundraiser feature is Men-only, hard-codes a specific trip/date in component source.
- `OrderLookup.tsx` has no Women's version (Women's `/order-lookup` route 404s or
  cross-renders).

---

## P3 — cosmetic

### 23. `backend/HELP.md` is the stock Spring Initializr file
Contains a `📊` and generic getting-started links. Replace with a real backend README
or delete.

### 24. README drift
`docs/audit-findings.md` opening still frames the site as "about to launch." README
"Features" claims things at aspirational polish. Low priority; the handoff doc (#future)
supersedes it.

---

## Comment-style catalog (as requested)

The repo has **no single convention**. What's in use:

| Style | Where | Keep? |
|---|---|---|
| `// src/Path/File.jsx` header on line 1 | 122 `.ts/.tsx` files (see #13) | **Delete all** — noise, often wrong |
| Javadoc `/** … */` on classes/methods | ~22 backend files (`FirebaseAdminFilter`, `PaymentReceiptService`, `StripeService`, …) | **Yes — make this the backend standard** |
| Box-drawing section banners `// ── Foo ──────` | `FirebaseAdminFilter.java`, `StreamController.java`, `CustomProductController.java`, `KeyGate.tsx`, `nginx-rtmp.conf`, `docs/payments.md` | Strip entirely - plain `// Foo`, no dashes or rules (see also the standing rule: no decorative comment dividers anywhere) |
| Bare section labels `// State` `// Helpers` `// Component` `// Render states` | `RaffleDetail.tsx`, `EventDetail.tsx` (Men+Women) | Fine; harmless |
| Inline rationale / "why" comments (multi-line, explain a non-obvious decision) | payment code, `useGames.ts`, `PaymentReceiptService`, `useStore` | **Yes — this is the codebase's best pattern; model new comments on these** |
| `{/* JSX comment */}` for layout sections | scattered `.tsx` | Fine |
| JSDoc `/** */` in frontend | only ~10 `.ts/.tsx` files | Standardize: JSDoc on exported hooks/utils, `//` inline elsewhere |
| `// TODO` / `// FIXME` | 1 in frontend, 0 real in backend (`TODO` only in strings) | n/a |

**Proposed standard** (for the cleanup PR):
- Line 1 file-path comments: removed everywhere.
- Backend: Javadoc `/** */` on every public class and non-trivial public method;
  `//` for inline rationale.
- Frontend: JSDoc `/** */` on exported hooks/components/utils; `//` inline; no
  decorative ASCII.
- Keep writing the "why" comments — they're good.

---

## Emoji / glyph inventory (as requested)

Splitting "emoji" from "symbols used as UI or decoration", because they need different
handling.

### True emoji — 3 spots in shipping code
| File | Glyph | Context |
|---|---|---|
| `backend/.../Service/AccountRequestService.java:83` | `❌` | inside a log/message string |
| `src/Men/Local/Admin/Tabs/ManageEvents.tsx` | 1× | JSX text |
| `src/Women/Local/Admin/Tabs/ManageEvents.tsx` | 1× | JSX text (mirror) |

Plus non-shipping: `backend/HELP.md` (`📊`, stock file — see #23) and
`docs/audit-findings.md` (**38** status markers `✅ 🔴 🟡 🟢 ⚠️`).

**Recommendation:** remove the 3 code spots outright. For `audit-findings.md`, swap the
status emoji for text tags (`[DONE] [CRIT] [MED] [LOW]`) — it's an internal doc so it's
optional, but it's the bulk of the count.

### Decorative rule/box-drawing chars in comments — stripped everywhere (standing rule: none, ever)
`nginx-rtmp.conf`, `KeyGate.tsx`, `FirebaseAdminFilter.java`,
`Controller/Admin/CustomProductController.java`, `StreamController.java`,
`docs/payments.md` (added this session — will fix). Not emoji; strip as part of the
comment-style pass (#comment-catalog).

### UI icon glyphs — NOT emoji, leave for a separate design pass
`✕` (close), `✓` (check), `▶ ▲ ▼ ▴ ▾ ▸ ◀ ← ↗` (arrows/carets) used as inline icons in
~10 components: `Modal.tsx`, `Cart.tsx`, `MainContent.tsx`, `ManageEvents.tsx`,
`StreamSetup.tsx`, `PlayerRow.tsx`, `LiveGameUI.tsx`, `EmailCenter.tsx`,
`PlayerPaymentDetails.tsx`. These are functional. `lucide-react` is **already a
dependency** — migrating these to `<X/>`, `<Check/>`, `<ChevronDown/>` etc. is the
clean move, but it's a UI change, not "emoji stripping." Track separately.

### Net answer to "strip all emojis"
- **Now, safe:** 3 code spots + the 6 box-drawing comment files.
- **Optional:** 38 status markers in `audit-findings.md` → text tags.
- **Separate task:** ~10 components using `✕/✓/▶`-type glyphs as icons → `lucide-react`.

---

## Suggested execution order

1. **P0 batch** (one PR): un-ignore V1–V5 + `application.properties` +
   `package-lock.json` + deploy scripts + `.firebaserc` + `firebaseConfig.ts`; rewrite
   `.gitignore`. Nothing behavioral — just makes the repo real.
2. **Tooling PR:** `typescript-eslint`, `lint`/`typecheck`/`test` scripts, `.nvmrc`,
   fix the ~15 `tsc` errors, then wire the gates into CI (feeds the CI/CD workstream).
3. **Cleanup PR:** delete 122 path-header comments, 3 emoji, 6 box-drawing banners,
   dead Cloudflare props/field, `HELP.md`; adopt the comment standard.
4. **P1 items** individually (logging, actuator, multipart, dup secret loader, real
   security tests, the EB-vs-EC2 decision).
5. **Modularization / mirror de-duplication** — its own planned effort.
