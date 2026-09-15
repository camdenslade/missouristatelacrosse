# Rate limiting

In-app, per-client-IP request throttle: `backend/.../Config/RateLimitFilter.java`.
In-memory token buckets, no Redis - the backend is a single instance so that is
enough. Runs right after the CORS filter, before tenant resolution, so a flood is
rejected before any database work.

## Limits

Per minute, per IP, per traffic class. Defaults (override with env vars or
`application.properties`):

| Class | Paths | Default / min | Env var |
|---|---|---|---|
| email | `/api/email/**` | 5 | `RATELIMIT_EMAIL` |
| payment | `/api/paypal/**`, `/api/stripe/**` | 30 | `RATELIMIT_PAYMENT` |
| auth | `/api/account-requests**` | 10 | `RATELIMIT_AUTH` |
| write | any other POST/PUT/PATCH/DELETE under `/api` | 60 | `RATELIMIT_WRITE` |
| read | everything else under `/api` | 600 | `RATELIMIT_READ` |

Exempt: non-`/api` paths, `OPTIONS` preflight, `/api/stripe/webhook` (Stripe's
servers, signature-verified downstream).

Over the limit -> `429` with `Retry-After: 60` and `{"error":"Too many requests. Please slow down."}`.

Disable entirely: `RATELIMIT_ENABLED=false` (already off in the `local` and `test`
profiles).

## Required nginx config

The app only ever sees nginx as the client, so it reads the real caller IP from a
proxy header. The `api.missouristatelacrosse.com` server block **must** set one of
these on the `location / { proxy_pass ... }` that forwards to `:8080`:

```nginx
proxy_set_header X-Real-IP        $remote_addr;
proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
```

`X-Real-IP` is preferred (not client-spoofable; it is the real TCP peer). If neither
header is present every caller shares one bucket and the `read` limit (600/min)
becomes a global cap - the site still works under normal load but the throttle is
much blunter. After adding the lines: `sudo nginx -t && sudo systemctl reload nginx`.

## Tuning

Bump a limit without a redeploy by setting the env var in the systemd unit /
`backend-prod` and restarting `laxsite-backend`. If legitimate traffic ever trips
the `read` limit, raise `RATELIMIT_READ`; the `email` limit is deliberately tight
because those endpoints are unauthenticated and send SES mail.
