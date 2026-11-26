-- =============================================================================
-- Halal Stock Engine — 0002: helper functions, domain triggers, RLS and grants
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('admin', 'owner')
      and p.status = 'active'
  );
$$;

create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('support', 'admin', 'owner')
      and p.status = 'active'
  );
$$;

create or replace function public.is_active_user(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.status = 'active'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_staff(uuid) from public;
revoke all on function public.is_active_user(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
grant execute on function public.is_staff(uuid) to authenticated, service_role;
grant execute on function public.is_active_user(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Auth provisioning: profile + default watchlist on signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale public.locale_code := 'en';
  v_locale_raw text;
  v_name text;
begin
  v_locale_raw := new.raw_user_meta_data ->> 'locale';
  if v_locale_raw in ('en', 'ar', 'es') then
    v_locale := v_locale_raw::public.locale_code;
  end if;

  v_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');

  insert into public.profiles (id, email, full_name, locale)
  values (new.id, new.email, left(v_name, 120), v_locale)
  on conflict (id) do nothing;

  insert into public.watchlists (user_id, name, is_default)
  values (new.id, 'My watchlist', true)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Audit trail for privileged catalog changes
-- -----------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_entity text;
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_after := null;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_before := null;
    v_after := to_jsonb(new);
  end if;

  v_entity := coalesce(
    v_after ->> 'id', v_after ->> 'key',
    v_before ->> 'id', v_before ->> 'key'
  );

  insert into public.audit_logs (
    actor_id, actor_email, action, entity_type, entity_id, before, after
  )
  values (
    v_actor,
    (select p.email from public.profiles p where p.id = v_actor),
    lower(tg_op) || '.' || tg_table_name,
    tg_table_name,
    v_entity,
    v_before,
    v_after
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Plan resolution (used by quota triggers and the API)
-- -----------------------------------------------------------------------------
create or replace function public.user_plan_limits(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := p_user;
  v_result jsonb;
begin
  -- Callers may only read their own entitlements; staff/service may target anyone.
  if auth.uid() is not null
     and p_user <> auth.uid()
     and not public.is_staff() then
    v_user := auth.uid();
  end if;

  with active_plan as (
    select p.id, p.tier, p.limits, p.features
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.user_id = v_user
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
    limit 1
  ),
  fallback_plan as (
    select p.id, p.tier, p.limits, p.features
    from public.plans p
    where p.tier = 'free'
    limit 1
  )
  select jsonb_build_object(
    'planId', coalesce((select id from active_plan), (select id from fallback_plan)),
    'tier', coalesce((select tier from active_plan), (select tier from fallback_plan)),
    'limits', coalesce((select limits from active_plan), (select limits from fallback_plan), '{}'::jsonb),
    'features', coalesce((select features from active_plan), (select features from fallback_plan), '{}'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.user_plan_limits(uuid) from public;
grant execute on function public.user_plan_limits(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Server-side quota & compliance enforcement (defence in depth over RLS)
-- -----------------------------------------------------------------------------
create or replace function public.enforce_alert_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan jsonb;
  v_limits jsonb;
  v_features jsonb;
  v_limit integer;
  v_count integer;
  v_status public.compliance_status;
begin
  if v_uid is not null and new.user_id <> v_uid then
    raise exception 'alert_owner_mismatch' using errcode = '42501';
  end if;

  select s.compliance_status into v_status
  from public.stocks s where s.id = new.stock_id;
  if not found then
    raise exception 'stock_not_found' using errcode = '23503';
  end if;

  -- Only halal names are alertable. Compliance alerts exist precisely to warn
  -- when that stops being true.
  if new.alert_type <> 'compliance' and v_status is distinct from 'halal' then
    raise exception 'compliance_gate' using errcode = '23514';
  end if;

  v_plan := public.user_plan_limits(new.user_id);
  v_limits := coalesce(v_plan -> 'limits', '{}'::jsonb);
  v_features := coalesce(v_plan -> 'features', '{}'::jsonb);

  if new.alert_type = 'indicator'
     and coalesce((v_features ->> 'technicalAlerts')::boolean, false) is not true then
    raise exception 'feature_disabled' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count
    from public.price_alerts a
    where a.user_id = new.user_id and a.status = 'active';

    v_limit := coalesce((v_limits ->> 'maxAlerts')::integer, 3);
    if v_limit <> -1 and v_count >= v_limit then
      raise exception 'alert_limit_reached' using errcode = '23514';
    end if;
  end if;

  new.cooldown_minutes := greatest(
    least(new.cooldown_minutes, 10080),
    coalesce((v_limits ->> 'alertCooldownMinutes')::integer, 1)
  );

  return new;
end;
$$;

create trigger price_alerts_enforce_policy
  before insert or update on public.price_alerts
  for each row execute function public.enforce_alert_policy();

create or replace function public.enforce_watchlist_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_user uuid;
  v_limit integer;
  v_count integer;
begin
  select w.user_id into v_user
  from public.watchlists w where w.id = new.watchlist_id;

  if v_user is null then
    raise exception 'watchlist_not_found' using errcode = '23503';
  end if;
  if v_uid is not null and v_user <> v_uid then
    raise exception 'watchlist_owner_mismatch' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.watchlist_items wi
  join public.watchlists w on w.id = wi.watchlist_id
  where w.user_id = v_user;

  v_limit := coalesce(
    (public.user_plan_limits(v_user) -> 'limits' ->> 'maxWatchlistItems')::integer,
    -1
  );
  if v_limit <> -1 and v_count >= v_limit then
    raise exception 'watchlist_limit_reached' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger watchlist_items_enforce_limit
  before insert on public.watchlist_items
  for each row execute function public.enforce_watchlist_limit();

create or replace function public.enforce_portfolio_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer;
  v_count integer;
begin
  if v_uid is not null and new.user_id <> v_uid then
    raise exception 'portfolio_owner_mismatch' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.portfolios p where p.user_id = new.user_id;

  v_limit := coalesce(
    (public.user_plan_limits(new.user_id) -> 'limits' ->> 'maxPortfolios')::integer,
    -1
  );
  if v_limit <> -1 and v_count >= v_limit then
    raise exception 'portfolio_limit_reached' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger portfolios_enforce_limit
  before insert on public.portfolios
  for each row execute function public.enforce_portfolio_limit();

create or replace function public.enforce_holding_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_limit integer;
  v_count integer;
begin
  select p.user_id into v_owner
  from public.portfolios p where p.id = new.portfolio_id;

  if v_owner is null then
    raise exception 'portfolio_not_found' using errcode = '23503';
  end if;
  if v_uid is not null and v_owner <> v_uid then
    raise exception 'portfolio_owner_mismatch' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.holdings h where h.portfolio_id = new.portfolio_id;

  v_limit := coalesce(
    (public.user_plan_limits(v_owner) -> 'limits' ->> 'maxHoldingsPerPortfolio')::integer,
    -1
  );
  if v_limit <> -1 and v_count >= v_limit then
    raise exception 'holding_limit_reached' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger holdings_enforce_limit
  before insert on public.holdings
  for each row execute function public.enforce_holding_limit();

-- -----------------------------------------------------------------------------
-- Compliance sync: latest report updates the stock and notifies affected users
-- -----------------------------------------------------------------------------
create or replace function public.apply_compliance_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.compliance_status;
  v_symbol text;
begin
  select s.compliance_status, s.symbol into v_previous, v_symbol
  from public.stocks s
  where s.id = new.stock_id
  for update;

  if not found then
    return new;
  end if;

  -- A live manual override wins over provider syncs.
  if new.provider <> 'manual' and exists (
    select 1 from public.stocks s
    where s.id = new.stock_id
      and s.compliance_override is not null
      and (s.override_expires_at is null or s.override_expires_at > now())
  ) then
    update public.stocks
    set last_compliance_check = greatest(
      coalesce(last_compliance_check, 'epoch'::timestamptz),
      new.effective_at
    )
    where id = new.stock_id;
    return new;
  end if;

  update public.stocks
  set compliance_status = new.status,
      compliance_score = coalesce(new.score, compliance_score),
      last_compliance_check = new.effective_at
  where id = new.stock_id;

  if v_previous is distinct from new.status and new.status <> 'halal' then
    insert into public.notifications (user_id, type, title_key, body, data)
    select distinct
      recipients.user_id,
      'compliance_update',
      'alerts.messages.complianceDowngrade',
      v_symbol || ' is now classified as ' || new.status::text || '. Review your holdings.',
      jsonb_build_object(
        'stockId', new.stock_id,
        'symbol', v_symbol,
        'status', new.status::text
      )
    from (
      select po.user_id
      from public.holdings h
      join public.portfolios po on po.id = h.portfolio_id
      where h.stock_id = new.stock_id
      union
      select w.user_id
      from public.watchlist_items wi
      join public.watchlists w on w.id = wi.watchlist_id
      where wi.stock_id = new.stock_id
    ) recipients
    join public.profiles pr
      on pr.id = recipients.user_id
     and pr.status = 'active'
     and pr.notify_push;
  end if;

  return new;
end;
$$;

create trigger compliance_reports_apply
  after insert on public.compliance_reports
  for each row execute function public.apply_compliance_report();

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'plans', 'subscriptions', 'stocks', 'stock_quotes',
    'stock_indicators', 'watchlists', 'portfolios', 'holdings', 'price_alerts',
    'system_variables', 'translations'
  ]
  loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I',
      t, t
    );
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit triggers on privileged catalog tables
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['plans', 'stocks', 'system_variables', 'translations', 'subscriptions']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t, t
    );
  end loop;
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stocks enable row level security;
alter table public.stock_quotes enable row level security;
alter table public.stock_indicators enable row level security;
alter table public.stock_prices enable row level security;
alter table public.compliance_reports enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.price_alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.system_variables enable row level security;
alter table public.translations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.api_usage enable row level security;
alter table public.app_errors enable row level security;
alter table public.stripe_events enable row level security;

-- profiles -------------------------------------------------------------------
create policy profiles_select_own_or_staff on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and public.is_active_user())
  with check (id = (select auth.uid()));

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- plans ----------------------------------------------------------------------
create policy plans_select_public on public.plans
  for select to anon, authenticated
  using (is_active);

create policy plans_select_staff on public.plans
  for select to authenticated
  using (public.is_staff());

create policy plans_write_admin on public.plans
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- subscriptions (service-role writes only) ------------------------------------
create policy subscriptions_select_own_or_staff on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- market data (public research data) ------------------------------------------
create policy stocks_select_all on public.stocks
  for select to anon, authenticated using (is_active);

create policy stocks_select_staff on public.stocks
  for select to authenticated using (public.is_staff());

create policy stocks_write_admin on public.stocks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy stock_quotes_select_all on public.stock_quotes
  for select to anon, authenticated using (true);

create policy stock_quotes_write_admin on public.stock_quotes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy stock_indicators_select_all on public.stock_indicators
  for select to anon, authenticated using (true);

create policy stock_indicators_write_admin on public.stock_indicators
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy stock_prices_select_all on public.stock_prices
  for select to anon, authenticated using (true);

create policy stock_prices_write_admin on public.stock_prices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- compliance reports: authenticated research access; raw payload staff-only
create policy compliance_reports_select_authenticated on public.compliance_reports
  for select to authenticated using (true);

create policy compliance_reports_write_admin on public.compliance_reports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- watchlists -----------------------------------------------------------------
create policy watchlists_select_own_or_staff on public.watchlists
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy watchlists_insert_own on public.watchlists
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy watchlists_update_own on public.watchlists
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()));

create policy watchlists_delete_own on public.watchlists
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());

create policy watchlist_items_select_own on public.watchlist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_id
        and (w.user_id = (select auth.uid()) or public.is_staff())
    )
  );

