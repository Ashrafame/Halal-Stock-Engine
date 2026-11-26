# Architecture

## 1. System overview

```
                         ┌──────────────────────────────┐
                         │        Clients               │
                         │  Next.js web  ·  Expo app    │
                         └──────────────┬───────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
      Supabase Auth              Supabase PostgREST          Edge Functions
   email/OAuth, JWT            RLS-scoped CRUD + RPCs      Stripe · sync · alerts · admin
              │                         │                         │
              └─────────────────────────┼─────────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Supabase Postgres │
                              │ 24 tables · RLS    │
                              │ triggers · views   │
                              └─────┬───────┬─────┘
                                    │       │
                            pg_cron │       │ pg_net (HTTP)
                                    ▼       ▼
                        expire overrides   Edge workers every minute / 5 min / daily
```

**Design rule:** the browser/mobile client never receives a service-role key. Every privileged operation is either:
1. a user-JWT RLS operation, or
2. an Edge Function that re-authenticates the JWT/role before using the service role, or
3. a `SECURITY DEFINER` SQL function with a pinned `search_path` and an explicit authorisation check.

## 2. Repository boundaries

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain core | `packages/shared/src` | Pure, deterministic logic: screening, indicators, alert evaluation, entitlements, formatting, validation, Stripe signature, i18n. No React, no Node APIs, no secrets. |
| Web | `apps/web` | Server-rendered UI, server actions, auth cookie refresh (`proxy.ts`), CMS overrides, admin console. |
| Mobile | `apps/mobile` | Expo Router screens, SecureStore session, push registration, RTL-aware UI. |
| Database | `supabase/migrations` | Schema, enums, constraints, triggers, RLS, views, RPCs, seed, cron. |
| Edge | `supabase/functions` | Trusted server logic and third-party integrations. |

The shared package is consumed as TypeScript source (`transpilePackages` / Metro), so there is no duplicate build step and a type error in domain logic fails all workspaces.

## 3. Data model

```
auth.users 1─1 profiles 1─1 subscriptions ── plans
                    │
                    ├─1..n watchlists ──n..m stocks
                    ├─1..n portfolios ──1..n holdings ──n..1 stocks
                    │                     └─1..n portfolio_transactions
                    ├─1..n price_alerts ──n..1 stocks
                    │           └─1..n alert_events ──1..n notification_deliveries
                    ├─1..n notifications
                    ├─1..n push_tokens
                    └─1..n audit_logs (actor)

stocks 1─1 stock_quotes
       1─1 stock_indicators
       1─n stock_prices
       1─n compliance_reports  (append-only history; latest drives stock state)
```

Operational tables: `system_variables`, `translations`, `api_usage`, `app_errors`, `stripe_events`.

### Key invariants

- `subscriptions.user_id` is unique: one active billing relationship per user.
- `price_alerts` CHECK constraints require a target price for price alerts and an indicator for technical alerts.
- `alert_events.dedupe_key` is unique, providing idempotency for worker retries.
- `stripe_events.id` is the Stripe event id (idempotency).
- Money is integer minor units. Ratios are `numeric` fractions. Timestamps are `timestamptz`.
- Compliance reports are append-only; the trigger `apply_compliance_report` projects the newest report onto `stocks`. A live manual override outranks provider syncs.

## 4. Authorisation model

### Roles

`user` → `support` → `admin` → `owner`, stored on `profiles`.

- `support`: read-only operational access (RLS `is_staff()`).
- `admin`/`owner`: configuration, overrides, user mutations.
- The last owner cannot be demoted; admins cannot suspend themselves.

### Layers

1. **JWT** identifies the caller; `auth.uid()` is the only identity source.
2. **Table grants** limit the column surface. Users cannot write `role`, `status`, `stripe_customer_id`, or subscription rows. Notifications expose only `read_at` for updates.
3. **RLS** binds every user-owned row to `auth.uid()`; service-role-only tables have no client policies.
4. **Triggers** enforce domain quotas and the halal compliance gate server-side.
5. **Edge Functions** verify JWT + profile role before using the service role and write an audit entry.

### Subscription resolution

`user_plan_limits(user)` returns the active plan's `limits`/`features` JSON, falling back to Free when the subscription is absent, expired, or not `active|trialing`. The function refuses cross-user reads from non-staff callers. Free limits are applied as a graceful downgrade rather than a lockout.

## 5. Alerting pipeline

```
pg_cron (every minute)
   └─ pg_net POST /functions/v1/evaluate-alerts   header: x-cron-secret
        ├─ requireCron (constant-time compare)
        ├─ system flag ALERT_ENGINE_ENABLED
        ├─ select active alerts + quote + indicators (+ stock compliance)
        ├─ evaluateAlert() per row (pure shared logic)
        │     ├─ skip inactive/expired/non-halal/cooldown/missing data
        │     ├─ price: above/below/crosses (uses previous close)
        │     └─ indicator: RSI, SMA, MACD, volume spike
        ├─ insert alert_events (unique dedupe key; duplicate => stop)
        ├─ update last_triggered_at (compliance alerts become "triggered")
        └─ dispatch
              ├─ notifications (in-app)
              ├─ Resend email (locale from profile; RTL HTML for Arabic)
              ├─ Expo push (all registered tokens)
              └─ notification_deliveries (sent/failed/skipped + provider id)
```

