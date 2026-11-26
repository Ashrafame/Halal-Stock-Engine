-- =============================================================================
-- Halal Stock Engine — 0001: extensions, enum types and core tables
-- Postgres 15+ (Supabase). All application state lives in `public`.
-- Money is stored in integer minor units; ratios as numeric fractions (0..1).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.locale_code as enum ('en', 'ar', 'es');
create type public.user_role as enum ('user', 'support', 'admin', 'owner');
create type public.user_status as enum ('active', 'suspended', 'pending', 'deleted');
create type public.plan_tier as enum ('free', 'pro', 'enterprise');
create type public.billing_interval as enum ('month', 'year');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'unpaid',
  'incomplete', 'incomplete_expired', 'paused'
);
create type public.compliance_status as enum ('halal', 'questionable', 'haram', 'unknown');
create type public.compliance_provider as enum ('zoya', 'islamicly', 'internal', 'manual');
create type public.alert_type as enum ('price', 'indicator', 'compliance');
create type public.alert_operator as enum ('above', 'below', 'crosses_above', 'crosses_below');
create type public.alert_status as enum ('active', 'paused', 'triggered', 'expired');
create type public.indicator_name as enum ('rsi_14', 'sma_20', 'sma_50', 'sma_200', 'macd', 'volume_spike');
create type public.notification_channel as enum ('push', 'email', 'in_app');
create type public.delivery_status as enum ('queued', 'sent', 'failed', 'skipped');
create type public.transaction_type as enum ('buy', 'sell', 'dividend', 'fee');
create type public.stripe_event_status as enum ('received', 'processed', 'ignored', 'failed');

-- -----------------------------------------------------------------------------
-- profiles — one row per auth.users row, created by trigger
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  avatar_url text,
  locale public.locale_code not null default 'en',
  role public.user_role not null default 'user',
  status public.user_status not null default 'active',
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  stripe_customer_id text,
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  onboarding_completed boolean not null default false,
  suspended_reason text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile + RBAC role. Role/status are writable only through admin RPCs.';

create unique index profiles_email_lower_key
  on public.profiles (lower(email))
  where email is not null;
create index profiles_role_idx on public.profiles (role) where role <> 'user';
create index profiles_created_at_idx on public.profiles (created_at desc);
create unique index profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- -----------------------------------------------------------------------------
-- plans — editable pricing catalogue, mirrored into Stripe price objects
-- -----------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  tier public.plan_tier not null unique,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  price_monthly_cents integer not null default 0 check (price_monthly_cents >= 0),
  price_yearly_cents integer not null default 0 check (price_yearly_cents >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  stripe_product_id text,
  stripe_price_monthly_id text,
  stripe_price_yearly_id text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.plans.limits is
  'camelCase keys: maxAlerts, maxWatchlistItems, maxPortfolios, maxHoldingsPerPortfolio, apiRequestsPerDay, alertCooldownMinutes. -1 means unlimited.';

-- -----------------------------------------------------------------------------
-- subscriptions — Stripe is the source of truth; writes are service-role only
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id) on delete restrict,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status public.subscription_status not null,
  billing_interval public.billing_interval not null default 'month',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- -----------------------------------------------------------------------------
-- stocks + market data
-- -----------------------------------------------------------------------------
create table public.stocks (
  id uuid primary key default gen_random_uuid(),
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,16}$'),
  exchange text not null check (char_length(exchange) between 2 and 16),
  name text not null check (char_length(name) between 1 and 200),
  name_ar text,
  name_es text,
  sector text not null default 'Unknown',
  industry text,
  country char(2) not null default 'US',
  currency char(3) not null default 'USD',
  logo_url text,
  market_cap numeric(22, 2) check (market_cap is null or market_cap >= 0),
  compliance_status public.compliance_status not null default 'unknown',
  compliance_score numeric(5, 2) check (compliance_score is null or compliance_score between 0 and 100),
  compliance_override public.compliance_status,
  override_reason text,
  override_expires_at timestamptz,
  last_compliance_check timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, exchange)
);

create index stocks_status_idx on public.stocks (compliance_status) where is_active;
create index stocks_score_idx on public.stocks (compliance_score desc nulls last) where is_active;
create index stocks_sector_idx on public.stocks (sector);
create index stocks_name_trgm_idx on public.stocks using gin (name extensions.gin_trgm_ops);
create index stocks_symbol_trgm_idx on public.stocks using gin (symbol extensions.gin_trgm_ops);

create table public.stock_quotes (
  stock_id uuid primary key references public.stocks (id) on delete cascade,
  price numeric(18, 6) not null check (price >= 0),
  previous_close numeric(18, 6) not null check (previous_close >= 0),
  change numeric(18, 6) not null default 0,
  change_percent numeric(10, 6) not null default 0,
  day_high numeric(18, 6),
  day_low numeric(18, 6),
  volume bigint check (volume is null or volume >= 0),
  source text not null default 'unknown',
  as_of timestamptz not null,
  updated_at timestamptz not null default now()
);

create index stock_quotes_as_of_idx on public.stock_quotes (as_of desc);

create table public.stock_indicators (
  stock_id uuid primary key references public.stocks (id) on delete cascade,
  as_of timestamptz not null,
  sma_20 numeric(18, 6),
  sma_50 numeric(18, 6),
  sma_200 numeric(18, 6),
  rsi_14 numeric(6, 3) check (rsi_14 is null or rsi_14 between 0 and 100),
  macd numeric(18, 6),
  macd_signal numeric(18, 6),
  volume_avg_20 numeric(20, 2),
  updated_at timestamptz not null default now()
);

