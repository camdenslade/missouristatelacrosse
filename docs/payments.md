# Payments — PayPal + Stripe

The site accepts money for: **dues**, **donations**, the **Dallas fundraiser**,
**raffle** entries, **event** registrations, the **team store** (Printify), and
pay-to-watch **stream** access.

There are two payment rails. Which one the browser shows is a **build-time, per-program
choice**; the backend keeps both live at all times.

---

## STATUS: Stripe is coded but NOT activated

All the code, config plumbing, docs, and DB migration (`V30__payment_receipt_provider`)
are merged. Stripe is **inert** until the steps below are done. Until then the site
runs 100% on PayPal exactly as before — the `stripe-java` dependency and endpoints just
sit idle (`stripe.enabled` is `true` by default but there are no keys, so
`StripeService.isEnabled()` is false and `/api/stripe/create` returns 503).

### Go-live checklist (do this on Stripe setup day)

1. **Create the Stripe account.** Get `sk_live_…` and `pk_live_…` (use test-mode
   `sk_test_…` / `pk_test_…` first to run the checklist below).
2. **Backend secrets.** Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET` to AWS Secrets Manager secret `backend-prod`. Deploy the
   backend (`backend/deploy-backend.sh`). Both `MainApp` and `SecretsConfig` already
   read these keys.
3. **Webhook.** Stripe dashboard -> Developers -> Webhooks -> add endpoint
   `https://api.missouristatelacrosse.com/api/stripe/webhook`, subscribe to
   `checkout.session.completed` (and `checkout.session.async_payment_succeeded`).
   Copy the signing secret `whsec_…` into `STRIPE_WEBHOOK_SECRET` and redeploy.
4. **Frontend.** In `.env` set `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_…`,
   `VITE_PAYMENT_PROVIDER=stripe`, `VITE_PAYMENT_PROVIDER_WOMEN=stripe`. Then
   `npm run build` and `firebase deploy`.
5. **Test every flow** with card `4242 4242 4242 4242` — see the testing checklist near
   the bottom of this doc.
6. **Rollback** at any point: set `VITE_PAYMENT_PROVIDER(_WOMEN)=paypal`,
   `npm run build`, `firebase deploy`. Instant, no backend change.

---

## Why two rails

The site's PayPal API credentials were being run off a personal PayPal account that got
flagged. Stripe was added as an interim rail that can be switched on without touching
any of the downstream money logic.

## The switch

Set in `.env` (same convention as `VITE_TEAMSTORE_ENABLED` / `VITE_DONATE_ENABLED`):

```
VITE_PAYMENT_PROVIDER=paypal          # men   — "paypal" (default) or "stripe"
VITE_PAYMENT_PROVIDER_WOMEN=paypal    # women
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_… # browser-safe Stripe publishable key
```

Anything other than the literal `stripe` (including unset) means PayPal, so a typo can
never take payments offline.

Flipping it:

```
# edit .env, then
npm run build
firebase deploy
```

Same speed as flipping the teamstore/donate flags today. There is **no** admin toggle
and **no** database flag — deliberately, to match the rest of the codebase.

Backend kill switch: `STRIPE_ENABLED=false` (env / Secrets Manager) makes
`POST /api/stripe/create` return 503. Leave it `true` in normal operation.

## How it fits together

Every paid flow funnels through one hook:

```
src/Global/Common/hooks/usePaymentButtons.ts
   |- usePayPalButtons.ts     (rail: paypal)  -> /api/paypal/create + /capture
   `- useStripeCheckout.tsx   (rail: stripe)  -> /api/stripe/create + /confirm
