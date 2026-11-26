import { cache } from 'react';

import {
  PLAN_CATALOG,
  PLAN_FEATURES,
  PLAN_LIMITS,
  demo,
  flattenDictionary,
  DICTIONARIES,
  type AppNotification,
  type ComplianceStatus,
  type Plan,
  type PortfolioSummary,
  type PriceAlert,
  type TopStock,
} from '@hse/shared';

import { isDemoMode, isSupabaseConfigured } from './env';
import {
  mapAlert,
  mapNotification,
  mapPlan,
  mapPosition,
  mapTopStock,
  summarizePositions,
  type AlertViewRow,
  type EntitlementRow,
  type NotificationRow,
  type PlanRow,
  type PortfolioRow,
  type PositionViewRow,
  type StockViewRow,
} from './mappers';
import { createAdminClient } from './supabase/admin';
import { createSupabaseServerClient } from './supabase/server';
import { createStaticClient } from './supabase/static';

export type AlertWithMeta = PriceAlert & {
  symbol: string;
  name: string;
  currentPrice: number | null;
};

export type DashboardPosition = ReturnType<typeof mapPosition>;

export interface DashboardData {
  topStocks: TopStock[];
  alerts: AlertWithMeta[];
  notifications: AppNotification[];
  unreadCount: number;
  portfolio: (Omit<PortfolioSummary, 'positions'> & { positions: DashboardPosition[] }) | null;
  entitlements: EntitlementRow;
}

export interface ScreenerFilters {
  search?: string;
  compliance?: ComplianceStatus;
  sector?: string;
}

function safeSearch(value: string | undefined): string {
  return (value ?? '').replace(/[%,()]/g, '').trim().slice(0, 80);
}

function demoEntitlements(): EntitlementRow {
  return {
    user_id: demo.DEMO_PROFILE.id,
    role: 'user',
    status: 'active',
    locale: 'en',
    plan_id: 'pro',
    tier: 'pro',
    limits: PLAN_LIMITS.pro,
    features: PLAN_FEATURES.pro,
    subscription_status: 'active',
    billing_interval: 'month',
    current_period_end: demo.DEMO_SUBSCRIPTION.currentPeriodEnd,
    cancel_at_period_end: false,
    trial_end: null,
  };
}

function demoPortfolio(): Omit<PortfolioSummary, 'positions'> & { positions: DashboardPosition[] } {
  return {
    ...demo.DEMO_PORTFOLIO,
    positions: demo.DEMO_PORTFOLIO.positions.map((position) => ({
      id: position.id,
      portfolioId: position.portfolioId,
      stockId: position.stockId,
      shares: position.shares,
      averageCost: position.averageCost,
      openedAt: position.openedAt,
      symbol: position.stock.symbol,
      name: position.stock.name,
      exchange: position.stock.exchange,
      complianceStatus: position.stock.complianceStatus,
      currentPrice: position.quote?.price ?? position.averageCost,
      marketValue: position.marketValue,
      costBasis: position.costBasis,
      unrealizedPnl: position.unrealizedPnl,
      unrealizedPnlPercent: position.unrealizedPnlPercent,
      compliant: position.compliant,
    })),
  };
}

export const getTopStocks = cache(async (limit = 6): Promise<TopStock[]> => {
  if (!isSupabaseConfigured) return demo.demoTops(limit);
  const { data, error } = await createStaticClient().rpc('get_top_halal_stocks', {
    p_limit: limit,
  });
  if (error) {
    console.error('[data] get_top_halal_stocks failed', error.message);
    return [];
  }
  return ((data ?? []) as unknown as StockViewRow[]).map(mapTopStock);
});

