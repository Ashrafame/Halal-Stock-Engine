-- =============================================================================
-- Halal Stock Engine — 0003: read models, admin RPCs and maintenance functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Read models (security_invoker => underlying RLS still applies)
-- -----------------------------------------------------------------------------
create view public.v_stock_overview
with (security_invoker = true)
as
select
  s.id,
  s.symbol,
  s.exchange,
  s.name,
  s.name_ar,
  s.name_es,
  s.sector,
  s.industry,
  s.country,
  s.currency,
  s.logo_url,
  s.market_cap,
  s.compliance_status,
  s.compliance_score,
  s.compliance_override,
  s.override_reason,
  s.override_expires_at,
  s.last_compliance_check,
  s.is_active,
  s.created_at,
  s.updated_at,
  q.price,
  q.previous_close,
  q.change,
  q.change_percent,
  q.day_high,
  q.day_low,
  q.volume,
  q.as_of,
  i.rsi_14,
  i.sma_20,
  i.sma_50,
  i.sma_200,
  i.macd,
  i.macd_signal,
  latest.provider,
  latest.purification_rate,
  latest.ratios
from public.stocks s
left join public.stock_quotes q on q.stock_id = s.id
left join public.stock_indicators i on i.stock_id = s.id
left join lateral (
  select r.provider, r.purification_rate, r.ratios
  from public.compliance_reports r
  where r.stock_id = s.id
  order by r.effective_at desc
  limit 1
) latest on true;

create view public.v_latest_compliance
with (security_invoker = true)
as
select
  r.id,
  r.stock_id,
  r.provider,
  r.status,
  r.score,
  r.ratios,
  r.revenue_segments,
  r.reasons,
  r.purification_rate,
  r.source_url,
  r.reviewed_by,
  r.effective_at,
  r.expires_at
from public.compliance_reports r
where r.id = (
  select r2.id
  from public.compliance_reports r2
  where r2.stock_id = r.stock_id
  order by r2.effective_at desc
  limit 1
);

create view public.v_alert_overview
with (security_invoker = true)
as
select
  a.id,
  a.user_id,
  a.stock_id,
  a.alert_type,
  a.operator,
  a.target_price,
  a.indicator,
  a.threshold,
  a.params,
  a.status,
  a.cooldown_minutes,
  a.last_triggered_at,
  a.notify_email,
  a.notify_push,
  a.expires_at,
  a.created_at,
  s.symbol,
  s.name,
  s.exchange,
  s.compliance_status,
  q.price as current_price
from public.price_alerts a
join public.stocks s on s.id = a.stock_id
left join public.stock_quotes q on q.stock_id = a.stock_id;

create view public.v_portfolio_positions
with (security_invoker = true)
as
select
  h.id,
  h.portfolio_id,
  po.user_id,
  po.name as portfolio_name,
  po.base_currency,
  po.is_simulated,
  h.stock_id,
  h.shares,
  h.average_cost,
  h.opened_at,
  s.symbol,
  s.name,
  s.exchange,
  s.compliance_status,
  q.price,
  coalesce(q.price, h.average_cost) as current_price,
  round(h.shares * coalesce(q.price, h.average_cost), 2) as market_value,
  round(h.shares * h.average_cost, 2) as cost_basis,
  round(h.shares * (coalesce(q.price, h.average_cost) - h.average_cost), 2) as unrealized_pnl
from public.holdings h
join public.portfolios po on po.id = h.portfolio_id
join public.stocks s on s.id = h.stock_id
left join public.stock_quotes q on q.stock_id = h.stock_id;

create view public.v_user_entitlements
with (security_invoker = true)
as
select
  p.id as user_id,
  p.role,
  p.status,
  p.locale,
  (plan.value ->> 'planId') as plan_id,
  (plan.value ->> 'tier')::public.plan_tier as tier,
  coalesce(plan.value -> 'limits', '{}'::jsonb) as limits,
  coalesce(plan.value -> 'features', '{}'::jsonb) as features,
  s.status as subscription_status,
  s.billing_interval,
  s.current_period_end,
  s.cancel_at_period_end,
  s.trial_end
from public.profiles p
left join lateral (
  select public.user_plan_limits(p.id) as value
) plan on true
left join public.subscriptions s on s.user_id = p.id;