```

`usePaymentButtons(amount, containerId, onSuccess, label, source)` — same signature the
old `usePayPalButtons` had. The inactive rail is invoked with a `null` amount so it
stays inert. Consumers: `Payments.tsx`, `Donate.tsx`, `Fundraiser.tsx`,
`RaffleDetail.tsx`, `EventDetail.tsx` (Men + Women), `Store/hooks/useStore.ts`, and
`components/KeyGate.tsx` (stream — still uses `@paypal/react-paypal-js` directly for the
PayPal branch, `useStripeCheckout` for the Stripe branch).

### The key idea: one receipt table, processor-agnostic downstream

Both rails write the **same** `payment_receipts` row shape:

| column      | PayPal                    | Stripe                              |
|-------------|---------------------------|-------------------------------------|
| `order_id`  | PayPal order id           | Stripe Checkout Session id `cs_…`   |
| `status`    | `COMPLETED`               | `COMPLETED` (set from `paid`)       |
| `amount`    | capture amount            | `amount_total / 100`                |
| `source`    | locked at `/create` time  | locked at `/create` time (metadata) |
| `provider`  | `paypal`                  | `stripe`                            |

`DuesPaymentController`, `RaffleController`, `EventsController`, and the store flow only
ever read `payment_receipts` by `order_id` + check `status`/`amount`/`source`. They
never learn which processor was used, so **nothing downstream changed**.

Stripe reshaping happens in `StripeService.toReceiptPayload(Session)` ->
`PaymentReceiptService.recordReceipt(payload, source, "stripe")`.

## Stripe request flow (embedded checkout)

1. Browser mounts Stripe **Embedded Checkout** into the same container the PayPal
   buttons used (stays on-page — raffle/event/store form state survives).
2. `fetchClientSecret` -> `POST /api/stripe/create {amount, source}` ->
   `StripeService.createEmbeddedCheckout(...)`; the controller then
   `reserveSource(session.id, source, "stripe")` (locks source + program).
3. Buyer pays inside the embedded iframe. `onComplete` fires.
4. Browser -> `POST /api/stripe/confirm?sessionId=…` — idempotent: returns the stored
   payload if the webhook already recorded it, else retrieves the session, verifies
   `payment_status == paid`, records the receipt, returns a PayPal-shaped payload.
5. The flow's existing `onSuccess(payload, amount)` runs unchanged (credits dues /
   records raffle entry / creates Printify order / …).

### Webhook (source of truth)

`POST /api/stripe/webhook` — configure in the Stripe dashboard for
`checkout.session.completed` (+ `checkout.session.async_payment_succeeded`). Verified
with `STRIPE_WEBHOOK_SECRET`. It re-fetches the session, resolves the owning program
from session metadata (the webhook has no `X-Program` header — it is exempted in
`ProgramFilter`), sets the tenant, and records the receipt. Idempotent via
`order_id`, so webhook + confirm racing is fine.

Local dev:

```
stripe listen --forward-to localhost:8080/api/stripe/webhook
# paste the printed whsec_… into STRIPE_WEBHOOK_SECRET
```

## Secrets

AWS Secrets Manager `backend-prod` (loaded in `MainApp.loadSecretsFromAWS`):

| key                     | example        |
|-------------------------|----------------|
| `STRIPE_SECRET_KEY`     | `sk_live_…`    |
| `STRIPE_PUBLISHABLE_KEY`| `pk_live_…`    |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…`      |
| `STRIPE_ENABLED`        | `true`         |

`VITE_STRIPE_PUBLISHABLE_KEY` is separate — it is a frontend build var, not a secret.

## Testing checklist (Stripe test mode, card `4242 4242 4242 4242`)

With `VITE_PAYMENT_PROVIDER=stripe` and `stripe listen` running:

- **Dues** — pay a balance -> `payment_receipts` row `provider=stripe`, `source=dues`,
  `status=COMPLETED`; `dues_payments` row; `player.balance` drops; receipt email.
  Re-fire the webhook and re-call confirm -> no double credit.
- **Raffle** — paid entry recorded once; a mismatched amount is rejected.
- **Event signup** — registration recorded; team flow intact.
- **Store** — `POST /api/printify/create-order` fires with the session id; receipt
  email; cart clears; `/checkout-success` (`/women/checkout-success`) renders.
- **Donate / Fundraiser** — success screen; `GET /api/paypal/total?source=fundraiser`
  (shared table) reflects the new amount.
- **Stream (KeyGate)** — key issued + emailed.
- Bad-signature webhook -> 400, nothing written.
- `VITE_PAYMENT_PROVIDER=paypal` + rebuild -> PayPal buttons everywhere again.

## Rollback

`.env` -> `VITE_PAYMENT_PROVIDER(_WOMEN)=paypal`, `npm run build`, `firebase deploy`.

## Fees

Stripe ≈ 2.9% + $0.30 per charge; different from PayPal. Tell the treasurer — not a
code concern.

## Known limitations (interim; tracked for the professionalization pass)

- `StreamKeyService` still records the payment id without verifying it against
  `payment_receipts` (pre-existing; true for PayPal too).
- `PrintifyController.createOrder` does not verify the receipt amount/status
  (pre-existing).
- ESLint's flat config only lints `*.js`/`*.jsx`, so none of the `.tsx` payment code is
  linted in CI (there is no CI).
