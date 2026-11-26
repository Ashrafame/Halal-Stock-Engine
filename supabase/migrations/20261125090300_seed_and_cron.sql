-- =============================================================================
-- Halal Stock Engine — 0004: plan catalogue, system variables and cron jobs
-- =============================================================================

insert into public.plans (
  id, tier, name, description, price_monthly_cents, price_yearly_cents,
  currency, trial_days, limits, features, sort_order
)
values
  (
    'free', 'free', 'Free',
    'Screen halal stocks and track one portfolio, forever free.',
    0, 0, 'USD', 0,
    '{"maxAlerts":3,"maxWatchlistItems":10,"maxPortfolios":1,"maxHoldingsPerPortfolio":10,"apiRequestsPerDay":100,"alertCooldownMinutes":60}'::jsonb,
    '{"realtimeQuotes":false,"technicalAlerts":false,"emailAlerts":true,"pushAlerts":true,"portfolioTracking":true,"complianceReports":false,"exportData":false,"prioritySupport":false}'::jsonb,
    1
  ),
  (
    'pro', 'pro', 'Pro',
    'Real-time data, technical alerts and unlimited screening for serious investors.',
    1200, 11500, 'USD', 14,
    '{"maxAlerts":50,"maxWatchlistItems":200,"maxPortfolios":5,"maxHoldingsPerPortfolio":100,"apiRequestsPerDay":10000,"alertCooldownMinutes":5}'::jsonb,
    '{"realtimeQuotes":true,"technicalAlerts":true,"emailAlerts":true,"pushAlerts":true,"portfolioTracking":true,"complianceReports":true,"exportData":true,"prioritySupport":false}'::jsonb,
    2
  ),
  (
    'enterprise', 'enterprise', 'Enterprise',
    'Unlimited alerts, team access, API quota and priority Sharia support.',
    4900, 47000, 'USD', 30,
    '{"maxAlerts":-1,"maxWatchlistItems":-1,"maxPortfolios":-1,"maxHoldingsPerPortfolio":-1,"apiRequestsPerDay":-1,"alertCooldownMinutes":1}'::jsonb,
    '{"realtimeQuotes":true,"technicalAlerts":true,"emailAlerts":true,"pushAlerts":true,"portfolioTracking":true,"complianceReports":true,"exportData":true,"prioritySupport":true}'::jsonb,
    3
  )
on conflict (id) do nothing;

insert into public.system_variables (key, value, description, category, is_public)
values
  ('MAINTENANCE_MODE', 'false'::jsonb, 'Serve the maintenance page on web and mobile.', 'operations', true),
  ('ALERT_ENGINE_ENABLED', 'true'::jsonb, 'Master switch for the alert evaluation worker.', 'alerts', false),
  ('MARKET_DATA_SYNC_ENABLED', 'true'::jsonb, 'Enable the market data sync job.', 'market', false),
  ('COMPLIANCE_SYNC_ENABLED', 'true'::jsonb, 'Enable the compliance provider sync job.', 'compliance', false),
  ('ALERT_MAX_PER_RUN', '500'::jsonb, 'Maximum alerts evaluated per worker invocation.', 'alerts', false),
  ('ALERT_BATCH_SIZE', '100'::jsonb, 'Number of alerts fetched per database page.', 'alerts', false),
  ('SUPPORT_EMAIL', '"support@halalstockengine.app"'::jsonb, 'Displayed support address.', 'branding', true),
  ('DEFAULT_PUBLIC_LOCALE', '"en"'::jsonb, 'Locale served to first-time visitors.', 'branding', true),
  ('MIN_SUPPORTED_APP_VERSION', '"1.0.0"'::jsonb, 'Clients below this version are prompted to update.', 'operations', true),
  ('DATA_ATTRIBUTION', '"Market data is delayed unless your plan includes real-time quotes."'::jsonb, 'Footer attribution for data providers.', 'legal', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Scheduled jobs
--   HTTP workers use pg_net + Supabase Vault. Create these secrets before
--   relying on them:
--     select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--     select vault.create_secret('<long-random-value>', 'cron_secret');
--   The same value must be set as the CRON_SECRET Edge Function secret.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'expire-stock-overrides') then
      perform cron.unschedule('expire-stock-overrides');
    end if;
    perform cron.schedule(
      'expire-stock-overrides',
      '15 3 * * *',
      'select public.expire_stock_overrides();'
    );

    if exists (select 1 from cron.job where jobname = 'purge-old-market-prices') then
      perform cron.unschedule('purge-old-market-prices');
    end if;
    perform cron.schedule(
      'purge-old-market-prices',
      '0 4 * * 0',
      'delete from public.stock_prices where ts < now() - interval ''5 years'';'
    );

    if exists (select 1 from pg_extension where extname = 'pg_net') then
      if exists (select 1 from cron.job where jobname = 'evaluate-alerts') then
        perform cron.unschedule('evaluate-alerts');
      end if;
      perform cron.schedule(
        'evaluate-alerts',
        '* * * * *',
        $job$
          select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                   || '/functions/v1/evaluate-alerts',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 25000
          );
        $job$
      );

      if exists (select 1 from cron.job where jobname = 'sync-market-data') then
        perform cron.unschedule('sync-market-data');
      end if;
      perform cron.schedule(
        'sync-market-data',
        '*/5 13-21 * * 1-5',
        $job$
          select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                   || '/functions/v1/sync-market-data',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 50000
          );
        $job$
      );

      if exists (select 1 from cron.job where jobname = 'sync-compliance') then
        perform cron.unschedule('sync-compliance');
      end if;
      perform cron.schedule(
        'sync-compliance',
        '30 2 * * *',
        $job$
          select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                   || '/functions/v1/sync-compliance',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 120000
          );
        $job$
      );
    end if;
  end if;
end;
$$;
