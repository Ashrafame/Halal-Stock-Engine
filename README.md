# Halal Stock Engine

**Sharia-compliant stock screening, one-click alerting and portfolio tracking — for web and mobile.**

[![CI](https://github.com/Ashrafame/Halal-Stock-Engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Ashrafame/Halal-Stock-Engine/actions/workflows/ci.yml)

Halal Stock Engine helps investors answer one question quickly and honestly: *is this stock permissible for me, why, and what changed?* It combines explainable AAOIFI-style screening with real-time market data, a background alerting worker, portfolio tracking and a fully localised experience in **English, Arabic (native RTL) and Spanish**.

> This is an information tool, not a fatwa or investment adviser. Screening methodologies differ; verify material decisions with a qualified scholar.

---

## What is included

| Area | Implementation |
| --- | --- |
| **Web** | Next.js 16 App Router, React 19, Tailwind v4. Marketing site, auth, dashboard, screener, alerts, portfolio, settings and a six-section admin console. |
| **Mobile** | Expo SDK 58 + expo-router, iOS/Android. Secure session storage, push tokens, RTL-aware UI, one-tap alerts. |
| **Shared domain** | TypeScript package with the screening engine, alert evaluator, technical indicators, entitlements, Stripe signature verification, Zod schemas and complete i18n dictionaries. 120+ unit tests. |
| **Database** | Supabase Postgres. 24 tables, enums, triggers, quota enforcement, audit trail, RLS on every table, column-level grants, background jobs. |
| **Edge Functions** | Stripe webhook + checkout + portal, compliance sync, market-data sync, alert evaluation and a hardened admin API. |
| **Billing** | Stripe Checkout, Billing Portal, webhook-driven subscription sync, idempotency table, proration-aware plan changes. |
| **Admin** | RBAC (`user` → `support` → `admin` → `owner`), user suspension/roles/plans, Stripe price sync, compliance overrides, CMS translations, system flags, broadcasts, audit + error logs. |
| **CI/CD** | GitHub Actions: ESLint, TypeScript across all workspaces, unit + SQL/RLS tests, Next.js production build, Deno typecheck for every Edge Function. |

---

## Monorepo layout

```
.
├── apps/
│   ├── web/                 # Next.js 16 (App Router) + Tailwind v4
│   └── mobile/              # Expo 58 / expo-router
├── packages/
│   └── shared/              # @hse/shared — domain logic, i18n, validation, tests
├── supabase/
│   ├── migrations/          # schema, RLS, triggers, views, cron seed
│   ├── functions/           # Deno Edge Functions + shared helpers
│   ├── seed.sql             # local demo catalogue
│   └── config.toml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
├── scripts/                 # asset generation and operational helpers
└── .github/workflows/ci.yml
```

---

## Quick start

### Prerequisites

- Node.js **≥ 20.19** (CI uses 22)
- npm 10+
- Docker (for local Supabase) and the [Supabase CLI](https://supabase.com/docs/guides/cli)
- Deno 2 (optional, for Edge Function checks)
- Stripe CLI (optional, for webhook forwarding)

### 1. Install and run the web app in demo mode

```bash
npm install
npm run dev:web
```

Open **http://localhost:3000** in your browser (the URL is not part of the command).
If port 3000 is already in use, Next.js prints the alternate port it chose.

With no Supabase env vars the app serves **clearly-labelled read-only demo data**. The full landing page, dashboard, screener, alerts, portfolio and admin console are explorable; mutations are disabled. There is no authentication bypass against a real project.

### 2. Start the real local stack

```bash
cp .env.example .env.local
supabase start
supabase db reset
npm run dev:web
```

Add the printed keys to `.env.local` (and to `apps/mobile/.env.local` using `EXPO_PUBLIC_*` names). Seed data includes 12 screened stocks and quotes.

Create your first admin after signing up:

```sql
update public.profiles
set role = 'owner'
where email = 'you@example.com';
```

### 3. Edge Functions

```bash
cp .env.example supabase/.env.local
supabase functions serve --env-file supabase/.env.local
supabase functions deploy
```

Fill Stripe/provider secrets in `supabase/.env.local` first.

`stripe-webhook`, `sync-*` and `evaluate-alerts` have JWT verification disabled at the gateway and authenticate with a Stripe signature or the `x-cron-secret` header instead. `admin-api`, `stripe-checkout` and `stripe-portal` require a user JWT.

### 4. Mobile

```bash
cp .env.example apps/mobile/.env.local
npm run dev:mobile
```

Keep only `EXPO_PUBLIC_*` values in that file. Press `i` for iOS, `a` for Android, or scan the QR code.

Expo Go supports the full UI. Push notifications require a development build (`npx eas build --profile development`).

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev:web` | Next.js dev server |
| `npm run dev:mobile` | Expo dev server |
| `npm run build:web` | Production web build |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm run typecheck` | `tsc --noEmit` in shared, web and mobile |
| `npm test` | Vitest unit + SQL security suites |
| `npm run test:coverage` | Coverage with enforced thresholds |
| `npm run db:verify` | Static RLS/SQL guard (runs in CI) |
| `npm run functions:check` | `deno check` every Edge Function |
| `npm run db:reset` | Local Supabase migrations + seed |
| `npm run functions:deploy` | Deploy Edge Functions |
| `npm run format` | Prettier |

---

## Configuration

Every secret is server-side only. **Never** use `NEXT_PUBLIC_`/`EXPO_PUBLIC_` for the Supabase service role, Stripe secret or provider keys.

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Public Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | web server, Edge | Admin reads/writes after RBAC checks |
| `NEXT_PUBLIC_APP_URL` | web | Redirect allow-list and metadata |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Edge | Billing API + signature verification |
| `CRON_SECRET` | Edge + Vault | Worker authentication |
| `ZOYA_API_KEY` / `ISLAMICLY_API_KEY` + `*_API_BASE` | Edge | Compliance provider adapters |
| `MARKET_DATA_PROVIDER`, `POLYGON_API_KEY` | Edge | Quote/history ingestion |
| `RESEND_API_KEY`, `ALERT_EMAIL_FROM` | Edge | Localised alert emails |
| `EXPO_PUSH_ACCESS_TOKEN` | Edge | Expo push delivery |
| `EXPO_PUBLIC_SUPABASE_*` | mobile | Only public identifiers |

Full matrix: [`.env.example`](./.env.example).

---

## How the core systems work

### Screening engine (`packages/shared/src/sharia`)

Business-activity screen plus AAOIFI-style ratios:

- interest-bearing debt / assets ≤ **33%**
- interest income / revenue ≤ **5%**
- non-compliant revenue / revenue ≤ **5%**
- receivables / assets ≤ **49%**

Values within 15% of a ceiling are marked **questionable** rather than halal. Hard failures dominate. Every assessment returns per-check results, a score, purification rate and localised reason keys. Admin overrides are versioned as `compliance_reports` rows with `provider = 'manual'`, an auditable reason and optional expiry.

### Alert engine

`evaluate-alerts` runs every minute via `pg_cron → pg_net`. It evaluates only **halal** names for price/indicator alerts, enforces per-alert cooldowns, requires real crossings for `crosses_*`, deduplicates by minute key, writes `alert_events`, then fans out in-app + localised email + Expo push. Compliance alerts fire when a holding stops being halal. Server-side triggers reject non-halal alerts and plan quota overruns even if a client bypasses the UI.

### Billing

Stripe Checkout and Billing Portal are called from Edge Functions with the user's JWT. The webhook verifies `Stripe-Signature` over the **raw body** before parsing, stores the event id for idempotency, and upserts subscriptions by user. Expired/cancelled subscriptions fall back to free entitlements without locking users out. Saving a plan in admin can create a new Stripe product/price and archive the previous price.

### Admin RBAC

Role lives on `profiles` and is **not writable by clients** (column grants revoked; RPC/Edge re-checks `is_admin()`). Every privileged action is recorded in `audit_logs`. Analytics are exposed through a service-role-only view, never granted to browser roles.

---

## i18n & RTL

- Typed dictionaries live in `packages/shared/src/i18n/locales`. English is canonical; Arabic and Spanish are structurally enforced, so a missing key fails the build/tests.
- `ar` sets `dir="rtl"` on web and drives RTL-aware layout/icons; mobile applies native RTL via `I18nManager` (effective after restart) and mirrors key rows immediately.
- Admin CMS edits `public.translations`, which are merged over the bundled strings at request time. Numbers/currencies use `Intl` with Latin digits for financial readability.

---

## Testing & quality gates

```bash
npm run lint && npm run typecheck && npm test && npm run build:web
```

- 120+ tests cover screening, purification, alert evaluation, cooldowns, indicators, entitlements, Stripe signatures, billing normalisation, input validation, portfolio math, i18n parity and formatting.
- `sql-rls.test.ts` parses the migrations and fails if any public table lacks RLS, if a user-owned table gets a `USING (true)` write policy, if profile role/status become client-writable, if a `SECURITY DEFINER` function omits `search_path`, or if billing/audit writes are granted to clients.
- CI additionally type-checks every Edge Function with Deno.

---

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — data flows, schema map, decisions and trade-offs
- [API & database contract](./docs/API.md) — tables, RPCs, Edge routes and payloads
- [Security model](./docs/SECURITY.md) — RLS matrix, secret boundaries, threat model, audit checklist
- [Deployment runbook](./docs/DEPLOYMENT.md) — Supabase, Stripe, cron/Vault, Vercel, EAS
- [Contributing](./CONTRIBUTING.md)

## Known limitations / next steps

- Compliance adapters expect a partner API shape documented in `docs/API.md`; Zoya/Islamicly access is contractual. Without credentials the worker **skips** rather than inventing verdicts.
- Push delivery uses Expo's push service; a production setup should also handle receipt polling and token pruning.
- Compliance report PDFs, tax lots, broker imports, realtime websockets and team/enterprise seat management are intentionally out of scope for this foundation.
- CSP is not enabled yet because Next.js inline scripts need a nonce strategy; baseline hardening headers are enabled.
