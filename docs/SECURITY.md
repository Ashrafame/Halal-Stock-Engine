# Security model

## 1. Assets and trust boundaries

| Asset | Where it lives | Protection |
| --- | --- | --- |
| User PII (email, name, locale) | `profiles`, `auth.users` | RLS own-row; staff read; never in public views |
| Billing identity | `profiles.stripe_customer_id`, `subscriptions` | Client select only; service-role writes |
| Session tokens | Web httpOnly cookies; mobile SecureStore | SSR cookie refresh; chunked encrypted storage |
| Service role key | Server env / Edge env | Never `NEXT_PUBLIC_`/`EXPO_PUBLIC_`; no client import |
| Stripe secret + webhook secret | Edge env | Server-only; raw-body signature verification |
| Provider payloads | `compliance_reports.raw_payload` | Excluded from column grants; staff not even granted |
| Cron secret | Vault + Edge env | Constant-time header compare; gateway JWT disabled only for workers |
| Admin operations | Edge `admin-api` + SQL RPCs | JWT + profile role re-check, rate limit, audit |

Sensitive mutations always originate from a server context. The web browser and mobile bundle only ever hold the anon key and the user's session.

## 2. Authentication

- Supabase Auth email/password and OAuth (Google/Apple). Password policy: ≥10 chars, letter + number (shared Zod schema, enforced server-side too).
- Web session cookies are refreshed in `apps/web/proxy.ts` (Next 16 proxy) and read via `@supabase/ssr`.
- Mobile uses `expo-secure-store` with chunking for the session JSON; no `AsyncStorage` for tokens.
- OAuth callback exchanges the code server-side (`/auth/callback`), then redirects to a fixed dashboard path.
- `redirect` targets after login are restricted to internal paths (`/…`, not `//…`).
- Checkout success/cancel URLs are validated against the configured app origin, preventing open redirects.
- Admin page rendering and every admin mutation re-check `profiles.role`; middleware is not the authorisation boundary.

## 3. Row Level Security

Every table in `public` has RLS enabled. The CI test `sql-rls.test.ts` fails the build when:

- A new table is created without `ENABLE ROW LEVEL SECURITY`.
- `USING (true)` appears on a user-owned table.
- A user-owned write policy does not reference `auth.uid()`.
- `role` or `status` becomes client-writable on `profiles`.
- `subscriptions`, `audit_logs` or `stripe_events` receive client write grants.
- A `SECURITY DEFINER` function omits `SET search_path = ''`.
- `raw_payload` is included in a client column grant.

Additional database defences:

- **Column grants** restrict profile updates and notification updates (`read_at` only).
- **Quota triggers** reject alert/watchlist/portfolio/holding creation beyond the plan, independent of the UI.
- **Halal gate trigger** rejects price/technical alerts for non-halal stocks.
- **Ownership triggers** reject inserts that spoof another user's `user_id`.
- **`SECURITY DEFINER`** functions pin `search_path = ''`, qualify every object, and check `is_admin()` / ownership internally.
- **Audit triggers** record changes to plans, stocks, subscriptions, variables and translations with actor (when present) and before/after JSON.

### RLS matrix (condensed)

| Table | anon | authenticated user | support | admin/owner | service |
| --- | --- | --- | --- | --- | --- |
| plans (active) | ✓ | ✓ | ✓ | ✓ | ✓ |
| stocks/quotes/prices | ✓ | ✓ | ✓ | ✓ | ✓ |
| compliance_reports | — | read safe columns | ✓ | ✓ | ✓ |
| profiles | — | own read/update | all read | all read + RPC writes | ✓ |
| subscriptions | — | own read | all read | all read | ✓ |
| watchlists/portfolios/alerts | — | own CRUD | read all | read all | ✓ |
| audit/api_errors/stripe_events | — | — | read | read | ✓ |
| translations | ✓ | ✓ | ✓ | write | ✓ |
| system_variables | public rows | public rows | all | write | ✓ |

## 4. Payments

- Webhooks verify `Stripe-Signature` (v1, HMAC-SHA256) against the **raw** request body with a 5-minute tolerance and constant-time comparison before parsing.
- Event ids are persisted in `stripe_events`; duplicate processed/ignored events return 200. Failures return 500 so Stripe retries. The unique event id closes replay/race windows.
- Checkout sessions are created server-side with metadata tying them to the authenticated user; the client never sends a customer id.
- Subscriptions are written only by the service role. Users cannot create, upgrade or extend their own access.
- Admin plan changes call Stripe with proration; downgrade to Free schedules cancellation at period end.
- No card data ever touches the app; Stripe Checkout/Portal are hosted.

## 5. Input validation, abuse and transport