create view public.v_admin_users
with (security_invoker = true)
as
select
  p.id,
  p.email,
  p.full_name,
  p.avatar_url,
  p.locale,
  p.role,
  p.status,
  p.timezone,
  p.notify_email,
  p.notify_push,
  p.onboarding_completed,
  p.last_seen_at,
  p.created_at,
  p.updated_at,
  s.plan_id,
  s.status as subscription_status,
  s.billing_interval,
  s.current_period_end,
  s.cancel_at_period_end,
  s.trial_end
from public.profiles p
left join public.subscriptions s on s.user_id = p.id;

-- Aggregated admin metrics. Only exposed to the service role (the admin Edge
-- Function re-checks RBAC before reading it), never granted to clients.
create view public.v_admin_metrics
with (security_invoker = true)
as
select jsonb_build_object(
  'totalUsers', (select count(*) from public.profiles where status <> 'deleted'),
  'activeUsers30d', (
    select count(*) from public.profiles
    where status = 'active' and last_seen_at > now() - interval '30 days'
  ),
  'newUsers7d', (
    select count(*) from public.profiles where created_at > now() - interval '7 days'
  ),
  'activeSubscriptions', (
    select count(*) from public.subscriptions where status in ('active', 'trialing')
  ),
  'trialingSubscriptions', (
    select count(*) from public.subscriptions where status = 'trialing'
  ),
  'mrrCents', (
    select coalesce(sum(
      case when s.billing_interval = 'year'
        then round(p.price_yearly_cents / 12.0)
        else p.price_monthly_cents
      end
    ), 0)::bigint
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.status in ('active', 'trialing')
  ),
  'churnRate', (
    select case
      when count(*) = 0 then 0
      else round(
        count(*) filter (where canceled_at > now() - interval '30 days')::numeric
        / count(*)::numeric, 4)
    end
    from public.subscriptions
    where status in ('active', 'trialing', 'canceled')
  ),
  'alertsActive', (select count(*) from public.price_alerts where status = 'active'),
  'alertsTriggered24h', (
    select count(*) from public.alert_events
    where outcome = 'triggered' and triggered_at > now() - interval '24 hours'
  ),
  'apiCalls24h', (
    select count(*) from public.api_usage where created_at > now() - interval '24 hours'
  ),
  'apiErrorRate', (
    select coalesce(round(avg(
      case when status_code >= 500 then 1 else 0 end
    )::numeric, 4), 0)
    from public.api_usage where created_at > now() - interval '24 hours'
  ),
  'p95LatencyMs', (
    select coalesce(percentile_cont(0.95) within group (order by latency_ms), 0)::integer
    from public.api_usage where created_at > now() - interval '24 hours'
  )
) as metrics;

-- -----------------------------------------------------------------------------
-- Public dashboard query
-- -----------------------------------------------------------------------------
create or replace function public.get_top_halal_stocks(p_limit integer default 6)
returns setof public.v_stock_overview
language sql
stable
set search_path = ''
as $$
  select *
  from public.v_stock_overview
  where compliance_status = 'halal' and is_active
  order by compliance_score desc nulls last, market_cap desc nulls last
  limit least(greatest(coalesce(p_limit, 6), 1), 50);
$$;