Price/technical alerts are suppressed for non-halal stocks. Compliance alerts are the inverse: they fire when a stock ceases to be halal.

The evaluator exists twice by necessity: `packages/shared` (tested) and `supabase/functions/_shared` (bundled independently). CI runs unit tests on the canonical copy; keep them in sync when changing rules.

## 6. Billing flow

```
Web plan CTA
  └─ server action → POST /functions/v1/stripe-checkout (user JWT)
       ├─ validate plan + interval, redirect origin allow-list, rate limit
       ├─ reuse/create Stripe customer, persist id on profile
       ├─ create Checkout Session (trial only for first-time subscribers)
       └─ return hosted URL

Stripe → /functions/v1/stripe-webhook
  ├─ verify v1 signature over raw body (HMAC-SHA256, 5-min tolerance)
  ├─ insert stripe_events(id) — duplicate processed/ignored => 200
  ├─ checkout.session.completed → fetch subscription → upsert
  ├─ customer.subscription.* → normalize status/period/plan
  ├─ invoice.paid → re-fetch + reconcile period
  ├─ invoice.payment_failed → past_due + notification
  └─ mark processed | failed (500 lets Stripe retry)
```

Plan changes made in admin call Stripe's subscription update with proration. Downgrading to Free schedules cancellation at period end instead of revoking access immediately. Local plan ids stay in sync; webhooks remain authoritative.

## 7. Compliance pipeline

```
pg_cron (daily 02:30 UTC)
  └─ sync-compliance
       ├─ system flag + provider selection (Zoya | Islamicly)
       ├─ adapter call per stock (concurrency-limited)
       ├─ normalize status/ratios/segments/reasons/purification
       ├─ one report/provider/stock/day (retry-safe)
       └─ INSERT compliance_reports
             └─ trigger: manual override active?  → only bump last_checked
                          otherwise project status/score onto stocks
                          status downgrade → notify holders + watchers
```

If credentials are absent the worker returns `skipped: provider_not_configured`. It never fabricates a verdict. Provider payloads are stored in `raw_payload`, which is excluded from column grants.

## 8. Market data pipeline

```
pg_cron (Mon–Fri 13–21 UTC, every 5 min)
  └─ sync-market-data
       ├─ Polygon snapshot (US exchanges, batched 50)
       ├─ daily aggregates → stock_prices (upsert)
       ├─ indicators (SMA/RSI/MACD/volume) → stock_indicators
       └─ stock_quotes upsert
```

Yahoo Finance is a keyless fallback for development. Requests are logged to `api_usage` with latency/status; provider failures are recorded in `app_errors`. The worker defers the remainder of the universe to the next run (`MARKET_SYNC_INDICATOR_LIMIT`).

## 9. Internationalisation

- English is the canonical dictionary; the `Dictionary` mapped type enforces key/value parity in Arabic and Spanish at compile time.
- `createTranslator(locale, overrides)` falls back to English, then the key.
- Web reads the locale from a cookie or `Accept-Language`, sets `<html lang dir>`, and loads CMS overrides from `translations`.
- Mobile stores the choice in SecureStore, applies `I18nManager` RTL, and mirrors rows using the direction from context.
- Alert emails render per-recipient locale, including RTL HTML.
- Admin CMS writes `translations` rows; no deploy required.

## 10. Failure handling / trade-offs

| Concern | Decision |
| --- | --- |
| Service role in web server | Allowed only after `requireAdmin()`; used for admin reads and no other feature. |
| Duplicate evaluator | Deliberate bundling constraint; canonical version is tested. |
| Decimal money | Plans use integer cents; market prices use `numeric`; UI formatting is `Intl`. |
| Cron secret | Vault-stored, sent as header, constant-time compared. Gateway JWT disabled for cron/webhook routes. |
| Rate limiting | DB-backed counters for checkout/portal/admin; telemetry failure is fail-open, auth failure is fail-closed. |
| Email outages | Delivery is marked failed; in-app notification and push still succeed. |
| Compliance outage | Last known verdict remains visible with its date; no silent reclassification. |
| Demo mode | Only when Supabase is unconfigured (or explicit `HSE_DEMO_MODE=true`); mutations return a demo error. |

## 11. Extending safely

1. Add shared type/schema → migration → RLS test → Edge handler → UI.
2. New public table must ship with `ENABLE ROW LEVEL SECURITY` and a policy in the same migration; CI fails otherwise.
3. New privileged function must be `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified, and revoke `PUBLIC` execute.
4. New locale must update `SUPPORTED_LOCALES`, `LOCALE_META`, the dictionary and the parity test.
5. New provider must implement an adapter and log usage/errors; never write unvalidated provider status directly without normalisation.