- Zod schemas are shared across web server actions, mobile forms and Edge Functions. Edge payloads are size-limited and parsed with `.strict()`/discriminated unions.
- SQL access is exclusively parameterised through PostgREST; no string-built SQL from user input.
- Rate limits (DB-backed) apply to checkout (10/h), portal (10/h), admin API (120/min). Telemetry failures fail open; authorisation failures always fail closed.
- CORS is an explicit origin allow-list (`APP_URL`, `ALLOWED_ORIGINS`), never `*` for authenticated endpoints.
- Web security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, referrer policy, permissions policy, COOP, HSTS in production.
- Search strings are sanitised before PostgREST `or(...)` filters; dynamic table/column names are never user-controlled.
- Emails escape interpolated values (`escapeHtml`) and render RTL templates per recipient locale.

## 6. Mobile hardening

- Only public Supabase identifiers are bundled (`EXPO_PUBLIC_*`); the service role and Stripe secrets are absent.
- Session storage is SecureStore, not AsyncStorage/MMKV; values are chunked for Android's limit.
- Deep links use a fixed scheme and only static routes; no user-controlled navigation targets are executed.
- Push tokens are per-user rows protected by RLS; registration requires an authenticated session.
- Expo/React Native defaults are kept (`newArchEnabled`), no cleartext HTTP configuration, no debug flags in production builds.
- RTL is applied with `I18nManager`; UI mirrors key rows immediately and fully after restart.

## 7. Secrets and supply chain

- `.env*` is gitignored except `*.example`.
- Vercel/Supabase/EAS secrets are environment-scoped; no secrets in the repo or in client bundles.
- `npm ci` uses the committed lockfile in CI. Dependency audit is recommended before each release: `npm audit --omit=dev`.
- GitHub Actions has `contents: read`; no deployment credentials are stored in the workflow.
- Supabase service role bypasses RLS by design; it is never used in a route without a prior `requireAdmin()`/`requireUser()` check.

## 8. Verification checklist

The schema was applied to a throwaway PostgreSQL 16 cluster and exercised under
`SET ROLE authenticated` with JWT claim stubs. Verified outcomes: 24/24 tables have
RLS; profile/watchlist auto-provisioning; cross-user reads return zero rows; role
escalation and IDOR inserts are blocked; haram price alerts raise `compliance_gate`;
free quota stops at 3 alerts; `raw_payload` is unreadable; anon sees stocks but no
compliance reports; cross-user `user_plan_limits` returns the caller's plan; admin
override and downgrade notification flows work; suspended users cannot act.

Run before each release:

```bash
npm run lint
npm run typecheck
npm test                 # includes SQL/RLS invariants
npm run functions:check
```

Manual checks:

1. Sign in as a normal user, attempt `update profiles set role='admin'` via the client → privilege error.
2. Query another user's alerts → zero rows.
3. Attempt a price alert on a `questionable` stock → `compliance_gate`.
4. Exceed the free alert limit → `alert_limit_reached`.
5. POST a webhook with a tampered body → 400 `invalid_signature`.
6. Call `admin-api` without a token → 401; with a non-admin token → 403.
7. Confirm `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET` do not appear in the web/mobile bundle.
8. In demo mode, every mutation returns a clear read-only message and writes nothing.

## 9. Residual risks / recommended hardening

| Risk | Recommendation |
| --- | --- |
| No CSP yet | Add a nonce-based CSP for Next.js inline scripts at the edge/host. |
| Email/push providers are external | Verify sending domains (SPF/DKIM), rotate keys, poll Expo receipts and prune invalid tokens. |
| DB-backed rate limiting adds write load | Move to Upstash/Redis or gateway limits at scale. |
| Provider adapter contract is partner-specific | Confirm contractual schema and add contract tests against a sandbox. |
| Compliance verdicts can be stale | Surface `last_compliance_check` prominently; add expiry alerts if a report is older than X days. |
| Admin service role in web server | Acceptable for server-only admin reads; consider moving all admin reads to the Edge API for a single audit choke point. |
| No MFA | Enable Supabase MFA for `admin`/`owner` accounts before production. |

## 10. Incident response

1. Revoke/rotate `SUPABASE_SERVICE_ROLE_KEY`, Stripe and provider keys.
2. Rotate the `CRON_SECRET` in Vault and Edge env, then redeploy workers.
3. Inspect `audit_logs` by actor/time and `stripe_events` for anomalies.
4. Suspend affected accounts via admin (`status = suspended`) — RLS helpers require active status.
5. Review `app_errors` and `api_usage` for abuse spikes; add targeted gateway rules.
6. Document the event and add a regression test to `sql-rls.test.ts` or the domain suite.
