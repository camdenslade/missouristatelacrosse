# Codebase Audit — Requirements & Findings

Living doc tracking the security/dues-payment hardening pass and the broader codebase
audit requested afterward. Written so work survives a context reset. Update checkboxes
as items are completed; append new findings under the relevant section rather than
reorganizing.

Last updated: see git blame. Session context: dues-payment flow review escalated into a
full security lockdown after discovering several unauthenticated endpoints, then into a
"crawl the whole codebase" audit for dead code / drift / warnings.

> **[!] To any future agent/session picking this up**: treat this document — and the work
> still open in it — as a **final pre-launch security/correctness review**. This site is
> about to be launched publicly by a real company and will collect real payments (dues,
> donations, raffles, event/store checkout) from real people. Anything left unresolved
> here (especially in the auth-lockdown and money-integrity sections) is a real exposure
> once that happens, not hypothetical. Err on the side of thoroughness over speed, and
> don't assume something is "probably fine" just because it hasn't been reported abused
> yet — nothing has been launched publicly yet, so absence of incidents means nothing.

---

## [DONE] — dues payment flow (parent/player pays dues)

- [x] `POST /api/dues-payments` and `GET /api/dues-payments` now require auth (admin, the
      player themself, or a linked parent). Was fully open before.
- [x] `PAYMENT`-type dues entries require a real, verified PayPal capture: matched by
      `payPalOrderId` against `PaymentReceipt` (status `COMPLETED`, exact amount match).
- [x] Idempotency: `dues_payments.paypal_order_id` is unique-indexed; replaying an
      already-consumed capture returns the existing result instead of double-crediting.
- [x] `source` is now bound server-side at PayPal **order-creation** time
      (`PaymentReceiptService.reserveSource`), not capture time — closes the hole where a
      donation/raffle/event capture could be replayed as a "dues payment" by self-tagging
      `source=dues` at capture. `usePayPalButtons.ts` sends `source` in `createOrder`, no
      longer in the capture call. `Payments.tsx` (Men+Women) tags dues payments `"dues"`.
- [x] `CHARGE`/`CREDIT`/`ADJUSTMENT` types remain admin-only (manual ledger entries, no
      PayPal proof required/expected).
- [x] Parent-player links are now season-independent: `PlayerProfile.parents` (new JSONB
      column, migration `V25`) is the source of truth, mirrored from/to `Player.parents`
      for backward compat. New season roster rows auto-resolve their `profileId` via email
      or name+highschool merge-key (`PlayersController.applyPayload`), so parents/payment
      history carry forward without manual re-linking. `ParentAccount.linkedPlayers` now
      stores `profileId` (falls back to raw player id for legacy rows) —
      `PlayersController.get()` already resolved profile-id lookups to "this season's row,"
      so this required no frontend changes.
- [x] Roster admin "Add Player" form (`RosterForm.tsx`, both programs) now surfaces the
      existing `/api/players/search-candidates` fuzzy-match and, on a match, explicitly
      carries the matched `profileId` through to the new row (belt-and-suspenders on top of
      the automatic merge-key resolution above).
- [x] Verbose receipts:
  - Customer: branded HTML email receipt sent after every successful `PAYMENT`
    (`DuesPaymentController.sendReceiptEmail` — player, date, PayPal order id, amount,
    remaining balance). Best-effort; a failed send never blocks/rolls back the payment.
  - Admin: `PlayerPaymentDetails.tsx` (Men+Women) ledger table now shows a running
    "Balance After" column (computed client-side from current balance + ledger order) and,
    for admins, a PayPal Order ID column.
- [x] Extracted duplicated admin-role-check logic into `Service/AuthorizationService`
      (was copy-pasted in `PrintifyOrderLogService`); `PrintifyOrderLogService.isAdmin` now
      delegates to it.
- [x] Extracted duplicated "is uid a linked parent of this player" check into
      `PlayerProfileService.isLinkedParent` (was about to become a 3rd copy-paste between
      `DuesPaymentController` and `PlayersController`).

## [DONE] — critical auth lockdown (found mid-audit, fixed same session)

Four controllers had **zero auth** and were confirmed reachable from the live frontend:

- [x] `UsersController` — `PUT /api/users/{uid}` let ANY caller self-assign `"admin"` role
      (full site takeover) and `DELETE` let anyone delete any account. Fixed: self-or-admin
      for read/write; self can never set role value `"admin"` (only an existing admin can
      promote); list/by-email/by-player/delete are admin-only.
- [x] `PlayersController` — `PUT /api/players/{id}` let anyone directly rewrite any
      player's `balance`, bypassing all the dues-payment hardening above. `GET` leaked
      every player's email/balance/parent-contact/userUid to anyone, including on the
      public roster page's own API call. Fixed: public GETs stay open (roster is meant to
      be public) but strip email/balance/parents/userUid/profileId unless caller is admin,
      self, or a linked parent; POST/PUT/DELETE are admin-only, with one narrow carve-out
      for the existing self-claim flow (`AuthContext.tsx`'s `tryAutoLinkPlayer`, which sets
      only `userUid` on an unclaimed row).
- [x] `ParentsController` — fully open; now requires any authenticated user.
- [x] `GroupsController` — fully open (mailing-list groups incl. member emails); now
      admin-only for all methods. Confirmed its only non-admin frontend caller
      (`addParentToGroup.ts`) is dead/unwired code.
- [x] `FirebaseAdminFilter` restructured with two new categories to support this without
      breaking the public roster or self-service flows: `AUTH_REQUIRED_WRITE_PREFIXES`
      (token required only for write methods, no admin claim) and `OPTIONAL_AUTH_PREFIXES`
      (verifies a token if present, never rejects — lets `PlayersController` tailor GET
      responses for logged-in callers without blocking anonymous roster browsing).

**Note on scope**: `ParentsController`'s fix is coarse (any authenticated user, not
fine-grained ownership) — acceptable given low blast radius (doesn't grant payment
authority; that's separately guarded by `DuesPaymentController`/`PlayersController`
checking actual profile/player parent links, not `ParentAccount.linkedPlayers`). Revisit
if this needs tightening later.

**Known residual gap** (flagged, not fixed — needs its own scoping): PayPal `source` is
still trusted from the client at order-creation time with no cryptographic binding to what
was actually purchased. A determined user could still create/capture an order for one
thing while tagging it as another. Low severity now that dues-specific replay is closed,
but the general pattern is worth a proper fix if other `source`-gated flows are added.

## [DONE] — second wave: 13 MORE fully-open controllers (found by a targeted follow-up audit)

After the first four (Users/Players/Parents/Groups), the user asked "is that all the
issues?" — a follow-up audit of every *other* controller found this was **broader and as
severe** as the first wave. All fixed same session, same `AuthorizationService.isAdmin`
pattern, plus two new `FirebaseAdminFilter` categories (`AUTH_REQUIRED_WRITE_PREFIXES` for
simple public-read/admin-write resources; reused `OPTIONAL_AUTH_PREFIXES` for resources
mixing public and admin traffic on the same base path/method). See the filter's class
Javadoc for the full decision table.

