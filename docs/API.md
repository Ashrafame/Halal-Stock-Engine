# API & database contract

All client access goes through Supabase PostgREST with the user's JWT, or through the Edge Functions listed below. There is no custom REST server for CRUD.

## 1. Edge Functions

### `POST /functions/v1/stripe-checkout`

Auth: user JWT (`Authorization: Bearer …`), CORS restricted to `APP_URL`/`ALLOWED_ORIGINS`.

```json
{
  "planId": "pro",
  "interval": "month",
  "successUrl": "https://app.example.com/dashboard/settings?checkout=success",
  "cancelUrl": "https://app.example.com/#pricing"
}
```

Response `{ "url": "https://checkout.stripe.com/…" }`. Errors: `invalid_payload`, `plan_not_found`, `free_plan_needs_no_checkout`, `stripe_price_not_configured`, `invalid_redirect`, `rate_limited`.

### `POST /functions/v1/stripe-portal`

Auth: user JWT. No body. Returns `{ "url": … }` or `no_billing_account`.

### `POST /functions/v1/stripe-webhook`

Auth: `Stripe-Signature` over the raw body. Gateway JWT verification disabled. Idempotent on `event.id`. Handled events:

`checkout.session.completed`, `customer.subscription.created|updated|deleted|trial_will_end`, `invoice.paid`, `invoice.payment_failed`.

Unknown event types are acknowledged and stored with status `ignored`.

### `POST /functions/v1/sync-compliance`

Auth: `x-cron-secret` (constant-time compare) or service-role bearer. Body ignored.

Response: `{ provider, synced, skipped, failed }`. Returns 200 with `skipped: provider_not_configured|disabled|unknown_provider` when it cannot run.

Provider adapter contract:

```jsonc
// Zoya: POST {base}/v1/screen  { "symbols": ["AAPL"] }
// Islamicly: GET {base}/v1/screen/AAPL
{
  "status": "halal | questionable | haram | unknown",
  "score": 0-100,
  "ratios": {
    "debtToAssets": 0.21,
    "interestIncomeRatio": 0.012,
    "nonCompliantRevenueRatio": 0.004,
    "receivablesToAssets": 0.28
  },
  "revenue_segments": [{ "name": "Hardware", "share": 0.98, "prohibited": false }],
  "reasons": ["screening.reasons.requires_review"],
  "purification_rate": 0.016,
  "source_url": "https://…"
}
```

The full provider payload is stored in `compliance_reports.raw_payload` (never granted to clients).

### `POST /functions/v1/sync-market-data`

Auth: cron secret/service role. Body ignored. Environment:

- `MARKET_DATA_PROVIDER=polygon|yahoo`
- `POLYGON_API_KEY`, `MARKET_SYNC_MAX_STOCKS`, `MARKET_SYNC_INDICATOR_LIMIT`

Returns counts and the deferred symbol count.

### `POST /functions/v1/evaluate-alerts`

Auth: cron secret/service role. Body ignored. Returns `{ evaluated, triggered, delivered, failed }`.

### `GET /functions/v1/admin-api?resource=…`

Auth: admin/owner JWT. Resources: `metrics`, `users&page=&pageSize=&search=`, `audit`, `plans`, `variables`, `errors`.

### `POST|PATCH /functions/v1/admin-api`

Auth: admin/owner JWT. Discriminated by `action`:

| `action` | Payload |
| --- | --- |
| `update_user` | `userId`, optional `role`, `status`, `locale`, `planId`, `suspendReason` |
| `save_plan` | `{ plan }` (id, tier, name, description, prices in cents, currency, trialDays, limits, features, isActive, sortOrder, syncStripe) |
| `set_stock_override` | `stockId`, `status`, optional `score`, `reason` (≥10 chars), `expiresAt` |
| `clear_stock_override` | `stockId` |
| `upsert_translation` | `locale`, `namespace`, `key`, `value` |
| `upsert_variable` | `key` (UPPER_SNAKE), `value` (JSON), `description`, `category`, `isPublic` |
| `delete_variable` | `key` |
| `broadcast` | `titleKey`, `body`, `audience: all|free|pro|enterprise` |

All mutations are rate-limited and audited.

## 2. RPCs exposed to clients

| Function | Caller | Purpose |
| --- | --- | --- |
| `get_top_halal_stocks(p_limit)` | anon, authenticated | Ranked halal read model for landing/dashboard |
| `get_admin_metrics()` | authenticated admin | JSON dashboard metrics (definer + `is_admin()`) |
| `set_stock_compliance_override(...)` | authenticated admin | Append manual report + set override + audit |
| `clear_stock_compliance_override(stock)` | authenticated admin | Revert to latest provider report |
| `admin_update_user(...)` | authenticated admin | Guarded role/status/locale updates |
| `broadcast_notification(title, body, audience)` | authenticated admin | In-app broadcast |
| `user_plan_limits(user)` | authenticated | Own plan limits/features (staff may target others) |

Not client-callable: `expire_stock_overrides()` (service role), `is_admin/is_staff`, and internal trigger functions.

## 3. Tables and RLS summary

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | own row; staff all | own profile columns only; role/status via RPC/Edge |
| `plans` | active rows public; staff all | admin RLS policy |
| `subscriptions` | own; staff all | service role only |
| `stocks`, `stock_quotes`, `stock_indicators`, `stock_prices` | public research data | admin RPC/policy |
| `compliance_reports` | authenticated (safe columns); staff all | admin / service role; `raw_payload` never granted |
| `watchlists`, `watchlist_items` | own; staff all | own only, quota trigger |
| `portfolios`, `holdings`, `portfolio_transactions` | own; staff all | own only, quota trigger |
| `price_alerts` | own; staff all | own only, halal gate + quota trigger |
| `alert_events`, `notification_deliveries` | own; staff all | service role only |
| `notifications` | own | update `read_at` only; service inserts |
| `push_tokens` | own | own only |
| `system_variables` | public rows; staff all | admin policy |
| `translations` | public | admin policy |
| `audit_logs`, `api_usage`, `app_errors`, `stripe_events` | staff only | service role only |

Exact policies: `supabase/migrations/20261125090100_functions_triggers_rls.sql`. The static guard in `packages/shared/tests/sql-rls.test.ts` enforces these invariants in CI.

## 4. Views

- `v_stock_overview` — stock + quote + indicators + latest compliance summary.
- `v_latest_compliance` — safe compliance report columns.
- `v_alert_overview` — alert + stock + current price.
- `v_portfolio_positions` — computed market value/cost/P&L.
- `v_user_entitlements` — effective plan, limits, features, subscription window.
- `v_admin_users` — profile + subscription join.
- `v_admin_metrics` — aggregated metrics; granted to `service_role` only.

## 5. Error codes returned by triggers

| Code | Meaning |
| --- | --- |
| `alert_limit_reached` | Plan alert quota exhausted |
| `feature_disabled` | Technical alerts require Pro |
| `compliance_gate` | Only halal stocks may receive price alerts |
| `watchlist_limit_reached` | Watchlist quota exhausted |
| `portfolio_limit_reached` | Portfolio quota exhausted |
| `holding_limit_reached` | Holdings quota exhausted |
| `alert_owner_mismatch` / `portfolio_owner_mismatch` | Identity spoof attempt |

The web `mapDbError` helper maps these to user-facing messages.