create policy watchlist_items_insert_own on public.watchlist_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_id
        and w.user_id = (select auth.uid())
        and public.is_active_user()
    )
  );

create policy watchlist_items_delete_own on public.watchlist_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_id
        and w.user_id = (select auth.uid())
    )
  );

-- portfolios -----------------------------------------------------------------
create policy portfolios_select_own_or_staff on public.portfolios
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy portfolios_insert_own on public.portfolios
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy portfolios_update_own on public.portfolios
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()));

create policy portfolios_delete_own on public.portfolios
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());

create policy holdings_select_own on public.holdings
  for select to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and (p.user_id = (select auth.uid()) or public.is_staff())
    )
  );

create policy holdings_insert_own on public.holdings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and p.user_id = (select auth.uid())
        and public.is_active_user()
    )
  );

create policy holdings_update_own on public.holdings
  for update to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = (select auth.uid())
    )
  );

create policy holdings_delete_own on public.holdings
  for delete to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = (select auth.uid())
    )
  );

create policy portfolio_transactions_select_own on public.portfolio_transactions
  for select to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and (p.user_id = (select auth.uid()) or public.is_staff())
    )
  );

create policy portfolio_transactions_insert_own on public.portfolio_transactions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and p.user_id = (select auth.uid())
        and public.is_active_user()
    )
  );

