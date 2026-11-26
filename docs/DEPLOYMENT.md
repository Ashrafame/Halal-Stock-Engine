# Deployment runbook

## 0. Prerequisites

- Supabase project (Postgres 15+) with `pg_cron`, `pg_net`, `pgcrypto`, `pg_trgm`, `vault` available
- Stripe account with products/prices (or let the admin panel create them)
- Resend account + verified sending domain (email alerts)
- Expo/EAS account (mobile builds + push)
- Vercel or any Next.js host
- GitHub repository with the CI workflow enabled

---

## 1. Database

```bash
supabase login
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations in order
```

The migrations seed three plans and default system variables. For a non-production project, `supabase db reset` also applies `supabase/seed.sql` (12 demo stocks + quotes).

Verify:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;              -- rowsecurity must be true for all

select id, tier, price_monthly_cents, is_active from public.plans order by sort_order;
```

Enable extensions from **Dashboard → Database → Extensions** if the migration could not create them: `pg_cron`, `pg_net`, `pgcrypto`, `pg_trgm`.

### First admin

After the first signup:

```sql
update public.profiles
set role = 'owner'
where email = 'founder@example.com';
```

Then keep at least two owners so the last-owner guard never blocks recovery.

### Cron secrets (Vault)

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<long-random-value>', 'cron_secret');
```

Set the same value as the Edge secret `CRON_SECRET` (next section). Jobs are scheduled by migration `…_seed_and_cron.sql`:

| Job | Schedule | Function |
| --- | --- | --- |
| `evaluate-alerts` | every minute | `evaluate-alerts` |
| `sync-market-data` | `*/5 13-21 * * 1-5` | `sync-market-data` |
| `sync-compliance` | `30 2 * * *` | `sync-compliance` |
| `expire-stock-overrides` | `15 3 * * *` | SQL |
| `purge-old-market-prices` | weekly | SQL |

Check:

```sql
select jobid, jobname, schedule, active from cron.job order by jobname;
select * from cron.job_run_details order by start_time desc limit 20;
```

If Vault secrets are missing, HTTP jobs fail at runtime (visible in `cron.job_run_details`) without breaking the scheduler.

---

## 2. Edge Functions

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  CRON_SECRET=<same value as Vault> \
  APP_URL=https://app.halalstockengine.com \
  ALLOWED_ORIGINS=https://app.halalstockengine.com \
  RESEND_API_KEY=re_xxx \
  ALERT_EMAIL_FROM="Halal Stock Engine <alerts@halalstockengine.app>" \
  EXPO_PUSH_ACCESS_TOKEN=xxx \
  MARKET_DATA_PROVIDER=polygon \
  POLYGON_API_KEY=xxx \
  COMPLIANCE_PROVIDER=zoya \
  ZOYA_API_KEY=xxx \
  ZOYA_API_BASE=https://partner-api.example.com

supabase functions deploy
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

Gateway JWT verification is configured in `supabase/config.toml`:

- **JWT required:** `stripe-checkout`, `stripe-portal`, `admin-api`
- **JWT disabled:** `stripe-webhook` (signature auth), `sync-compliance`, `sync-market-data`, `evaluate-alerts` (cron secret)

Smoke test each worker:

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/evaluate-alerts" \
  -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" -d '{}'
```

Expected: `{"evaluated":0,...}` or `{"skipped":"disabled"}` — never 401 with the correct secret.

---

## 3. Stripe

1. Create the webhook endpoint:
   `https://<ref>.supabase.co/functions/v1/stripe-webhook`
   Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`.
2. Copy the signing secret to `STRIPE_WEBHOOK_SECRET` and redeploy.
3. In **Admin → Plans**, open Pro, check **Create/update Stripe prices on save**, save. This creates the product/prices and archives prior prices. Repeat for Enterprise. Free needs no price.
4. Configure the Billing Portal in Stripe (cancel, update payment method, invoices).
5. Enable the customer portal return URL: `https://app…/dashboard/settings`.

Local testing:

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

---

## 4. Web (Vercel)

Environment variables (Production + Preview):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL=https://app.halalstockengine.com
SUPABASE_SERVICE_ROLE_KEY       # server-only; never NEXT_PUBLIC_
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

Build command `npm run build:web`, root directory `apps/web` (or repository root with the monorepo setting). Node 22.

Supabase Auth URLs:

- Site URL: `https://app.halalstockengine.com`
- Redirect URLs: `https://app.halalstockengine.com/auth/callback`, `https://app.halalstockengine.com`, plus localhost/Expo URLs for development.

Post-deploy checks:

1. `/` renders the hero and top halal stocks.
2. Sign up → profile + default watchlist created by trigger.
3. Language switch to العربية sets `dir="rtl"` and translates the UI.
4. One-click alert on a halal stock appears in `/dashboard/alerts`.
5. `/admin` is forbidden for a normal user; owner sees metrics.
6. Checkout completes with card `4242 4242 4242 4242`; webhook flips the subscription; the plan badge updates.

---

## 5. Mobile (EAS)

```bash
cd apps/mobile
npx eas init
npx eas build:configure
```

Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_API_URL` as EAS environment variables. Never add service-role or Stripe secrets.

Set the real EAS project id in `app.json` (`extra.eas.projectId`), then:

```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
npx eas submit
```

Push notifications require a development/production build (not Expo Go) and valid APNs/FCM credentials. Register a token from **Settings → Enable push**; the alert worker will fan out to `push_tokens`.

RTL: after switching to Arabic, restart the app once to apply native RTL layout. The UI already mirrors key rows immediately.

---

## 6. Post-deploy verification

| Area | Check |
| --- | --- |
| Auth | Email/password + Google/Apple callbacks land on `/dashboard`. |
| RLS | Normal user cannot read another user's alert/portfolio; admin can. |
| Screening | Seed/report status and reasons render; manual override wins over provider sync. |
| Alerts | `cron.job_run_details` shows successful runs; a test alert triggers in-app + email. |
| Billing | Checkout, portal, cancellation and `past_due` events all reconcile. |
| Admin | User suspension blocks RLS helper checks; audit log has the actor. |
| CMS | Editing an Arabic string changes the web UI without a deploy. |
| Observability | `api_usage`, `app_errors` populate; admin metrics reflect them. |
| Mobile | Secure session survives restart; push token row exists for the user. |

---

## 7. Operations

- **Logs:** Supabase → Edge Functions logs, `app_errors`, `api_usage`, `cron.job_run_details`, Vercel logs.
- **Backups:** enable Supabase PITR for production; Stripe is the billing source of truth.
- **Key rotation:** Stripe/provider/Resend secrets → `supabase secrets set` + redeploy. Cron secret → Vault update + secret update.
- **Scaling:** market/compliance workers are bounded by `*_LIMIT` env vars; alerts by `ALERT_MAX_PER_RUN`/`ALERT_BATCH_SIZE` system variables.
- **Rollback:** deploy the previous function version (`supabase functions deploy <name>` from the prior commit); database migrations are additive — roll forward with a new migration rather than editing history.
- **Backfill:** re-run `sync-compliance` / `sync-market-data` manually with the cron secret. Inserts are idempotent per day for compliance and per (stock, ts) for prices.