create table public.stock_prices (
  id bigint generated always as identity primary key,
  stock_id uuid not null references public.stocks (id) on delete cascade,
  ts timestamptz not null,
  open numeric(18, 6) not null,
  high numeric(18, 6) not null,
  low numeric(18, 6) not null,
  close numeric(18, 6) not null,
  volume bigint not null default 0,
  source text not null default 'unknown',
  created_at timestamptz not null default now(),
  unique (stock_id, ts)
);

create index stock_prices_stock_ts_idx on public.stock_prices (stock_id, ts desc);
create index stock_prices_ts_idx on public.stock_prices (ts desc);

-- -----------------------------------------------------------------------------
-- compliance_reports — append-only audit trail; latest report drives the stock
-- -----------------------------------------------------------------------------
create table public.compliance_reports (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.stocks (id) on delete cascade,
  provider public.compliance_provider not null,
  status public.compliance_status not null,
  score numeric(5, 2) check (score is null or score between 0 and 100),
  ratios jsonb not null default '{}'::jsonb,
  revenue_segments jsonb not null default '[]'::jsonb,
  reasons text[] not null default '{}',
  purification_rate numeric(7, 6) check (
    purification_rate is null or purification_rate between 0 and 1
  ),
  source_url text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index compliance_reports_stock_idx
  on public.compliance_reports (stock_id, effective_at desc);
create index compliance_reports_provider_idx on public.compliance_reports (provider);

-- -----------------------------------------------------------------------------
-- watchlists
-- -----------------------------------------------------------------------------
create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create unique index watchlists_one_default_per_user
  on public.watchlists (user_id) where is_default;

create table public.watchlist_items (
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (watchlist_id, stock_id)
);

create index watchlist_items_stock_idx on public.watchlist_items (stock_id);

-- -----------------------------------------------------------------------------
-- portfolios
-- -----------------------------------------------------------------------------
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  base_currency char(3) not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  is_simulated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete restrict,
  shares numeric(20, 8) not null check (shares > 0),
  average_cost numeric(18, 6) not null check (average_cost >= 0),
  opened_at timestamptz not null default now(),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, stock_id)
);

create index holdings_stock_idx on public.holdings (stock_id);

create table public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete restrict,
  type public.transaction_type not null,
  shares numeric(20, 8) not null default 0 check (shares >= 0),
  price numeric(18, 6) not null default 0 check (price >= 0),
  fees numeric(18, 6) not null default 0 check (fees >= 0),
  executed_at timestamptz not null default now(),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index portfolio_transactions_portfolio_idx
  on public.portfolio_transactions (portfolio_id, executed_at desc);

-- -----------------------------------------------------------------------------
-- alerts + delivery history
-- -----------------------------------------------------------------------------
create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,
  alert_type public.alert_type not null default 'price',
  operator public.alert_operator not null default 'above',
  target_price numeric(18, 6) check (target_price is null or target_price > 0),
  indicator public.indicator_name,
  threshold numeric(18, 6) check (threshold is null or threshold >= 0),
  params jsonb not null default '{}'::jsonb,
  status public.alert_status not null default 'active',
  cooldown_minutes integer not null default 30 check (cooldown_minutes between 1 and 10080),
  last_triggered_at timestamptz,
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_alert_requires_target check (
    alert_type <> 'price' or target_price is not null
  ),
  constraint indicator_alert_requires_indicator check (
    alert_type <> 'indicator' or indicator is not null
  )
);

create index price_alerts_user_idx on public.price_alerts (user_id, status);
create index price_alerts_active_idx on public.price_alerts (stock_id) where status = 'active';

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.price_alerts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,
  outcome text not null check (outcome in ('triggered', 'not_triggered', 'skipped')),
  observed_value numeric(18, 6),
  target_value numeric(18, 6),
  message_key text not null,
  skip_reason text,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  triggered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index alert_events_user_idx on public.alert_events (user_id, triggered_at desc);
create index alert_events_alert_idx on public.alert_events (alert_id, triggered_at desc);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_event_id uuid references public.alert_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel public.notification_channel not null,
  status public.delivery_status not null default 'queued',
  provider_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_deliveries_user_idx
  on public.notification_deliveries (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- in-app notifications + push tokens
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'system',
  title_key text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique check (char_length(token) between 8 and 512),
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- -----------------------------------------------------------------------------
-- CMS: system variables + translation overrides
-- -----------------------------------------------------------------------------
create table public.system_variables (
  key text primary key check (key ~ '^[A-Z][A-Z0-9_]{1,99}$'),
  value jsonb not null,
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'general',
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.translations (
  id uuid primary key default gen_random_uuid(),
  locale public.locale_code not null,
  namespace text not null check (char_length(namespace) between 1 and 64),
  key text not null check (key ~ '^[A-Za-z0-9_.-]{1,200}$'),
  value text not null check (char_length(value) between 1 and 5000),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale, namespace, key)
);

create index translations_lookup_idx on public.translations (locale, namespace, key);

-- -----------------------------------------------------------------------------
-- observability & billing idempotency
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.api_usage (
  id bigint generated always as identity primary key,
  provider text not null,
  endpoint text not null,
  status_code integer,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  cost_units numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index api_usage_created_idx on public.api_usage (created_at desc);
create index api_usage_provider_idx on public.api_usage (provider, created_at desc);

create table public.app_errors (
  id bigint generated always as identity primary key,
  level text not null default 'error' check (level in ('debug', 'info', 'warn', 'error', 'fatal')),
  message text not null,
  stack text,
  context jsonb not null default '{}'::jsonb,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index app_errors_created_idx on public.app_errors (created_at desc);

create table public.stripe_events (
  id text primary key,
  type text not null,
  status public.stripe_event_status not null default 'received',
  error text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index stripe_events_created_idx on public.stripe_events (created_at desc);
create index stripe_events_status_idx on public.stripe_events (status);