export const getScreenerStocks = cache(
  async (filters: ScreenerFilters = {}): Promise<StockViewRow[]> => {
    const search = safeSearch(filters.search);

    if (!isSupabaseConfigured) {
      return demo.DEMO_STOCKS.filter((stock) => {
        if (filters.compliance && stock.complianceStatus !== filters.compliance) return false;
        if (filters.sector && stock.sector !== filters.sector) return false;
        if (
          search &&
          !`${stock.symbol} ${stock.name}`.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
        .sort((a, b) => (b.complianceScore ?? 0) - (a.complianceScore ?? 0))
        .map((stock) => {
          const quote = demo.DEMO_QUOTES.find((item) => item.stockId === stock.id);
          return {
            id: stock.id,
            symbol: stock.symbol,
            exchange: stock.exchange,
            name: stock.name,
            name_ar: stock.nameAr,
            name_es: stock.nameEs,
            sector: stock.sector,
            industry: stock.industry,
            country: stock.country,
            currency: stock.currency,
            logo_url: null,
            market_cap: stock.marketCap,
            compliance_status: stock.complianceStatus,
            compliance_score: stock.complianceScore,
            compliance_override: null,
            override_reason: null,
            override_expires_at: null,
            last_compliance_check: stock.lastComplianceCheck,
            is_active: true,
            created_at: stock.createdAt,
            updated_at: stock.updatedAt,
            price: quote?.price ?? null,
            previous_close: quote?.previousClose ?? null,
            change: quote?.change ?? null,
            change_percent: quote?.changePercent ?? null,
            day_high: quote?.dayHigh ?? null,
            day_low: quote?.dayLow ?? null,
            volume: quote?.volume ?? null,
            as_of: quote?.asOf ?? null,
            rsi_14: null,
            sma_20: null,
            sma_50: null,
            sma_200: null,
            macd: null,
            macd_signal: null,
            provider: 'internal',
            purification_rate: 0.02,
            ratios: null,
          } satisfies StockViewRow;
        });
    }

    let query = createStaticClient()
      .from('v_stock_overview')
      .select('*')
      .eq('is_active', true)
      .order('compliance_score', { ascending: false, nullsFirst: false })
      .limit(60);

    if (filters.compliance) query = query.eq('compliance_status', filters.compliance);
    if (filters.sector) query = query.eq('sector', filters.sector);
    if (search) query = query.or(`symbol.ilike.%${search}%,name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      console.error('[data] screener query failed', error.message);
      return [];
    }
    return (data ?? []) as unknown as StockViewRow[];
  },
);

export const getPublicPlans = cache(async (): Promise<Plan[]> => {
  if (!isSupabaseConfigured) return PLAN_CATALOG.map((plan) => ({ ...plan }));
  const { data, error } = await createStaticClient()
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error || !data) return PLAN_CATALOG.map((plan) => ({ ...plan }));
  return (data as unknown as PlanRow[]).map(mapPlan);
});

export const getStockOptions = cache(
  async (): Promise<Array<{ id: string; symbol: string; name: string; price: number | null }>> => {
    if (!isSupabaseConfigured) {
      return demo.demoTops(20).map((item) => ({
        id: item.stock.id,
        symbol: item.stock.symbol,
        name: item.stock.name,
        price: item.quote?.price ?? null,
      }));
    }
    const { data } = await createStaticClient()
      .from('v_stock_overview')
      .select('id, symbol, name, price')
      .eq('is_active', true)
      .eq('compliance_status', 'halal')
      .order('compliance_score', { ascending: false })
      .limit(100);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      symbol: row.symbol as string,
      name: row.name as string,
      price: (row.price as number | null) ?? null,
    }));
  },
);

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const topStocks = await getTopStocks(6);

  if (isDemoMode || !isSupabaseConfigured) {
    return {
      topStocks,
      alerts: demo.DEMO_ALERTS.map((alert) => ({
        ...alert,
        symbol: demo.DEMO_STOCKS.find((stock) => stock.id === alert.stockId)?.symbol ?? '—',
        name: demo.DEMO_STOCKS.find((stock) => stock.id === alert.stockId)?.name ?? '—',
        currentPrice:
          demo.DEMO_QUOTES.find((quote) => quote.stockId === alert.stockId)?.price ?? null,
      })),
      notifications: demo.DEMO_NOTIFICATIONS,
      unreadCount: demo.DEMO_NOTIFICATIONS.filter((item) => !item.readAt).length,
      portfolio: demoPortfolio(),
      entitlements: demoEntitlements(),
    };
  }

  const supabase = await createSupabaseServerClient();
  const [alertsResult, notificationsResult, portfolioResult, entitlementResult] =
    await Promise.all([
      supabase
        .from('v_alert_overview')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase.from('portfolios').select('*').eq('user_id', userId).limit(1).maybeSingle<PortfolioRow>(),
      supabase
        .from('v_user_entitlements')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle<EntitlementRow>(),
    ]);

  const alerts = ((alertsResult.data ?? []) as unknown as AlertViewRow[]).map(mapAlert);
  const notifications = ((notificationsResult.data ?? []) as unknown as NotificationRow[]).map(
    mapNotification,
  );

  let portfolio: DashboardData['portfolio'] = null;
  const portfolioRow = portfolioResult.data;
  if (portfolioRow) {
    const { data: positionRows } = await supabase
      .from('v_portfolio_positions')
      .select('*')
      .eq('portfolio_id', portfolioRow.id);
    const positions = ((positionRows ?? []) as unknown as PositionViewRow[]).map(mapPosition);
    portfolio = summarizePositions(
      {
        id: portfolioRow.id,
        userId: portfolioRow.user_id,
        name: portfolioRow.name,
        baseCurrency: portfolioRow.base_currency,
        isSimulated: portfolioRow.is_simulated,
        createdAt: portfolioRow.created_at,
      },
      positions,
    );
  }

  return {
    topStocks,
    alerts,
    notifications,
    unreadCount: notifications.filter((item) => !item.readAt).length,
    portfolio,
    entitlements: entitlementResult.data ?? demoEntitlements(),
  };
}

export async function getAlertsData(userId: string): Promise<{
  alerts: AlertWithMeta[];
  stocks: Awaited<ReturnType<typeof getStockOptions>>;
  entitlements: EntitlementRow;
}> {
  const stocks = await getStockOptions();
  if (isDemoMode || !isSupabaseConfigured) {
    return {
      alerts: demo.DEMO_ALERTS.map((alert) => ({
        ...alert,
        symbol: demo.DEMO_STOCKS.find((stock) => stock.id === alert.stockId)?.symbol ?? '—',
        name: demo.DEMO_STOCKS.find((stock) => stock.id === alert.stockId)?.name ?? '—',
        currentPrice:
          demo.DEMO_QUOTES.find((quote) => quote.stockId === alert.stockId)?.price ?? null,
      })),
      stocks,
      entitlements: demoEntitlements(),
    };
  }

  const supabase = await createSupabaseServerClient();
  const [alertsResult, entitlementResult] = await Promise.all([
    supabase
      .from('v_alert_overview')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('v_user_entitlements')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle<EntitlementRow>(),
  ]);

  return {
    alerts: ((alertsResult.data ?? []) as unknown as AlertViewRow[]).map(mapAlert),
    stocks,
    entitlements: entitlementResult.data ?? demoEntitlements(),
  };
}

export async function getPortfolioData(userId: string): Promise<{
  portfolios: Array<{ id: string; name: string; baseCurrency: string; isSimulated: boolean }>;
  summary: (Omit<PortfolioSummary, 'positions'> & { positions: DashboardPosition[] }) | null;
  stocks: Awaited<ReturnType<typeof getStockOptions>>;
  entitlements: EntitlementRow;
}> {
  const stocks = await getStockOptions();

  if (isDemoMode || !isSupabaseConfigured) {
    return {
      portfolios: [
        {
          id: demo.DEMO_PORTFOLIO.portfolio.id,
          name: demo.DEMO_PORTFOLIO.portfolio.name,
          baseCurrency: demo.DEMO_PORTFOLIO.portfolio.baseCurrency,
          isSimulated: demo.DEMO_PORTFOLIO.portfolio.isSimulated,
        },
      ],
      summary: demoPortfolio(),
      stocks,
      entitlements: demoEntitlements(),
    };
  }
  const supabase = await createSupabaseServerClient();
  const [{ data: portfolioRows }, entitlementResult] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', userId).order('created_at'),
    supabase
      .from('v_user_entitlements')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle<EntitlementRow>(),
  ]);

  const rows = (portfolioRows ?? []) as unknown as PortfolioRow[];
  const portfolios = rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    isSimulated: row.is_simulated,
  }));

  let summary: (Omit<PortfolioSummary, 'positions'> & { positions: DashboardPosition[] }) | null = null;
  const first = rows[0];
  if (first) {
    const { data: positionRows } = await supabase
      .from('v_portfolio_positions')
      .select('*')
      .eq('portfolio_id', first.id);
    const positions = ((positionRows ?? []) as unknown as PositionViewRow[]).map(mapPosition);
    summary = summarizePositions(
      {
        id: first.id,
        userId: first.user_id,
        name: first.name,
        baseCurrency: first.base_currency,
        isSimulated: first.is_simulated,
        createdAt: first.created_at,
      },
      positions,
    );
  }

  return {
    portfolios,
    summary,
    stocks,
    entitlements: entitlementResult.data ?? demoEntitlements(),
  };
}

// ---------------------------------------------------------------------------
// Admin read models (service role after requireAdmin)
// ---------------------------------------------------------------------------
export interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  status: string;
  locale: string;
  plan_id: string | null;
  subscription_status: string | null;
  created_at: string;
  last_seen_at: string | null;
  current_period_end: string | null;
}

export interface AdminAuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

export interface AdminErrorRow {
  id: number;
  level: string;
  message: string;
  created_at: string;
}

export interface TranslationRow {
  id: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface SystemVariableRow {
  key: string;
  value: unknown;
  description: string;
  category: string;
  is_public: boolean;
  updated_at: string;
}

export interface AdminOverview {
  metrics: typeof demo.DEMO_ADMIN_METRICS;
  logs: AdminAuditRow[];
  errors: AdminErrorRow[];
}

const DEMO_ADMIN_USERS: AdminUserRow[] = [
  {
    id: demo.DEMO_PROFILE.id,
    email: demo.DEMO_PROFILE.email,
    full_name: demo.DEMO_PROFILE.fullName,
    role: 'user',
    status: 'active',
    locale: 'en',
    plan_id: 'pro',
    subscription_status: 'active',
    created_at: demo.DEMO_PROFILE.createdAt,
    last_seen_at: '2026-11-25T12:40:00.000Z',
    current_period_end: '2026-12-01T00:00:00.000Z',
  },
  {
    id: demo.DEMO_ADMIN_PROFILE.id,
    email: demo.DEMO_ADMIN_PROFILE.email,
    full_name: demo.DEMO_ADMIN_PROFILE.fullName,
    role: 'owner',
    status: 'active',
    locale: 'en',
    plan_id: 'enterprise',
    subscription_status: 'active',
    created_at: '2026-01-02T08:00:00.000Z',
    last_seen_at: '2026-11-25T13:05:00.000Z',
    current_period_end: '2027-01-02T00:00:00.000Z',
  },
  {
    id: '99999999-9999-4999-8999-999999999996',
    email: 'layla@example.com',
    full_name: 'Layla Haddad',
    role: 'user',
    status: 'active',
    locale: 'ar',
    plan_id: 'free',
    subscription_status: null,
    created_at: '2026-09-14T10:20:00.000Z',
    last_seen_at: '2026-11-24T19:12:00.000Z',
    current_period_end: null,
  },
  {
    id: '99999999-9999-4999-8999-999999999995',
    email: 'carlos@example.com',
    full_name: 'Carlos Rivera',
    role: 'support',
    status: 'active',
    locale: 'es',
    plan_id: 'pro',
    subscription_status: 'trialing',
    created_at: '2026-10-01T09:00:00.000Z',
    last_seen_at: '2026-11-25T08:30:00.000Z',
    current_period_end: '2026-12-08T00:00:00.000Z',
  },
  {
    id: '99999999-9999-4999-8999-999999999994',
    email: 'suspended@example.com',
    full_name: 'Suspended Account',
    role: 'user',
    status: 'suspended',
    locale: 'en',
    plan_id: null,
    subscription_status: null,
    created_at: '2026-07-19T14:00:00.000Z',
    last_seen_at: '2026-10-02T11:00:00.000Z',
    current_period_end: null,
  },
];

function assertAdminService(): void {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for the admin dashboard.');
  }
}

export const getAdminOverview = cache(async (): Promise<AdminOverview> => {
  if (isDemoMode || !isSupabaseConfigured) {
    return {
      metrics: demo.DEMO_ADMIN_METRICS,
      logs: demo.DEMO_AUDIT_LOGS.map((entry) => ({
        id: entry.id,
        actor_email: entry.actorEmail,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        created_at: entry.createdAt,
      })),
      errors: [],
    };
  }

  assertAdminService();
  const admin = createAdminClient();
  const [metricResult, logResult, errorResult] = await Promise.all([
    admin.from('v_admin_metrics').select('metrics').single(),
    admin
      .from('audit_logs')
      .select('id, actor_email, action, entity_type, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
    admin
      .from('app_errors')
      .select('id, level, message, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  return {
    metrics: (metricResult.data?.metrics as typeof demo.DEMO_ADMIN_METRICS) ?? demo.DEMO_ADMIN_METRICS,
    logs: (logResult.data ?? []) as AdminAuditRow[],
    errors: (errorResult.data ?? []) as AdminErrorRow[],
  };
});

export async function getAdminUsers(search = ''): Promise<AdminUserRow[]> {
  if (isDemoMode || !isSupabaseConfigured) {
    const term = search.toLowerCase();
    return DEMO_ADMIN_USERS.filter(
      (row) =>
        !term ||
        (row.email ?? '').toLowerCase().includes(term) ||
        (row.full_name ?? '').toLowerCase().includes(term),
    );
  }

  assertAdminService();
  let query = createAdminClient()
    .from('v_admin_users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  const term = safeSearch(search);
  if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(`admin_users_failed: ${error.message}`);
  return (data ?? []) as AdminUserRow[];
}

export async function getAdminPlans(): Promise<PlanRow[]> {
  if (isDemoMode || !isSupabaseConfigured) {
    return PLAN_CATALOG.map((plan) => ({
      id: plan.id,
      tier: plan.tier,
      name: plan.name,
      description: plan.description,
      price_monthly_cents: plan.priceMonthlyCents,
      price_yearly_cents: plan.priceYearlyCents,
      currency: plan.currency,
      trial_days: plan.trialDays,
      limits: plan.limits,
      features: plan.features,
      stripe_product_id: null,
      stripe_price_monthly_id: null,
      stripe_price_yearly_id: null,
      is_active: plan.isActive,
      sort_order: plan.sortOrder,
    }));
  }

  assertAdminService();
  const { data, error } = await createAdminClient().from('plans').select('*').order('sort_order');
  if (error) throw new Error(`admin_plans_failed: ${error.message}`);
  return (data ?? []) as PlanRow[];
}

export async function getAdminLogs(): Promise<AdminAuditRow[]> {
  if (isDemoMode || !isSupabaseConfigured) {
    return demo.DEMO_AUDIT_LOGS.map((entry) => ({
      id: entry.id,
      actor_email: entry.actorEmail,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      created_at: entry.createdAt,
    }));
  }
  assertAdminService();
  const { data, error } = await createAdminClient()
    .from('audit_logs')
    .select('id, actor_email, action, entity_type, entity_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`admin_logs_failed: ${error.message}`);
  return (data ?? []) as AdminAuditRow[];
}

export async function getAdminCmsData(): Promise<{
  translations: TranslationRow[];
  variables: SystemVariableRow[];
  dictionaryKeys: Array<{ key: string; value: string }>;
}> {
  const dictionaryKeys = flattenDictionary(DICTIONARIES.en);

  if (isDemoMode || !isSupabaseConfigured) {
    const translations: TranslationRow[] = [
      {
        id: 'demo-1',
        locale: 'ar',
        namespace: 'landing',
        key: 'heroTitle',
        value: 'اعرف بالضبط أي الأسهم',
        updated_at: '2026-11-20T10:00:00.000Z',
      },
      {
        id: 'demo-2',
        locale: 'es',
        namespace: 'landing',
        key: 'ctaPrimary',
        value: 'Empieza gratis hoy',
        updated_at: '2026-11-19T14:30:00.000Z',
      },
    ];
    const variables: SystemVariableRow[] = [
      {
        key: 'MAINTENANCE_MODE',
        value: false,
        description: 'Serve the maintenance page on web and mobile.',
        category: 'operations',
        is_public: true,
        updated_at: '2026-11-01T00:00:00.000Z',
      },
      {
        key: 'ALERT_ENGINE_ENABLED',
        value: true,
        description: 'Master switch for the alert evaluation worker.',
        category: 'alerts',
        is_public: false,
        updated_at: '2026-11-01T00:00:00.000Z',
      },
      {
        key: 'ALERT_MAX_PER_RUN',
        value: 500,
        description: 'Maximum alerts evaluated per worker invocation.',
        category: 'alerts',
        is_public: false,
        updated_at: '2026-11-01T00:00:00.000Z',
      },
      {
        key: 'SUPPORT_EMAIL',
        value: 'support@halalstockengine.app',
        description: 'Displayed support address.',
        category: 'branding',
        is_public: true,
        updated_at: '2026-11-01T00:00:00.000Z',
      },
    ];
    return { translations, variables, dictionaryKeys };
  }

  assertAdminService();
  const admin = createAdminClient();
  const [translationResult, variableResult] = await Promise.all([
    admin
      .from('translations')
      .select('id, locale, namespace, key, value, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500),
    admin.from('system_variables').select('*').order('category').order('key'),
  ]);

  return {
    translations: (translationResult.data ?? []) as TranslationRow[],
    variables: (variableResult.data ?? []) as SystemVariableRow[],
    dictionaryKeys,
  };
}

export async function getAdminErrors(): Promise<AdminErrorRow[]> {
  if (isDemoMode || !isSupabaseConfigured) return [];
  assertAdminService();
  const { data } = await createAdminClient()
    .from('app_errors')
    .select('id, level, message, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as AdminErrorRow[];
}