create policy portfolio_transactions_delete_own on public.portfolio_transactions
  for delete to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = (select auth.uid())
    )
  );

-- alerts ---------------------------------------------------------------------
create policy price_alerts_select_own_or_staff on public.price_alerts
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy price_alerts_insert_own on public.price_alerts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy price_alerts_update_own on public.price_alerts
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()));

create policy price_alerts_delete_own on public.price_alerts
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());

create policy alert_events_select_own_or_staff on public.alert_events
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy notification_deliveries_select_own_or_staff on public.notification_deliveries
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- notifications --------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- push tokens ----------------------------------------------------------------
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- CMS ------------------------------------------------------------------------
create policy system_variables_select_public on public.system_variables
  for select to anon, authenticated
  using (is_public);

create policy system_variables_select_staff on public.system_variables
  for select to authenticated
  using (public.is_staff());

create policy system_variables_write_admin on public.system_variables
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy translations_select_all on public.translations
  for select to anon, authenticated using (true);

create policy translations_write_admin on public.translations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- observability --------------------------------------------------------------
create policy audit_logs_select_staff on public.audit_logs
  for select to authenticated
  using (public.is_staff());

create policy api_usage_select_staff on public.api_usage
  for select to authenticated
  using (public.is_staff());

create policy app_errors_select_staff on public.app_errors
  for select to authenticated
  using (public.is_staff());