-- -----------------------------------------------------------------------------
-- Admin metrics (SECURITY DEFINER + explicit authorisation check)
-- -----------------------------------------------------------------------------
create or replace function public.get_admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalUsers', (select count(*) from public.profiles where status <> 'deleted'),
    'activeUsers30d', (
      select count(*) from public.profiles
      where status = 'active' and last_seen_at > now() - interval '30 days'
    ),
    'newUsers7d', (
      select count(*) from public.profiles where created_at > now() - interval '7 days'
    ),
    'activeSubscriptions', (
      select count(*) from public.subscriptions where status in ('active', 'trialing')
    ),
    'trialingSubscriptions', (
      select count(*) from public.subscriptions where status = 'trialing'
    ),
    'mrrCents', (
      select coalesce(sum(
        case when s.billing_interval = 'year'
          then round(p.price_yearly_cents / 12.0)
          else p.price_monthly_cents
        end
      ), 0)::bigint
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.status in ('active', 'trialing')
    ),
    'churnRate', (
      select case
        when count(*) = 0 then 0
        else round(
          count(*) filter (where canceled_at > now() - interval '30 days')::numeric
          / count(*)::numeric, 4)
      end
      from public.subscriptions
      where status in ('active', 'trialing', 'canceled')
    ),
    'alertsActive', (select count(*) from public.price_alerts where status = 'active'),
    'alertsTriggered24h', (
      select count(*) from public.alert_events
      where outcome = 'triggered' and triggered_at > now() - interval '24 hours'
    ),
    'apiCalls24h', (
      select count(*) from public.api_usage where created_at > now() - interval '24 hours'
    ),
    'apiErrorRate', (
      select coalesce(round(avg(
        case when status_code >= 500 then 1 else 0 end
      )::numeric, 4), 0)
      from public.api_usage where created_at > now() - interval '24 hours'
    ),
    'p95LatencyMs', (
      select coalesce(percentile_cont(0.95) within group (order by latency_ms), 0)::integer
      from public.api_usage where created_at > now() - interval '24 hours'
    )
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Manual compliance overrides (audited, human-in-the-loop)
-- -----------------------------------------------------------------------------
create or replace function public.set_stock_compliance_override(
  p_stock_id uuid,
  p_status public.compliance_status,
  p_score numeric default null,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns public.compliance_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_report public.compliance_reports;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 10 then
    raise exception 'override_reason_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.stocks where id = p_stock_id) then
    raise exception 'stock_not_found' using errcode = '23503';
  end if;

  insert into public.compliance_reports (
    stock_id, provider, status, score, ratios, revenue_segments, reasons,
    purification_rate, reviewed_by, effective_at, expires_at
  )
  values (
    p_stock_id, 'manual', p_status, p_score, '{}'::jsonb, '[]'::jsonb,
    array[p_reason], null, v_actor, now(), p_expires_at
  )
  returning * into v_report;

  update public.stocks
  set compliance_override = p_status,
      override_reason = p_reason,
      override_expires_at = p_expires_at
  where id = p_stock_id;

  insert into public.audit_logs (
    actor_id, actor_email, action, entity_type, entity_id, after
  )
  values (
    v_actor,
    (select email from public.profiles where id = v_actor),
    'stock.compliance_override',
    'stock',
    p_stock_id::text,
    jsonb_build_object(
      'status', p_status::text,
      'score', p_score,
      'reason', p_reason,
      'expiresAt', p_expires_at
    )
  );

  return v_report;
end;
$$;

create or replace function public.clear_stock_compliance_override(p_stock_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_status public.compliance_status;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.stocks
  set compliance_override = null,
      override_reason = null,
      override_expires_at = null
  where id = p_stock_id;

  select r.status into v_status
  from public.compliance_reports r
  where r.stock_id = p_stock_id and r.provider <> 'manual'
  order by r.effective_at desc
  limit 1;

  if v_status is not null then
    update public.stocks
    set compliance_status = v_status,
        last_compliance_check = now()
    where id = p_stock_id;
  end if;

  insert into public.audit_logs (
    actor_id, actor_email, action, entity_type, entity_id, after
  )
  values (
    v_actor,
    (select email from public.profiles where id = v_actor),
    'stock.compliance_override_cleared',
    'stock',
    p_stock_id::text,
    jsonb_build_object('restoredStatus', coalesce(v_status::text, 'unknown'))
  );
end;
$$;

create or replace function public.expire_stock_overrides()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_status public.compliance_status;
  v_count integer := 0;
begin
  for v_row in
    select id
    from public.stocks
    where compliance_override is not null
      and override_expires_at is not null
      and override_expires_at <= now()
  loop
    update public.stocks
    set compliance_override = null,
        override_reason = null,
        override_expires_at = null
    where id = v_row.id;

    select r.status into v_status
    from public.compliance_reports r
    where r.stock_id = v_row.id and r.provider <> 'manual'
    order by r.effective_at desc
    limit 1;

    if v_status is not null then
      update public.stocks
      set compliance_status = v_status,
          last_compliance_check = now()
      where id = v_row.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin user management (role/status writes never go through the client table)
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_user(
  p_user_id uuid,
  p_role public.user_role default null,
  p_status public.user_status default null,
  p_locale public.locale_code default null,
  p_suspend_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles;
  v_before jsonb;
  v_owner_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = v_actor and p_status = 'suspended' then
    raise exception 'cannot_suspend_self' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    raise exception 'user_not_found' using errcode = '23503';
  end if;

  v_before := jsonb_build_object(
    'role', v_profile.role,
    'status', v_profile.status,
    'locale', v_profile.locale
  );

  if v_profile.role = 'owner' and p_role is not null and p_role <> 'owner' then
    select count(*) into v_owner_count from public.profiles where role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'cannot_remove_last_owner' using errcode = '22023';
    end if;
  end if;

  update public.profiles
  set role = coalesce(p_role, role),
      status = coalesce(p_status, status),
      locale = coalesce(p_locale, locale),
      suspended_reason = case
        when p_status = 'suspended' then p_suspend_reason
        when p_status = 'active' then null
        else suspended_reason
      end
  where id = p_user_id
  returning * into v_profile;

  insert into public.audit_logs (
    actor_id, actor_email, action, entity_type, entity_id, before, after
  )
  values (
    v_actor,
    (select email from public.profiles where id = v_actor),
    'user.updated',
    'profile',
    p_user_id::text,
    v_before,
    jsonb_build_object(
      'role', p_role,
      'status', p_status,
      'locale', p_locale,
      'suspendReason', p_suspend_reason
    )
  );

  return v_profile;
end;
$$;

-- -----------------------------------------------------------------------------
-- Broadcast notification (admin CMS)
-- -----------------------------------------------------------------------------
create or replace function public.broadcast_notification(
  p_title_key text,
  p_body text,
  p_audience public.plan_tier default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_title_key is null or char_length(trim(p_title_key)) = 0
     or p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'invalid_notification' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, type, title_key, body)
  select p.id, 'broadcast', p_title_key, p_body
  from public.profiles p
  where p.status = 'active'
    and (
      p_audience is null
      or exists (
        select 1
        from public.subscriptions s
        join public.plans pl on pl.id = s.plan_id
        where s.user_id = p.id
          and s.status in ('active', 'trialing')
          and pl.tier = p_audience
      )
    );

  get diagnostics v_count = row_count;

  insert into public.audit_logs (
    actor_id, actor_email, action, entity_type, entity_id, after
  )
  values (
    v_actor,
    (select email from public.profiles where id = v_actor),
    'notification.broadcast',
    'notification',
    null,
    jsonb_build_object('audience', p_audience, 'recipients', v_count)
  );

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke all on function public.get_admin_metrics() from public;
revoke all on function public.set_stock_compliance_override(uuid, public.compliance_status, numeric, text, timestamptz) from public;
revoke all on function public.clear_stock_compliance_override(uuid) from public;
revoke all on function public.expire_stock_overrides() from public;
revoke all on function public.admin_update_user(uuid, public.user_role, public.user_status, public.locale_code, text) from public;
revoke all on function public.broadcast_notification(text, text, public.plan_tier) from public;

grant execute on function public.get_top_halal_stocks(integer) to anon, authenticated, service_role;
grant execute on function public.get_admin_metrics() to authenticated, service_role;
grant execute on function public.set_stock_compliance_override(uuid, public.compliance_status, numeric, text, timestamptz) to authenticated;
grant execute on function public.clear_stock_compliance_override(uuid) to authenticated;
grant execute on function public.expire_stock_overrides() to service_role;
grant execute on function public.admin_update_user(uuid, public.user_role, public.user_status, public.locale_code, text) to authenticated;
grant execute on function public.broadcast_notification(text, text, public.plan_tier) to authenticated;

-- -----------------------------------------------------------------------------
-- View privileges
-- -----------------------------------------------------------------------------
-- anon may read non-sensitive columns so that `v_stock_overview`
-- (security_invoker) can resolve its lateral join; RLS has no anon policy, so
-- zero rows are returned. raw_payload is deliberately excluded.
grant select (
  id, stock_id, provider, status, score, ratios, revenue_segments, reasons,
  purification_rate, source_url, reviewed_by, effective_at, expires_at, created_at
) on public.compliance_reports to anon;
grant select on public.v_stock_overview to anon, authenticated;
grant select on public.v_latest_compliance to authenticated;
grant select on public.v_alert_overview to authenticated;
grant select on public.v_portfolio_positions to authenticated;
grant select on public.v_user_entitlements to authenticated;
grant select on public.v_admin_users to authenticated;
-- Deliberately not granted to anon/authenticated: service-role admin API only.
grant select on public.v_admin_metrics to service_role;