- [x] **`AccountRequestController` — most severe finding of the whole session.**
      `POST /{id}/approve?role=admin` had **zero auth**. Since the account-request `role`
      query param was added earlier this session for the admin role-picker UI, this meant
      literally anyone could submit a self-service account request and then immediately
      call the approve endpoint themselves with `role=admin` — full site takeover, no
      login even required beyond submitting the public request form. Fixed: `POST`
      (create) stays public (that's the point of the form), `GET`/`DELETE`/`POST .../approve`
      now admin-only.
- [x] **`RaffleController`** — all admin actions (create/update/delete/draw winner/close/
      reopen/stream setup/**`admin-entry` which adds a `paid=true` ticket with no
      payment**) were fully open — direct fraud vector. Also hardened `/enter` (the real
      public entry flow) the same way dues payments were hardened: verifies the PayPal
      receipt is `COMPLETED`, amount matches the computed ticket/bid price, and the
      `paypalOrderId` hasn't already been used for another entry (was previously only
      checking "does a receipt with this order id exist at all," no amount/status check).
- [x] **`EventsController`** — admin CRUD, registration list (PII), and the team-management
      endpoints (`/admin/teams/backfill`, `/teams/pair`, `/teams/{id}/remind` — note:
      `/admin/` in the path did NOT mean admin-gated, it's just a URL segment) were all
      open. Also hardened `/register`'s payment check the same way as raffles (status +
      amount + idempotency, not just "a receipt exists").
- [x] **`FundraisersController`**, **`AlumniBudgetController`** — admin CRUD (+ CSV import
      for budget) was open; financial/campaign data. Reads stay public (transparency).
- [x] **`ArticlesController`, `SiteContentController`, `GamesController`,
      `SponsorsController`, `CoachesController`, `TeamsController`, `GalleryController`** —
      all had fully open admin writes (create/update/delete/publish articles, rewrite site
      content by key, edit game scores, sponsors, coaches, teams, delete gallery
      photos/folders incl. triggering real S3 deletes). Reads stay public (all public-
      facing content). Straightforward `AUTH_REQUIRED_WRITE_PREFIXES` gating.
- [x] **`EmailController`** — `/group` (arbitrary recipients/subject/body — the actual
      spam-relay risk) is now admin-only. `/donation` and `/account-approved` were **not
      called by any frontend code** (confirmed via full-project grep) but were live,
      unauthenticated endpoints that would send officially-branded email with
      attacker-controlled content/links to any address — `/account-approved`'s
      client-supplied `link` field is a direct phishing vector. Gated both admin-only
      (zero behavior change for real users since nothing calls them). `/sponsor` and
      `/receipt` stay public (legitimate self-service: contact form, post-checkout
      receipt) — residual minor spam-relay risk noted below, not fixed.
- [x] **`RecruitmentController`** — `GET` (prospect PII: email/phone/hometown/etc) and
      `DELETE` were open; `POST` (the recruitment form) correctly stays public.
- [x] **`UploadController`** — `POST /presign` (mints a presigned S3 upload URL) had no
      auth; every real caller is an admin tool (confirmed via grep, 21 call sites, all
      admin forms) so gating it is zero-risk. `GET /object` stays public (image serving).

**Residual, not fixed (flagging, low severity):**
- `POST /api/email/sponsor` and `/api/email/receipt` remain open by necessity (genuine
  public self-service use) but let a caller supply an arbitrary destination email —
  `/receipt` in particular accepts a client-supplied `body` string, meaning anyone can use
  it to send arbitrary-content, officially-branded email to any address with no purchase
  verification. A proper fix means verifying `/receipt` against a real order server-side
  (same pattern as the dues/raffle/event hardening above) instead of trusting the client's
  claim that a purchase happened. Not done this session — flagging for the next pass.
- `/api/email/send` and `/api/email/confirm-donation` — called by
  `DonateSuccess.tsx`/`FundraiserSuccess.tsx`/`usePayPalButtons.ts` but **do not exist
  anywhere in the backend** (confirmed via grep). Donor/fundraiser confirmation emails are
  silently broken today (fire-and-forget calls fail and get swallowed) — separate from the
  auth work, but a real "receipts on money flows" gap given real payments are about to go
  live. Needs either building these endpoints or pointing the frontend at `/api/email/receipt`.

## [DONE] — critical women-schema parity bug (found mid-deep-audit, fixed same session)

Pre-existing bug, unrelated to anything built this session, but directly threatened the
dues-payment `source` verification work above — fixed immediately given severity:

- [x] Several migrations (`V18`, `V19`, `V20`, `V23`) used **unqualified DDL**
      (`ALTER TABLE raffles ...` instead of `ALTER TABLE men.raffles ...`) against this
      app's multi-tenant setup (`spring.flyway.schemas=men,women`, first entry = default
      schema = `men`). Every one of those statements silently only ever applied to `men`.
      Confirmed via full migration-vs-entity diff:
  - `women.payment_receipts` had no `source` column -> **any PayPal capture under the
    Women's tenant (donations, raffles, shop, events, dues) threw a live SQL error and
    failed to record a receipt.**
  - `women.raffles` was missing `stream_data`/`images` columns.
  - `women.alumni_budget` table didn't exist at all.
  - Fixed via `V26__women_schema_parity_fixes.sql` — additive only (`ADD COLUMN IF NOT
    EXISTS` / `CREATE TABLE IF NOT EXISTS`), mirrors the `men` structure exactly.
- One dead table found in the same pass: `stream_config` (`V16`/`V17`) has no matching
  `@Entity` and no code references anywhere — appears to be created but never read/written.
  Not fixed/removed — just noted, needs a decision (see Lower Priority).

## [DONE] — Women's store checkout now actually fulfills orders

- [x] **FIXED — dead-route bug.** `Women/Local/Pages/Store/hooks/useStore.ts` navigated to
      `/checkout/success`; registered route is `/women/checkout-success`. Fixed.
- [x] **FIXED — the routing bug that made the above not matter anyway.**
      `Women/Local/Pages/Store/components/Cart.tsx` called `navigate("/checkout", ...)`
      (Men's route) instead of `/women/checkout`. Since `getActiveProgram()`/
      `getProgramInfo()` (`programHelper.ts`) determine program purely from the URL path,
      every Women's checkout was silently landing on **Men's** `Checkout.tsx`/`useStore.ts`
      — meaning PayPal orders, Printify fulfillment, and receipt emails for Women's
      purchases were being tagged and persisted under the `men` schema, not `women`. A
      cross-tenant data-integrity bug layered on top of the missing-cart-data bug below.
- [x] **FIXED — Women's store sends no order confirmation email.** Added the missing
      `/api/email/receipt` call to `Women/.../useStore.ts` (matches Men's). Also fixed
      silent PayPal client-id/script-load error swallowing (now `toast.error`s instead of
      only `console.log`), and removed the `&& shipping` gate on the fulfillment call that
      didn't exist on Men's side (custom/digital orders without shipping no longer
      silently skip fulfillment).
- [x] **FIXED — `WomenCartContext.tsx`** (new file) mirrors `MenCartContext.tsx`
      (localStorage-backed persistence, key `womens-cart-v1`), wired into `main.tsx`
      alongside `MenCartProvider`. `Store.tsx` and `Checkout.tsx` (Women's) now consume it
      via `useWomenCart()` the same way Men's does via `useMenCart()`, replacing Women's
      `Store.tsx`'s ad hoc reducer-based cart and `Checkout.tsx`'s fragile
      `state?.setCart || null` read off router state.
- [x] **FIXED — shipping-address form added to Women's `Checkout.tsx`**, mirroring Men's
      fields exactly (first/last name, email, phone, address1/2, city, state, zip,
      country) and the same "PayPal only activates once shipping is valid" gating.
- [x] **FIXED — `cart`/`shipping`/`donation` now actually passed into `useStore(...)`** in
      Women's `Checkout.tsx` (previously called with only 4 args, silently defaulting cart
      to `[]` and shipping to `null`, so Printify fulfillment never fired — this was the
      top-priority item from last session).
- [x] Removed a stray, redundant `useStore(...)` call in Women's `Cart.tsx` (Men's
      equivalent has no such call; it was a leftover duplicate PayPal-script-load trigger
      doing nothing useful since that component has no `#paypal-buttons-container`).
- **Not verified against a live PayPal/Printify/email integration.** No backend
  (Postgres/Firebase/S3/PayPal sandbox) was stood up this session, so this was validated via
  typecheck (`npx tsc --noEmit -p .` — clean aside from the pre-existing
  `CartSetter`/`SetCartFn` mismatch tracked below, now mirrored symmetrically on Women's
  side same as Men's) and a wiring/structure review, not an end-to-end click-through with a
  real capture. Recommend a manual click-through (add to cart -> `/women/checkout` -> fill
  shipping -> sandbox PayPal capture -> confirm Printify order + receipt email) before launch.

## [DONE] — Women's ProductCard multi-option support

- [x] **FIXED — ported Men's generic option-based `ProductCard.tsx` to Women's**, replacing
      the independent rewrite that only supported a single "size" dimension (guessed via a
      hardcoded `sizeOrder` list + array-index heuristics) and dropped Men's generic
      color/style/multi-option support (`product.options`/`selectableOptions`, resolving
      variants by matching all selected option IDs against `variant.options`). Safe 1:1 port
      — both programs share the same Printify shop/API, so product/variant shape is
      identical on both sides; Women's custom-product normalization in `Store.tsx` already
      produces the same `options`/`variants` shape Men's `ProductCard.tsx` expects. Verified
      via `npx tsc --noEmit -p .` (clean, same baseline errors only).

## [MED] — confirmed, cosmetic/small blast radius

- [x] **FIXED — `useRosterState.ts` (Women's) is now properly typed**, mirroring Men's
      (`RosterState`/`RosterAction`/`Dispatch<RosterAction>`, and restored the
      `!!action.isCoach` boolean coercion the untyped version had dropped in `OPEN_MODAL`).
      Required adding `src/Women/Local/Pages/Roster/types.ts` (Men's `Coach`/`Player`/
      `RosterFormData`/`RosterState`/`RosterAction` types didn't exist on Women's side at
      all — this is the same gap as the "no shared `types.ts`" finding below, just now
      actually needed rather than theoretical). Typing `editingItem` properly then surfaced
      a real, separate latent type bug in Women's `RosterForm.tsx`: it had independently
      invented its own `EditingItem = Partial<RosterFormData> & {id}` type instead of
      accepting `Coach | Player | null` like Men's does, which doesn't line up with
      `Player.number` being `string | number` vs `RosterFormData.number` being `string` —
      fixed by porting Men's exact `initialForm`/prop-typing approach (cast to
      `Partial<Player & Coach>`, coerce `number` via `String(base.number)`).
- [x] **REVIEWED, no change made.** Sponsor form localStorage key mismatch (Women writes
      `"sponsorSubmissionsw"`, Men writes `"sponsorSubmissions"`) is genuinely inert: the
      key is write-only in both files (grepped the whole repo — nothing ever reads either
      key back), so this is dead local-browser scratch data with zero functional impact
      either way. Not worth the churn of renaming for its own sake; left as-is.
- [x] **FIXED — season-cutoff inconsistency, consolidated to one shared source of truth.**
      Backend: `AccountRequestService.java` and `OnboardingController.java` computed the
      season cutoff as **July** while `PlayersController.java` (and every frontend copy)
      used **August** — during the June–August rollover window this meant an account
      approved/onboarded in July would get linked to next season's roster row before that
      season existed anywhere else. Added `Utils/SeasonUtil.java` (static, August cutoff,
      matching the majority) and pointed all three call sites at it.
      Frontend: ~14 files independently reimplemented the same August-cutoff calculation
      (`Payments.tsx`, `findPlayers.ts`, `Schedule.tsx`, `Stats.tsx`, `useGames.ts`,
      `ScheduleForm.tsx`, `UpcomingGames.tsx` — Men+Women each — plus `AuthContext.tsx` and
      `App.tsx`). All were already computing the *same* cutoff (no frontend divergence, just
      duplication), so this was a pure DRY consolidation, not a behavior change: added
      `Global/Common/utils/seasonUtils.ts` as the canonical implementation;
      `Men/.../Roster/hooks/seasonUtils.ts` and `Women/.../Roster/hooks/seasonUtils.ts` are
      now thin `export *` re-exports of it (so every existing import path keeps resolving
      unchanged); the ~14 call sites now import from the canonical util instead of
      reimplementing it inline. Verified via `npx tsc --noEmit -p .` (clean, same
      pre-existing baseline errors only) and `./gradlew compileJava` (clean).
- [ ] PayPal checkout logic (`useStore.ts`) is fully duplicated per program instead of
      parameterized — exactly how the checkout-route bug above was introduced. Candidate
      for a shared `usePaypalCheckout(program)` hook.
- [x] **FIXED — dead code removed.** Deleted `src/Global/Common/components/PlayerStatsModal.tsx`
      (unused component, zero importers), `addParentToGroup.ts` (unused function, both
      programs), and three unused repository query methods
      (`PlayerRepository.findAllByUserUid`, `RaffleEntryRepository`'s bid-winner query
      `findTopByRaffleIdAndPaidTrueOrderByBidAmountDesc`, and
      `EventTeamRepository.countByEventIdAndComplete`). Verified via `npx tsc --noEmit -p .`
      and `./gradlew compileJava` (both clean, no new errors).
- [x] **FIXED — `StreamSessionRepository.deleteExpiredSessions` was unused because no
      scheduled job ever called it**, so expired live-stream sessions accumulated in the DB
      forever. Rather than delete the method, wired up an actual cleanup job (user's call,
      given this is a real gap, not just dead code): `@EnableScheduling` added to
      `MainApp.java`, and a new `Service/StreamSessionCleanupService.java` runs hourly,
      purging sessions with no heartbeat in 60+ minutes. Note: this runs on a background
      thread with no HTTP request, so `TenantContext` (normally set per-request by
      `ProgramFilter`) is never populated for it — the job explicitly loops both `men` and
      `women` tenants, setting/clearing `TenantContext` around each call, mirroring what the
      filter does per-request; without this it would silently only ever clean the `men`
      schema (`ProgramTenantResolver`'s fallback default). Verified via
      `./gradlew compileJava` (clean) — not verified against a live DB/scheduler run this
      session (no backend stood up), so confirm the job actually fires and clears rows in a
      real environment before fully trusting it.
- [ ] `stream_config` table (`V16`/`V17`) has no matching `@Entity` and no code references
      anywhere — appears fully dead. Left alone this session per user direction (dropping a
      table is a one-way migration); flag for the table owner to confirm before dropping.
- [ ] Fundraiser feature (`src/Men/Local/Pages/Fundraiser/*`,
      `ManageCustomListings.tsx`) has no Women's counterpart at all — confirm with
      whoever owns product decisions whether that's intentional or a forgotten port.

## [DONE] — full DB migration <-> entity diff (deep pass)

Checked all 17 migration files and all 30 entity classes, 25 distinct tables. Result: the
women-schema-parity bug above (now fixed via V26) was the only real defect. Everything
else — all V1 tables, V3/V7/V8/V9/V11 columns, V21–V25 tables — is schema-symmetric with a
clean 1:1 entity match. The V12–V15 apliq tables were fully created and dropped within
`men` only, correctly leaving no orphan. One dead table found: `stream_config`
(`V16`/`V17`) has no entity and no code references — see Lower Priority.

## [DONE] — full frontend dead-code sweep (deeper pass)

- **Unused exports**: `programHelper.ts`'s `getCollectionName`/`getStoragePath`/
  `getProgramConfig`/`useProgramLock` (only `getProgramInfo` is used, in 17 files);
  `yearHelper.ts`'s `clearCurrentYear`; **`src/Services/firebaseAuth.ts` is a fully dead
  file** (`login`/`signup`/`logout` all unused — real auth goes through `AuthContext`/
  Firebase SDK directly); `types/api.ts`'s `ApiCoach`/`ApiTeam`/`PublicOrderItem` types.
- **Orphaned files** (exist, never imported): `Global/RosterRedirect.tsx` and
  `Global/ScheduleRedirect.tsx` (App.tsx reimplements the same redirect inline via
  `<Navigate>` instead of using these); **`Global/Authentication/RequestAccessForm.tsx`**
  — the self-service "Request Access" form built/reviewed earlier this session — is
  exported but never imported into `AuthModal` or any route. Worth checking: is this
  intentionally not wired up yet, or was it supposed to be reachable somewhere?
- **Routes**: clean. Every page has a matching route, every route resolves to a real file.
  One harmless duplicate route entry (`/women` and `/women/`).
- **Duplicate utilities**: `formatDate`/`formatDateTime` reimplemented identically across
  ~10 files (5 Men/Women pairs: EventSignup, EventDetail, GameRow, HighlightGame,
  ScheduleForm) instead of living in `Global/Common/utils`. Validation logic is already
  properly centralized (`Common/utils/validation.ts`) — no duplication there. No duplicate
  currency-formatting or error-handling helpers found. `Common/hooks/` and `Common/utils/`
  are otherwise fully utilized, nothing dead in them.
- No substantial commented-out code blocks found anywhere.

## [DONE] — full Men/Women page-pair diff (deeper pass)

84 Men files, 78 Women files, all 78 Women files have Men counterparts; diffed all 78
pairs. Context: **Men's program is the primary focus** — some Women's gaps below are
likely intentional under-investment rather than bugs, called out where relevant. The
checkout-reload item is a genuine money bug regardless of program priority.

- [x] **FIXED — Women's checkout success page re-captured payment on reload.** Turned out
      NOT to be a real double-charge risk (`PayPalController.captureOrder` already caches by
      `orderId` and returns the stored payload instead of re-hitting PayPal on a repeat
      call) — but it was still a `POST` to a mutating-looking endpoint on every page load,
      which is a smell and a latent risk if that idempotency guard is ever refactored away
      without someone realizing this depended on it. Added a genuinely read-only
      `GET /api/paypal/receipt?orderID=...` (`PayPalController`, reads `PaymentReceipt`
      only, never touches the PayPal API) and pointed Women's `CheckoutSuccess.tsx`'s
      reload-fallback path at it instead.
- [x] **FIXED — the actual dead-route bug.** `Women/.../useStore.ts` hardcoded
      `navigate("/checkout/success", ...)`; the registered route is
      `/women/checkout-success`. Every completed Women's purchase hit this. Fixed to match.
- [x] **FIXED — Women's `useStore.ts` silently swallowed PayPal failures** — client-id
      fetch failure, PayPal SDK script load failure now `toast.error` + `console.error`
      instead of `console.log` only (matches Men's `throw`-based pattern's intent without
      introducing new unhandled-throw risk inside a `useEffect`).
- [x] **FIXED — order-fulfillment gating.** Removed the `&& shipping` requirement that
      didn't exist on Men's side.
- [ ] [!] **NEW, MORE SEVERE FINDING — Women's checkout never actually passes cart or
      shipping data to fulfillment at all.** While fixing the above, found
      `Women/.../Checkout/Checkout.tsx` calls
      `useStore(totalBeforeShipping, "paypal-buttons-container", setCart, navigate)` —
      only 4 arguments. `useStore`'s `cart` and `shipping` parameters (positions 5 and 6)
      have no caller-supplied value, so they silently default to `[]` and `null`. That
      means **every Women's store order's Printify fulfillment call today receives an
      empty cart and no shipping address** — the `if (printifyItems.length > 0 ||
      customItems.length > 0)` guard is never true, so fulfillment silently never fires.
      Compounding this: **Women's `Checkout.tsx` has no shipping-address form at all** —
      Men's `Checkout.tsx` has a full name/email/phone/address form wired to a `shipping`
      state object; Women's has none. `Checkout.tsx` also reads `setCart` off router
      `state` (`state?.setCart || null`) rather than from a cart Context/hook like Men's
      `useMenCart()` — fragile even if populated, since nothing in the codebase currently
      passes a `setCart` function through navigation state.
      **This is a real checkout-flow gap, not a small patch** — properly fixing it means
      building a shipping form (mirror Men's fields) and a real cart-persistence mechanism
      (mirror `MenCartContext.tsx` -> a `WomenCartContext.tsx`, wired into `main.tsx`
      alongside `MenCartProvider`, consumed by `Store.tsx`/`Checkout.tsx` the same way
      Men's does) so `cart` and `shipping` actually reach `useStore`. Deliberately not
      started this session per user direction — flagging as the top priority for next
      session before Women's store goes live for real purchases.
- [x] **FIXED — Women admins now have a "Custom Listings" tab.** `ManageCustomListings.tsx`
      was already fully program-aware (`getProgramInfo()`, sends `?program=` on every
      call) — just wired it into Women's `AdminDash.tsx` tab list/switch, importing the
      same component directly from `Men/Local/Admin/Tabs/` (same precedent as Women's
      `/order-lookup` reusing Men's `OrderLookup.tsx` directly) rather than duplicating the
      file, since there was nothing program-specific to diverge.
- [x] **FIXED — ported Men's "Lookup by Order ID" panel into Women's `OrderLogsModal.tsx`**
      (Printify request/response + raw PayPal receipt lookup by order ID) — Women admins
      couldn't investigate a specific order's payload before. While there, also switched
      Women's list-fetch off a raw `fetch(API_BASE + ...)` call onto the shared
      `apiRequest` helper (matches Men's; `apiClient` already auto-injects the `program`
      query param/`X-Program` header from the URL path, so the manual `&program=` param
      Women's version was passing by hand is no longer needed).
- [ ] `Pages/Store/OrderLookup.tsx` has no Women's version — the Women's `/order-lookup`
      route reuses the Men component directly. Works fine (orders aren't program-scoped)
      but is architecturally inconsistent with how every other Store page was duplicated;
      not a bug, just noted.
- [x] **FIXED as part of the `useRosterState` fix above** — added
      `src/Women/Local/Pages/Roster/types.ts` (`Coach`/`Player`/`RosterFormData`/
      `RosterState`/`RosterAction`, matching Men's). Only `useRosterState.ts` and
      `RosterForm.tsx` were repointed at it so far (both needed it to fix the type bugs
      above) — other Women's Roster files (`Roster.tsx`, `contenthooks/usePlayers.ts`,
      `contenthooks/useCoaches.ts`) still have their own inline/implicit shapes rather than
      importing from the new `types.ts`. No functional issue today, but worth a follow-up
      pass to fully consolidate.
- Confirmed intentional: **Fundraiser feature is Men-only** (no `/women/fundraiser`
  route exists at all) — matches your Men-first-focus context, not a bug.
- Everything else checked clean (cosmetic/branding-only differences): Home, Gallery,
  Events/EventSignup, Raffles/RaffleDetail, LiveGameViewer, AlumniBudget, Sponsor pages,
  Settings, EmailCenter, ManageEvents, ManageRaffles, Coaches, ManageArticles, Donate,
  Recruitment.

## [DONE] — admin-panel-wide flow verification (post-lockdown contract check)

Per this doc's own earlier recommendation ("recommend testing each admin panel tab... before
considering this done — the auth checks were added carefully but this is exactly the kind of
change that benefits from a manual click-through"), did a systematic frontend<->backend contract
check across every admin-facing surface in the app (not just `AdminDash` tabs — inline
admin-only edit affordances on public pages too), specifically hunting for damage the two
lockdown waves might have caused: path/method typos, admin-facing components calling the
backend via raw `fetch()` instead of the shared `apiRequest` helper (which is what auto-attaches
the Firebase Bearer token/`program` header — a raw-fetch admin call would silently 401/403
after the lockdown), request/response shape drift, and program-scoping gaps.

- [x] **Verified clean, no fixes needed.** Checked: `ManagePlayers.tsx` <-> `UsersController`,
      `AccountRequests.tsx` <-> `AccountRequestController`, `EmailCenter.tsx` <->
      `EmailController`/`GroupsController`, `ManageSponsors.tsx` <-> `SponsorsController`,
      `ManageEvents.tsx` <-> `EventsController`, `ManageRaffles.tsx` <-> `RaffleController`,
      `ManageCustomListings.tsx` <-> `Admin/CustomProductController`, `StreamSetup.tsx` <->
      `StreamController`/`StreamKeyService`, `ManageArticles.tsx` <-> `ArticlesController`,
      game/score editing <-> `GamesController`, coach editing <-> `CoachesController`, gallery
      admin <-> `GalleryController`, `Recruitment/Submissions.tsx` <-> `RecruitmentController`,
      `AlumniBudget.tsx` <-> `AlumniBudgetController`, the Home-page fundraiser-banner admin CRUD
      <-> `FundraisersController` (on both Men's and Women's Home pages — a different feature
      than the Men-only `/fundraiser` donation page, which has no admin surface of its own),
      and the upload-presign flow <-> `UploadController`. Every admin-mutating call site uses
      `apiRequest` (none use raw `fetch()` against the backend — the one raw `fetch()` inside
      `ManageCustomListings.tsx` is a direct `PUT` to a presigned S3 URL, not the backend,
      which is the correct pattern), and every path/method/payload/response shape checked out
      against its controller. `StreamController` has no in-method admin checks but every path
      the frontend calls is covered by `FirebaseAdminFilter`'s prefix/exact-match sets. One
      pre-existing cosmetic-only item noted, not fixed: Women's `ManageArticles.tsx` has a
      dead/unused `collectionName = "articlesw"` variable, never referenced in any API call.

## [DONE] — critical `/api/onboard` auth gap (found while building the parent-linking feature, fixed same session)

While researching how to add a second parent-linking path, found `/api/onboard/*` had **zero
server-side authentication at all** — not admin-gated, not even login-gated. Same class of
hole as the two lockdown waves earlier in this doc, just missed until now, because it doesn't
follow the `/api/admin/*` or other already-audited path prefixes.

- [x] **`POST /api/onboard/player`** — admin-only tool (only called from the `AccountRequests`
      admin tab). Before this fix, anyone could call it directly to create a Firebase account
      and claim/overwrite any roster row via `linkPlayerId`. Now requires admin (program-scoped,
      via `AuthorizationService`).
- [x] **`POST /api/onboard/parent`** — the real risk: no auth meant anyone could link
      *themselves* as "parent" of *any player by id*, gaining view access to that player's
      dues/payment history with zero verification. Now requires admin OR the player themself
      (`player.userUid` matches the caller's uid) — mirrors the existing player-initiated UI
      gate (`userRole === "admin" || userRole === "player"` in `Payments.tsx`), just now
      actually enforced server-side instead of only in the frontend.
- [x] **`POST /api/onboard/alumni`** — checked carefully before gating this one, because it's
      also called by `Global/Authentication/AlumniJoin.tsx`, a fully public, unauthenticated
      self-service alumni signup form — gating it admin-only would have broken that
      legitimate flow. Left public by design (same "open by design" precedent as
      account-request submission): it only ever creates a plain "alumni" role account with no
      link to any existing sensitive resource by id, so the risk profile is fundamentally
      different from `/parent`.
- [x] `/api/onboard/forgot-password` — already correctly public/self-service (never reveals
      whether an email has an account); unchanged.
- [x] Registered `/api/onboard` in `FirebaseAdminFilter`'s `OPTIONAL_AUTH_PREFIXES` (verifies a
      token if present, attaches identity for the controller to use, never hard-rejects at the
      filter level — needed since this path mixes public (`alumni`, `forgot-password`) and
      gated (`player`, `parent`, `link-existing-parent`) traffic).

## [DONE] — season management (admin-controlled, unlimited seasons + one active season)

Previously, "season" had no backend concept at all — `Player`/`Game`/`Coach.season` are plain
free-text columns, and every dropdown was generated client-side from a hardcoded rolling
4-season window (`generateSeasonValues()`), with "active season" derived purely from
`localStorage` falling back to a hardcoded August-cutoff date formula. No admin control over
either. Built a real feature per your request (unlimited seasons, admin controls what appears
and which is active, applying to new-record defaults too — confirmed both decisions with you
before implementing):

- [x] **Backend**: new `seasons` table (`V27__seasons_table.sql`, created explicitly in both
      `men.seasons`/`women.seasons` schemas — learned from the earlier `V18`–`V23` unqualified-DDL
      incident in this same doc, not repeating that mistake), seeded with the currently-computed
      season marked active in both schemas so there's never a gap. `Model/Season.java`,
      `Repository/SeasonRepository.java`, `Service/SeasonService.java` (exactly one active season
      enforced per tenant; delete blocked with a clear error if any player/game/coach still
      references that season code — per your call on the delete-guard question), and
      `Controller/SeasonController.java` (`GET /api/seasons`, `GET /api/seasons/active` public;
      create/update/activate/delete admin-only, registered in
      `FirebaseAdminFilter.AUTH_REQUIRED_WRITE_PREFIXES`).
- [x] **Frontend admin UI**: new "Seasons" tab (`Admin/Tabs/ManageSeasons.tsx`, shared by both
      programs same as `ManageCustomListings`) — add a season, delete one, mark one active.
- [x] **Rewired every consumer** to defer to the admin-managed list/active season instead of the
      hardcoded formula, per your "active everywhere" call: `Roster.tsx`, `Schedule.tsx`,
      `Payments.tsx`, `Stats.tsx` (Men+Women, dropdown lists), `useRosterState.ts` (Men+Women,
      default season), `ScheduleForm.tsx` (Men+Women, season-picker dropdown inside the
      add/edit-game modal), `Home/UpcomingGames.tsx` (Men+Women), `AuthContext.tsx`'s
      `tryAutoLinkPlayer`, and — the one that actually matters most — **`App.tsx`'s top-level
      `/schedule`, `/roster`, `/stats` redirects** (Men+Women), which run *before* any page
      component mounts. This last one was an important catch: without fixing it, the
      page-level fixes above would've been dead code, since `App.tsx` always supplied a season
      segment via the old date-formula before Schedule/Roster/Stats ever saw an empty `season`
      param. Backend-side "new record" defaults also updated: `PlayersController`,
      `OnboardingController`, `AccountRequestService`'s `currentSeason()` helpers now call
      `SeasonService.getActiveCode()` instead of the static date-formula util.
      `Global/Common/utils/seasonUtils.ts` gained `fetchSeasons`/`fetchSeasonCodes`/
      `fetchActiveSeasonCode`, all falling back to the old rolling-4-window/date-formula on a
      failed fetch so a transient API error never leaves a dropdown empty or a redirect broken.
- Verified via `npx tsc --noEmit -p .` and `./gradlew compileJava` (both clean, same
  pre-existing baseline errors only). **Not verified against a live backend** — the seed
  migration's date arithmetic, the "exactly one active season" enforcement, and the delete
  guard should all get a real click-through before launch.

## [DONE] — second way to link an existing parent account to a player

You asked for this alongside the season work: when a parent already has an account (e.g.
self-registered via an account request and approved with some role, or already a parent of
another child) there was only one path — the "Add Parent" box on the Payments page — and it
always creates/reuses a Firebase account and resends a full "set your password" welcome email,
even to someone who already has a password. Added a second, explicit path:

- [x] **Backend**: `POST /api/onboard/link-existing-parent` (admin-only) — looks up an
      **existing** `UserAccount` by email (400 "no existing account found... use Invite New
      Parent instead" if none), links them to the player via the same
      `ParentAccount.linkedPlayers`/`Player.parents`/`PlayerProfile.parents` logic as the
      original flow (extracted into a shared `linkParentToPlayer()` helper to avoid duplicating
      it), and sends a lightweight notification email with no password-reset link (they already
      have one). **Safety guard**: never overwrites an existing role for that program if they
      already have one set (e.g. won't silently demote an admin to "parent" if the wrong email
      is picked) — only sets `roles.<program> = "parent"` if that program slot was empty.
- [x] **Frontend**: `AddParentForm.tsx` (Men+Women) now has an admin-only "Invite New" /
      "Link Existing" toggle in the same spot the original "Add Parent" box already lived,
      rather than building a whole new admin surface — same email input, different endpoint
      and messaging depending on mode.
- Verified via `npx tsc --noEmit -p .` and `./gradlew compileJava` (clean). **Not verified
  against a live backend** — recommend testing both the "account not found" error path and a
  real existing-account link before relying on this.

## [DONE] — Manage Users role filter + returning-player email drop bug (season rollover)

Two more items from the same session, reported directly by the user:

- [x] **Added a role filter to "Manage Users."** `UserSearch.tsx` (Men+Women) now has a
      dropdown next to the name search (All Roles / Admin / Player / Parent / Coach / Alumni /
      User); `ManagePlayers.tsx` filters on it in addition to the existing default
      admin->player->user sort. Doesn't change the existing sort behavior, purely additive.
- [x] **FIXED — a returning player's email silently disappeared when their roster row rolled
      over into a new season.** Root cause: `Roster/components/RosterForm.tsx`'s (Men+Women)
      "Add Player" fuzzy-lookup (`lookupExistingPlayer`, triggered by typing a name that
      matches an existing player) already copied hometown/state/highSchool/previousSchool/
      classYear/photo/profileId from the matched prior record onto the new season's row — but
      never copied `email`. Worse, there was **no email field in the Roster admin form at
      all**, so an admin couldn't even manually re-enter it after the fact. The backend
      (`PlayersController.applyPayload`, `usePlayers.ts`'s `savePlayer`) already fully
      supported saving a player's email end-to-end — the gap was purely in `RosterForm.tsx`
      never surfacing or carrying it forward. Fixed: added an "Email (optional)" field to the
      form, and `lookupExistingPlayer` now copies `existing.email` alongside the other
      carried-forward fields.
      Note: this fixes the *drop* — it does not fix the fuzzy-match itself, which is an exact
      case-insensitive full-name match (`PlayerRepository.findFirstByNameIgnoreCase`) with no
      typo/nickname tolerance. If the underlying complaint turns out to be "the match never
      fired at all" rather than "matched but email was dropped," that's a different,
      separate problem (fuzzier name matching) not addressed here — flagging in case it
      resurfaces.
- [x] **Also fixed while in this file**: `RosterForm.tsx` (Men+Women) still had the same
      hardcoded-rolling-4-season-window bug (`generateSeasonOptions()`) that `ScheduleForm.tsx`
      had — missed during the season-management pass earlier this session because it's a
      different modal. Now fetches the admin-managed season list the same way
      `ScheduleForm.tsx` does.
- Verified via `npx tsc --noEmit -p .` and `./gradlew compileJava` (both clean, same baseline
  errors only). **Not verified against a live backend.**

## [DONE] — season label format inconsistency (Schedule showed "26-27", Roster showed "2026-2027")

Roster's dropdown already ran season codes through `displaySeasonLabel()`; Schedule's (and, it
turned out, Stats's and Payments's) rendered the raw short code with no formatting. Made long
format ("2026-2027") the standard everywhere per your call: `Schedule.tsx` (Men+Women, dropdown
+ "No games found for..." message), `Stats.tsx` (Men+Women, dropdown + page heading), and
`Payments.tsx` (Men+Women, heading + admin season dropdown + "no player data" message) all now
call `displaySeasonLabel()`. `RosterForm.tsx`/`ScheduleForm.tsx`'s season dropdowns (fixed
earlier this session) already did this correctly. Verified via `npx tsc --noEmit -p .` (clean,
same baseline only).

## [DONE] — email showing N/A on the new season despite being linked last season

Same root category as the earlier RosterForm email-carryover fix, but a different gap:
`parents` already had a "fall back to the linked `PlayerProfile`" mechanism specifically to
survive season rollover — `email` never got the equivalent treatment, so a player whose 26-27
row had no email of its own (created before the RosterForm fix, or via any path that didn't
copy it forward) showed `N/A` on Payments even though their 25-26 row had one.

- [x] `PlayerProfileService`: added `getEmail`/`setEmail(profileId, email)`, mirroring the
      existing `getParents`/`setParents`.
- [x] `PlayersController.applyPayload`: now syncs a player row's email onto its linked profile
      on every save (mirrors the existing parents sync), so future rollovers stay correct
      without depending on the RosterForm fuzzy-match path specifically.
- [x] `PlayersController.toResponse`: read-time fallback — if a row's own email is blank, fall
      back to the profile's cached email; if the profile *also* has nothing cached yet (rows
      saved before this fix existed), searches sibling season rows sharing the same
      `profileId` for any non-blank email and **self-heals** by backfilling the profile with
      it, so this fixes the already-existing 25-26/26-27 case retroactively — no data
      migration needed, it corrects itself the next time each affected player is viewed.
- Verified via `./gradlew compileJava` (clean). **Not verified against a live backend** — the
  self-heal logic in particular should be checked against real rows with the reported
  25-26/26-27 mismatch.

## [DONE] — same season-rollover fallback gap for player self-linkage, plus fuzzy parent-match suggestions

User asked directly: "do we need a player linkage fallback too?" — yes. `parents` and `email`
both got a "fall back to the linked profile" treatment for surviving season rollover;
`player.userUid` (how a player's own Firebase account maps to a specific season's roster row)
had no such fallback, and every direct-identity check (`DuesPaymentController`,
`PlayersController.isDetailAuthorized`, `OnboardingController`'s parent-onboard self-check)
compared against it directly. A returning player whose new season's row never got an explicit
`userUid` (the RosterForm fuzzy-match path never carried it forward, same class of gap as the
email one) would lose access to their own dues/payment page every season.

- [x] `PlayerProfileService.isSelf(player, uid)` — checks `player.getUserUid()` first, falls
      back to the linked profile's `firebaseUid`. Replaced the three direct
      `uid.equals(player.getUserUid())` checks with this.
- [x] `PlayerProfileService.setFirebaseUid(profileId, uid)` — write-once only (never
      overwrites an existing link with a different uid, to avoid silently reassigning a
      profile's identity). `PlayersController.applyPayload` now calls this whenever a
      `userUid` is set on a row and a profile is already resolved, mirroring the
      email/parents sync.
      Note: profiles matched via the email/name+school fallback paths (not the firebase-uid
      path) never had `firebaseUid` populated at all — this sync is also what makes `isSelf`'s
      fallback actually work for those, not just profiles created via onboarding.
- Verified via `./gradlew compileJava` (clean). **Not verified live.**

## [DONE] — fuzzy last-name suggestions on both parent-linking flows

Two related asks: suggest existing-account matches on "Link Existing" (by fuzzy last name,
still allowing manual entry), and do the same on the "Invite New" flow too, in case a player
enters a parent's email without realizing that parent already has an account.

- [x] New `GET /api/users/search-candidates?lastName=` (`UsersController`) — deliberately not
      admin-only (players use the invite flow too), gated only on "caller is authenticated"
      (matches `/api/users`'s existing `AUTH_REQUIRED_PREFIXES` filter category). Excludes
      admin-role accounts from results so it can't be used to enumerate admin identities via
      fuzzy search from a non-admin caller. Returns up to 8 matches (uid, displayName, email).
- [x] `AddParentForm.tsx` (Men+Women) now fetches suggestions automatically from the selected
      player's last name (no extra input needed) and renders them as clickable chips below the
      email field — clicking one fills in the email (and, for admins, switches to "Link
      Existing" mode automatically, since a suggestion by definition means an account already
      exists). Manual typing into the email field still works exactly as before; suggestions
      are purely additive.
- Verified via `npx tsc --noEmit -p .` and `./gradlew compileJava` (both clean, same baseline
  only). **Not verified live** — worth confirming the suggestion list actually surfaces
  relevant matches and doesn't feel noisy with a real user base.

## [DONE] — email/profile auto-link gap widened: the earlier fix only helped rows that already had a `profileId`

User reported the email fix from the previous pass wasn't actually working. Root cause: the
prior fallback only searched sibling rows *via `profileId`* — but for the specific players
affected, the current season's row never got a `profileId` resolved at all. That happens when
the write-time resolution in `applyPayload` (email match, then name+highSchool match) had
nothing to go on at save time — e.g. the row was created with no email (the original bug) and
a highSchool value that didn't exactly match a prior season's spelling/format. With no
`profileId` on either side, there was nothing for the old fallback to look *through*.

- [x] `PlayerRepository`: added `findAllByNameIgnoreCase` (existing methods only had
      `findFirst...`, singular — needed all matches to scan across seasons).
- [x] `PlayersController.autoLinkProfileAndEmail(player)` — new read-time self-heal, called
      from `toResponse` for every authorized (non-public) player view:
      1. If the row has no `profileId`: resolve one via its own email if it has one, else by
         finding *any other season's row with the exact same name* that already has a
         `profileId` and adopting it directly — no longer requires going through a profile at
         all to make the connection.
      2. If the row has no email: try the profile (fast path), then sibling rows sharing that
         `profileId`, then — new — **any other row sharing the exact same name**, regardless
         of profile linkage.
      Whatever gets resolved is persisted (`repository.save`), so this is a one-time cost per
      row — the second time any player is viewed, both `profileId` and `email` are already
      set and the direct fields are used with no extra lookups.
- Verified via `./gradlew compileJava` (clean). **Not verified live** — this is the one to
  actually check against the real 25-26/26-27 rows the report was about, since the previous
  "fix" that didn't work also compiled and typechecked clean.

## [DONE] — player accounts made an explicit, deliberate concept instead of a fuzzy accident

User asked directly whether the site treats "one player account, many season rows underneath
it" as a real relationship. Answer was no: `PlayerProfile` is meant to be that stable
account and `Player.profileId` the link, but there's no database foreign key on it, linking
was never mandatory, and it only ever happened as a side effect of silent fuzzy-matching that
could fail without anyone knowing (exactly what caused the email/parent/self-access bugs
above). Fixed the two halves of that: existing broken links, and how new links get made going
forward.

- [x] **Existing broken links — `PlayerLinkRepairJob`.** Extracted the read-time self-heal
      (`PlayersController`'s `autoLinkProfileAndEmail`) into a shared `PlayerLinkService` so
      it's not duplicated between the controller and a new scheduled job. `PlayerLinkRepairJob`
      (`@Scheduled(initialDelay = 0, fixedRate = 24h)`) sweeps every player row in both `men`
      and `women` schemas — runs once immediately on startup per your "just run a quick cron
      job" ask, then daily after that as an ongoing safety net, mirroring the
      `StreamSessionCleanupService` tenant-looping pattern already in the codebase.
- [x] **New links — explicit picker instead of silent auto-link.** `RosterForm.tsx`
      (Men+Women) no longer silently auto-fills fields the instant a typed name happens to
      exact-match (the old, fragile `findPlayerByName` -> `/api/players/search`, exact
      case-insensitive match only, no visibility into whether it worked or matched the right
      person). It now debounces into `/api/players/search-candidates` — the same fuzzy
      matcher (Levenshtein distance + last-name-token matching) `AccountRequests.tsx`'s
      dedupe picker already used — and shows an explicit "found possible existing
      account(s)" picker: admin either clicks a candidate to deliberately link that account
      (name, season, high school shown per candidate) or clicks "None of these — new player."
      Only fires when adding a brand-new row (not while editing an existing one, to avoid
      confusing mid-edit re-triggers). Removed the now-fully-unused `findPlayerByName` from
      both `usePlayers.ts` hooks.
- Verified via `npx tsc --noEmit -p .` and `./gradlew compileJava` (both clean, same baseline
  only). **Not verified live** — in particular, confirm the repair job's first startup run
  doesn't error out or take unreasonably long against the real player table size, and that
  the RosterForm picker actually surfaces the right candidates for real names.
- [x] **Hardened `PlayerLinkRepairJob` after being asked "will this actually fix it on
      deploy?"** Original version had no per-row error handling — one player row throwing
      during the sweep would silently abort the rest of that tenant's loop, defeating the
      whole point. Now wraps each player individually (logs and continues on failure) and
      the tenant-level `findAll()` call too, plus logs a repaired/failed count per tenant so
      there's visibility into whether it actually did anything on a given run instead of
      just silent success/failure.
      **Known limitation, told to the user directly**: the repair match is exact
      case-insensitive full name only (`findAllByNameIgnoreCase`), not fuzzy — a player whose
      name is spelled differently between the 25-26 and 26-27 rows (nickname, typo, middle
      initial) won't be caught by this job. Requires an actual app restart to fire (it's a
      one-time-on-startup + daily scheduled task, not a DB migration).

## [DONE] — third email source (the account itself) + manual entry backstop

Confirmed with real production data (user pasted the actual 25-26 vs 26-27 Payments tables):
4 players (Liam Drummond, Carson Dahl, Nelson Barger, Cam Slade) had a real email on 25-26,
identical name on 26-27, still `N/A` — exactly what the repair job should have caught once
deployed. But the user also flagged **Noah Steinke**, who has an account but no email on
*either* season's `Player` row — meaning the account's email was never copied onto a `Player`
row at all, so no amount of row-to-row matching would ever find it.

- [x] **`PlayerLinkService.autoLinkProfileAndEmail` hardened to 3 passes, not 2**: now also
      resolves/backfills the row's own `userUid` (profile's `firebaseUid` -> sibling row by
      profileId -> sibling row by exact name), and — the actual fix for Noah's case — once a
      `userUid` is known, falls back to that person's real `UserAccount.email` as the last
      resort before giving up. This is a genuinely different data source than anything
      checked before (profile, sibling `Player` rows) — it's the account itself.
- [x] **`PlayerLinkRepairJob` hardened per your explicit ask**: per-row `try/catch` so one bad
      row can't silently abort the rest of a tenant's sweep, plus a repaired/failed count
      logged per tenant for visibility into whether a given run actually did anything.
- [x] **Manual entry backstop, per your explicit ask** ("give me somewhere to manually enter
      their emails incase this fails"): the "All Players" admin table on the Payments page
      (`PlayerTable.tsx`, Men+Women) — previously plain read-only text (`N/A` with no way to
      fix it) — is now an editable input, pre-filled with whatever the auto-link/fallback
      chain already found so the admin can review-and-save rather than retype from scratch.
      Saved via the existing "Save" button (extended to include email alongside balance),
      same `PUT /api/players/{id}` endpoint `RosterForm.tsx` already uses.
- Declined a related but far riskier ask: SSH into the production EC2 to hand-edit tables
  directly. Explained why — no code review, no compile/typecheck safety net, much harder to
  undo on a database holding real payment/PII data than a bug in reviewed application code.
  The repair job is the safer version of the same idea. Redirected toward it; flagged that
  any other "cleanup" (e.g. the still-open `stream_config` dead-table question) should go
  through a reviewed migration, not an interactive session, if it comes up.
- Verified via `npx tsc --noEmit -p .` and `./gradlew compileJava` (both clean, same baseline
  only). **Not verified live.**

## [DONE] — read-only schema review, then added the two highest-impact missing foreign keys

User asked for a schema health check (not a fix) after this session's run of profile-linking
bugs made them suspect the schema itself was loose. Did a full read-only pass — every
migration (V1–V27) and every entity, cross-checked, no changes — before touching anything.

**Findings** (full list, not just what got fixed):
- [HIGH] `dues_payments.player_id` — the actual payment ledger table — had **no FK** to
  `players.id` at all (`V24`). Same category of gap as the already-known `profile_id` issue,
  just on money data instead of linking metadata.
- [HIGH] `Player.profile_id` (already known from earlier this session) — still no FK.
- [MED] `users.player_id`, `event_registrations.team_id` — same "no FK" pattern, lower blast
  radius. Not fixed this pass.
- [MED] `stream_keys.game_id`/`chat_messages.game_id` stored as `TEXT`, not even `UUID` — can't
  get a real FK without a type migration. Not fixed this pass.
- [MED] Missing indexes on `players.email`/`season`/`user_uid`, `users.email` — all queried
  constantly, none indexed. Not fixed this pass (fine at current scale, worth it later).
- [MED] `season` on `players`/`games`/`coaches` still free text, never actually constrained
  against the new `seasons` table — that table governs dropdown display/defaults only, not
  data integrity. Not fixed this pass.
- [LOW] `custom_product`/`custom_product_variant` use `BIGSERIAL` ids vs UUID everywhere else
  (25 of 27 tables) — inconsistent, harmless.
- [LOW] `stream_config` table reconfirmed still fully dead (no entity, no code references) —
  same open question as before, still needs a table-owner decision before dropping it.
- [LOW] `V6` migration number is missing (`V5` -> `V7`) — not harmful (Flyway doesn't require
  contiguous numbers) but flagged as worth a sanity check that nothing was ever meant to
  be there.
- Re-confirmed exhaustively: no *new* unqualified-DDL instances beyond the already-known/
  already-fixed V18/V19/V20/V23.

**Fixed**: `V28__add_missing_foreign_keys.sql` — adds FKs for the two [HIGH] items only
(`dues_payments.player_id -> players.id`, `players.profile_id -> player_profiles.id`),
schema-qualified for both tenants. Added as `NOT VALID` deliberately: enforces the
constraint for all new writes immediately without requiring Postgres to validate every
existing row during the migration — there was no way to confirm from outside the database
whether any legacy row would already violate the constraint (e.g. a payment whose player
was since deleted), and a normal `ADD CONSTRAINT` failing mid-migration could block startup.
Existing rows can be validated later with `VALIDATE CONSTRAINT` (a non-locking read) once the
data's confirmed clean — not done this session, no DB access to check. `ON DELETE`: dues
payments `RESTRICT` (a player with payment history must never be silently deletable);
`players.profile_id` `SET NULL` (profiles are never deleted by the app today, but losing the
link is recoverable via the self-heal logic if one ever is).
No entity/Java changes needed — both columns are already plain `UUID` fields, not JPA
relationships. Verified via `./gradlew compileJava` (clean) — **migrations aren't validated
by that command, only against a real Postgres instance at Flyway runtime, so this has not
actually been run anywhere.**
- Declined (again) the "just SSH into EC2" framing — this went through a written, reviewed
  migration file instead, same as the standing project convention (see V26/V27).
- The other [MED] /[LOW] findings above are left as open backlog, not fixed — flag if any should be
  prioritized next.

## [HIGH] CRITICAL, FIXED — dues payments (and Men's Fundraiser) were silently never actually charging PayPal

Found via a real $1 test payment the user ran that failed with a 400 from `/api/dues-payments`
("payPalOrderId is required"). Traced to the actual root cause via a read-only production DB
query (see the `payment_receipts` table) rather than guessing — confirmed the order's status
was stuck at `CREATED`, never `COMPLETED`, with no amount/payer recorded: **PayPal was never
actually called to capture the payment.**

Root cause: `PayPalController.createOrder()` calls `PaymentReceiptService.reserveSource()`
*before* the buyer even approves payment, at order-creation time — this inserts a
`PaymentReceipt` row with `status = "CREATED"` and `payload` at its column default (`'{}'`).
Later, when the real capture request comes in, `captureOrder()` asks `findStoredPayload()`
whether this order was already captured (that check exists so a page refresh/back-button
after a real completed payment doesn't re-hit PayPal) — but the check was only
`payload != null && !payload.isBlank()`, and `'{}'` satisfies that. So **every single order's
first-ever capture attempt** was misidentified as "already cached" and short-circuited into
returning that empty `{}` straight back, **without ever calling PayPal's capture API at all.**
No money ever moved for any dues payment or Men's Fundraiser donation attempted since this
mechanism was introduced.

- [x] **Fixed the actual bug**: `PaymentReceiptService.findStoredPayload()` now also requires
      `status` isn't `"CREATED"` (plus a second guard against a literal `"{}"` payload) before
      treating a receipt as a genuine cached capture. This is what the method's own doc
      comment already claimed it did ("read-only lookup of an **already-captured** order") —
      the fix makes the code match that stated contract.
- [x] **Hardened `Fundraiser.tsx`** (Men-only page affected the same way): its `onApprove`
      handler had **zero validation** — an empty/incomplete capture response was silently
      treated as a successful donation, incrementing the displayed "raised" total and
      showing the donor a real success page despite no charge ever happening. Now checks for
      a real order id first and shows an error instead if it's missing, matching the
      (accidentally more defensive) behavior dues already had via its backend 400.
- **Blast radius, confirmed by checking every `usePayPalButtons()` call site**: only flows
  that pass an explicit `source` param are affected — that's **Dues payments (Men+Women)**
  and **Men's Fundraiser** only. Donate, Raffle entries, and Event-signup payments don't pass
  `source`, so `reserveSource()` never fires for them — unaffected.
- Verified via `./gradlew compileJava` and `npx tsc --noEmit -p .` (both clean, same baseline
  only). Diagnosed using read-only production queries (SSH + `psql`, no writes) — did not
  attempt to fix or backfill the stale `CREATED` placeholder receipt rows from the failed
  test attempts; they're inert (each retry generates a fresh PayPal order id) and harmless to
  leave as historical noise in `payment_receipts`.
- **This is live-money-broken on production right now and needs deploying immediately** —
  every dues payment attempt currently fails to actually charge the card (surfaces as a
  visible error, at least, so no false confidence there) and every Men's Fundraiser donation
  attempt currently shows a fake success with no real charge (no error surfaced at all,
  worse — a donor could believe they gave money when they didn't).

## Next up (not started)

Everything actionable from this audit has been fixed or explicitly deferred with a reason.
What's left, in priority order given "final pre-launch review, real money" framing:

1. **Manual click-through against a real backend** — nothing this session was verified
   against a live Postgres/Firebase/S3/PayPal sandbox stack, only via `tsc`/`gradle compile`
   and static contract review. Before launch, confirm:
   - Women's checkout end-to-end: add to cart -> `/women/checkout` -> shipping form ->
     sandbox PayPal capture -> Printify order + receipt email land under the `women` schema,
     not `men`.
   - The new stream-session cleanup job (`StreamSessionCleanupService`) actually fires
     hourly and purges rows in both `men` and `women` schemas.
   - A logged-in-admin click-through of each admin tab (the contract-level check this
     session did came back clean, but nothing beats an actual click-through).
   - The new Season admin tab: add a season, mark it active, confirm Roster/Schedule/Stats/
     Payments all pick it up as the default, confirm a new game/player defaults to it, confirm
     the delete guard actually blocks deleting an in-use season.
   - The new parent-linking paths: `/api/onboard/parent` (self-or-admin, no longer open to
     anyone), and `/api/onboard/link-existing-parent`'s two outcomes (existing account found ->
     linked; not found -> the specific error message, not a generic failure).
2. Remaining open items, all genuinely low priority/cosmetic:
   - `stream_config` table (V16/V17) — confirmed dead, left alone pending table-owner
     confirmation before a drop migration.
   - Duplicated PayPal checkout logic per program (`useStore.ts` Men+Women) — refactor
     candidate for a shared `usePaypalCheckout(program)` hook; not done, moderate risk to
     touch given it's the live payment path and both programs currently work correctly.
   - Women's Roster module: `Roster.tsx`, `contenthooks/usePlayers.ts`,
     `contenthooks/useCoaches.ts` still don't import the new `Roster/types.ts` (only
     `useRosterState.ts`/`RosterForm.tsx` do) — follow-up consolidation, no functional bug.
   - `Pages/Store/OrderLookup.tsx` has no Women's version (reuses Men's directly) — noted
     as intentional/fine, not a bug.
   - Women's `ManageArticles.tsx` has a dead/unused `collectionName = "articlesw"` variable
     (cosmetic only, found during the admin-panel verification pass).

### [DONE] Fixed this pass (see updated checkmarks above for detail)
Donor/fundraiser confirmation emails (`/api/email/send` now exists; dead
`/api/email/confirm-donation` call removed from `usePayPalButtons.ts`), Women's dead-route
checkout bug, Women's checkout-success reload behavior (now a real `GET`, not a `POST`),
Women's silent PayPal error swallowing, Women's fulfillment shipping-gate inconsistency.

### [DONE] Fixed this pass (session 2)
Women's store checkout now actually fulfills orders end-to-end (`Cart.tsx` routing bug,
`WomenCartContext.tsx` + `main.tsx` wiring, shipping form, `useStore(...)` args). Backend +
frontend season-cutoff inconsistency consolidated to one shared util per side. Women's
`ProductCard.tsx` ported to Men's generic multi-option implementation. Dead code removed
(`PlayerStatsModal.tsx`, `addParentToGroup.ts`, 3 unused repo methods). Stream-session
cleanup actually wired up (`@EnableScheduling` + hourly `StreamSessionCleanupService`,
looping both tenants). Women's admin gained the `ManageCustomListings` tab and the Order
Logs "Lookup by Order ID" panel. `useRosterState.ts` (Women's) properly typed, which
surfaced and fixed a real latent type bug in `RosterForm.tsx`; added
`Roster/types.ts` for Women's side. Sponsor-form localStorage key mismatch reviewed and
confirmed inert (write-only, never read back) — left as-is. See the relevant "DONE"/
"FIXED" entries above for full detail on each.

## Notes on approach

- User explicitly wants a **report-first** posture for the broader dead-code/drift audit —
  findings get written up and prioritized before large changes. This does NOT apply to
  security/auth or money-integrity holes, which get fixed immediately given severity (this
  is how the two waves of controller lockdowns and the schema-parity bug were handled).
- User explicitly wants to be consulted before "important or uncertain direction" changes.
  Anything in "Next up" should be confirmed before starting, even though it's documented
  here — especially the Women's checkout fixes, since they touch a live payment flow.
- Backend compiles clean (`cd backend && ./gradlew compileJava`) and frontend typechecks
  clean (`npx tsc --noEmit -p .`) as of all [DONE] items above — same pre-existing baseline
  errors only (EmailCenter Group typing, ManagePlayers Role mismatch, Checkout CartSetter,
  OrderLookup string/never, GalleryEdit, Schedule Player.number — all pre-dating this
  session, tracked in project memory, not caused by any change here).
- This session touched a LOT of backend controllers in one pass (17 total across both
  lockdown waves). Recommend testing each admin panel tab (Roster, Account Requests,
  Raffles, Events, Articles, Sponsors, Games, Coaches, Gallery, Email Center, Alumni
  Budget, Fundraisers, Recruitment) end-to-end as a logged-in admin before considering this
  "done" — the auth checks were added carefully with real frontend call-sites traced for
  each one, but this is exactly the kind of change that benefits from a manual click-through
  before launch, not just compile/typecheck passing.