create policy stripe_events_select_staff on public.stripe_events
  for select to authenticated
  using (public.is_staff());

-- =============================================================================
-- Privileges: deny by default, then grant the minimum needed by clients.
-- RLS is the row filter; these grants are the table/column surface.
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;

grant select on public.plans to anon, authenticated;
grant select on public.stocks to anon, authenticated;
grant select on public.stock_quotes to anon, authenticated;
grant select on public.stock_indicators to anon, authenticated;
grant select on public.stock_prices to anon, authenticated;
grant select on public.translations to anon, authenticated;
grant select on public.system_variables to anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
-- Column-level grant: provider payloads are licensed data and never exposed.
grant select (
  id, stock_id, provider, status, score, ratios, revenue_segments, reasons,
  purification_rate, source_url, reviewed_by, effective_at, expires_at, created_at
) on public.compliance_reports to authenticated;
grant select on public.watchlists to authenticated;
grant select on public.watchlist_items to authenticated;
grant select on public.portfolios to authenticated;
grant select on public.holdings to authenticated;
grant select on public.portfolio_transactions to authenticated;
grant select on public.price_alerts to authenticated;
grant select on public.alert_events to authenticated;
grant select on public.notification_deliveries to authenticated;
grant select on public.notifications to authenticated;
grant select on public.push_tokens to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.api_usage to authenticated;
grant select on public.app_errors to authenticated;
grant select on public.stripe_events to authenticated;

grant update (full_name, avatar_url, locale, timezone, notify_email, notify_push, onboarding_completed, last_seen_at)
  on public.profiles to authenticated;

grant insert, update, delete on public.watchlists to authenticated;
grant insert, delete on public.watchlist_items to authenticated;
grant insert, update, delete on public.portfolios to authenticated;
grant insert, update, delete on public.holdings to authenticated;
grant insert, delete on public.portfolio_transactions to authenticated;
grant insert, update, delete on public.price_alerts to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
grant insert, update, delete on public.push_tokens to authenticated;

grant insert, update, delete on public.plans to authenticated;
grant insert, update, delete on public.stocks to authenticated;
grant insert, update, delete on public.stock_quotes to authenticated;
grant insert, update, delete on public.stock_indicators to authenticated;
grant insert, update, delete on public.stock_prices to authenticated;
grant insert, update, delete on public.compliance_reports to authenticated;
grant insert, update, delete on public.system_variables to authenticated;
grant insert, update, delete on public.translations to authenticated;

grant usage on schema public to anon, authenticated;
