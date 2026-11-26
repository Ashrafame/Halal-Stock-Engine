import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Static security tests for the SQL migrations. These catch the highest-impact
 * regressions (RLS disabled on a new table, a permissive policy on user data,
 * a SECURITY DEFINER function without a fixed search_path) on every CI run,
 * even when no local Postgres is available.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const sql = files
  .map((file) => `\n-- FILE: ${file}\n${readFileSync(join(MIGRATIONS_DIR, file), 'utf8')}`)
  .join('\n');

const createdTables = [...sql.matchAll(/create table public\.([a-z_]+)\s*\(/gi)].map(
  (match) => match[1] as string,
);

const rlsEnabled = new Set(
  [...sql.matchAll(/alter table public\.([a-z_]+) enable row level security;/gi)].map(
    (match) => match[1] as string,
  ),
);

interface Policy {
  name: string;
  table: string;
  body: string;
}

const policies: Policy[] = [
  ...sql.matchAll(/create policy\s+([a-z_]+)\s+on\s+public\.([a-z_]+)([\s\S]*?);/gi),
].map((match) => ({
  name: match[1] as string,
  table: match[2] as string,
  body: match[3] as string,
}));

const SECURITY_TABLES = [
  'profiles',
  'plans',
  'subscriptions',
  'stocks',
  'stock_quotes',
  'stock_indicators',
  'stock_prices',
  'compliance_reports',
  'watchlists',
  'watchlist_items',
  'portfolios',
  'holdings',
  'portfolio_transactions',
  'price_alerts',
  'alert_events',
  'notification_deliveries',
  'notifications',
  'push_tokens',
  'system_variables',
  'translations',
  'audit_logs',
  'api_usage',
  'app_errors',
  'stripe_events',
];

const USER_OWNED_TABLES = [
  'watchlists',
  'portfolios',
  'price_alerts',
  'notifications',
  'push_tokens',
];

describe('SQL schema security invariants', () => {
  it('creates every table required by the specification', () => {
    const required = [
      'profiles',
      'users_placeholder_should_not_exist',
      'plans',
      'subscriptions',
      'stocks',
      'compliance_reports',
      'watchlists',
      'price_alerts',
      'system_variables',
      'translations',
      'audit_logs',
    ].filter((name) => name !== 'users_placeholder_should_not_exist');

    for (const table of required) {
      expect(createdTables, `missing table ${table}`).toContain(table);
    }
    expect(createdTables).not.toContain('users_placeholder_should_not_exist');
    // Identity is owned by Supabase Auth; no duplicate users table.
    expect(createdTables).not.toContain('users');
  });

  it('enables row level security on every public table', () => {
    expect(createdTables.length).toBeGreaterThanOrEqual(SECURITY_TABLES.length);
    for (const table of createdTables) {
      expect(rlsEnabled, `RLS missing on public.${table}`).toContain(table);
    }
  });

  it('has at least one policy for every table exposed to clients', () => {
    for (const table of createdTables) {
      const tablePolicies = policies.filter((policy) => policy.table === table);
      if (tablePolicies.length === 0) {
        // Service-role-only tables still need RLS enabled (checked above) but
        // intentionally have no client policies.
        expect(
          [
            'alert_events',
            'notification_deliveries',
            'audit_logs',
            'api_usage',
            'app_errors',
            'stripe_events',
          ],
          `unexpected table without policies: ${table}`,
        ).toContain(table);
      }
    }
  });

  it('never uses USING (true) on user-owned data', () => {
    for (const policy of policies) {
      if (!/using\s*\(\s*true\s*\)/i.test(policy.body)) continue;
      expect(
        [
          'stock_quotes',
          'stock_indicators',
          'stock_prices',
          'translations',
          // Research data; raw_payload is protected by a column-level grant.
          'compliance_reports',
        ],
        `permissive policy ${policy.name} on ${policy.table}`,
      ).toContain(policy.table);
    }
  });

  it('never exposes provider payloads or secrets through column grants', () => {
    expect(sql).not.toMatch(/grant select on public\.compliance_reports/i);
    expect(sql).toMatch(
      /grant select \([^)]*provider[^)]*\) on public\.compliance_reports to anon;/i,
    );
    const grant = sql.match(
      /grant select \(([^)]*)\) on public\.compliance_reports to anon;/i,
    );
    expect(grant?.[1]).not.toMatch(/raw_payload/);
  });

  it('binds every user-owned policy to auth.uid()', () => {
    for (const table of USER_OWNED_TABLES) {
      const writePolicies = policies.filter(
        (policy) =>
          policy.table === table &&
          /(insert|update|delete|all)/i.test(policy.body) &&
          /to authenticated/i.test(policy.body),
      );
      expect(writePolicies.length, `no write policy on ${table}`).toBeGreaterThan(0);
      for (const policy of writePolicies) {
        expect(
          policy.body,
          `policy ${policy.name} on ${table} must bind to auth.uid()`,
        ).toMatch(/auth\.uid\(\)/);
      }
    }
  });

  it('does not grant subscription or audit writes to clients', () => {
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)[^;]*on public\.subscriptions/i);
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)[^;]*on public\.audit_logs/i);
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)[^;]*on public\.stripe_events/i);
    expect(sql).not.toMatch(/grant\s+all on [^;]+ to anon/i);
    expect(sql).toMatch(/revoke all on all tables in schema public from anon, authenticated;/i);
  });

  it('restricts profile role/status changes at the column privilege layer', () => {
    expect(sql).toMatch(/grant update \([^)]*full_name[^)]*\)\s*on public\.profiles to authenticated;/i);
    const grant = sql.match(/grant update \(([^)]*)\)\s*on public\.profiles to authenticated;/i);
    expect(grant?.[1]).not.toMatch(/\brole\b/);
    expect(grant?.[1]).not.toMatch(/\bstatus\b/);
  });

  it('defines SECURITY DEFINER functions with an empty search_path', () => {
    const chunks = sql.split(/create or replace function/i).slice(1);
    for (const chunk of chunks) {
      if (!/security definer/i.test(chunk)) continue;
      const header = chunk.slice(0, chunk.indexOf('$$'));
      const name = chunk.match(/^\s*public\.([a-z_]+)/i)?.[1] ?? 'unknown';
      expect(header, `SECURITY DEFINER ${name} must pin search_path`).toMatch(
        /set search_path\s*=\s*''/i,
      );
    }
  });

  it('protects the auth provisioning trigger', () => {
    expect(sql).toMatch(/create trigger on_auth_user_created[\s\S]*?after insert on auth\.users/i);
    expect(sql).toMatch(/function public\.handle_new_user\(\)[\s\S]*?security definer/i);
  });

  it('enforces alert quotas and the halal compliance gate server-side', () => {
    expect(sql).toMatch(/function public\.enforce_alert_policy\(\)/i);
    expect(sql).toMatch(/raise exception 'alert_limit_reached'/i);
    expect(sql).toMatch(/raise exception 'compliance_gate'/i);
    expect(sql).toMatch(/function public\.enforce_watchlist_limit\(\)/i);
    expect(sql).toMatch(/function public\.enforce_portfolio_limit\(\)/i);
    expect(sql).toMatch(/function public\.enforce_holding_limit\(\)/i);
  });

  it('keeps the latest compliance report authoritative', () => {
    expect(sql).toMatch(/create trigger compliance_reports_apply[\s\S]*?after insert on public\.compliance_reports/i);
    expect(sql).toMatch(/compliance_override is not null/i);
    expect(sql).toMatch(/function public\.expire_stock_overrides\(\)/i);
  });

  it('schedules alert evaluation and data sync jobs', () => {
    expect(sql).toMatch(/cron\.schedule\(\s*'evaluate-alerts'/i);
    expect(sql).toMatch(/cron\.schedule\(\s*'sync-market-data'/i);
    expect(sql).toMatch(/cron\.schedule\(\s*'sync-compliance'/i);
    expect(sql).toMatch(/x-cron-secret/i);
  });

  it('ships the free/pro/enterprise catalogue with camelCase limits', () => {
    expect(sql).toMatch(/'free', 'free'/i);
    expect(sql).toMatch(/'pro', 'pro'/i);
    expect(sql).toMatch(/'enterprise', 'enterprise'/i);
    expect(sql).toMatch(/"maxAlerts"/);
    expect(sql).toMatch(/"technicalAlerts"/);
  });

  it('never stores password hashes or raw card data', () => {
    expect(sql).not.toMatch(/password_hash|card_number|cvv|encrypted_password/i);
  });
});
