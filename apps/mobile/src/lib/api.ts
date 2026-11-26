import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  defaultAlertForStock,
  demo,
  type BillingInterval,
  type ComplianceStatus,
  type Locale,
  type PlanFeatures,
  type PlanLimits,
  type PriceAlert,
  type Profile,
  type Stock,
  type StockQuote,
  type TopStock,
} from '@hse/shared';

import { requireSupabase, supabase } from './supabase';

export class ApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

interface ViewRow {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  name_ar: string | null;
  name_es: string | null;
  sector: string;
  industry: string | null;
  country: string;
  currency: string;
  logo_url: string | null;
  market_cap: number | null;
  compliance_status: ComplianceStatus;
  compliance_score: number | null;
  last_compliance_check: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  as_of: string | null;
  provider: string | null;
  purification_rate: number | null;
  ratios: Record<string, number> | null;
}

function mapStock(row: ViewRow): Stock {
  return {
    id: row.id,
    symbol: row.symbol,
    exchange: row.exchange,
    name: row.name,
    nameAr: row.name_ar,
    nameEs: row.name_es,
    sector: row.sector,
    industry: row.industry,
    country: row.country,
    currency: row.currency,
    logoUrl: row.logo_url,
    marketCap: row.market_cap,
    complianceStatus: row.compliance_status,
    complianceScore: row.compliance_score,
    lastComplianceCheck: row.last_compliance_check,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuote(row: ViewRow): StockQuote | null {
  if (row.price === null || row.as_of === null) return null;
  return {
    stockId: row.id,
    price: row.price,
    previousClose: row.previous_close ?? row.price,
    change: row.change ?? 0,
    changePercent: row.change_percent ?? 0,
    dayHigh: row.day_high,
    dayLow: row.day_low,
    volume: row.volume,
    source: 'market',
    asOf: row.as_of,
  };
}

function mapTop(row: ViewRow): TopStock {
  return {
    stock: mapStock(row),
    quote: mapQuote(row),
    compliance: {
      status: row.compliance_status,
      score: row.compliance_score,
      purificationRate: row.purification_rate,
      lastCheckedAt: row.last_compliance_check,
      provider: row.provider as TopStock['compliance']['provider'],
    },
  };
}

function demoRows(): ViewRow[] {
  return demo.DEMO_STOCKS.map((stock) => {
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
      provider: 'internal',
      purification_rate: 0.02,
      ratios: null,
    };
  });
}

export async function fetchTopStocks(limit = 6): Promise<TopStock[]> {
  if (!supabase) return demo.demoTops(limit);
  const { data, error } = await supabase.rpc('get_top_halal_stocks', { p_limit: limit });
  if (error) throw new ApiError('load_failed');
  return ((data ?? []) as ViewRow[]).map(mapTop);
}

export async function fetchScreener(search = ''): Promise<TopStock[]> {
  if (!supabase) {
    const term = search.trim().toLowerCase();
    return demoRows()
      .filter(
        (row) =>
          !term ||
          row.symbol.toLowerCase().includes(term) ||
          row.name.toLowerCase().includes(term),
      )
      .map(mapTop);
  }
  let query = supabase
    .from('v_stock_overview')
    .select('*')
    .eq('is_active', true)
    .order('compliance_score', { ascending: false, nullsFirst: false })
    .limit(100);
  const term = search.replace(/[%,()]/g, '').trim().slice(0, 60);
  if (term) query = query.or(`symbol.ilike.%${term}%,name.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new ApiError('load_failed');
  return ((data ?? []) as ViewRow[]).map(mapTop);
}

export interface MobileAlert extends PriceAlert {
  symbol: string;
  name: string;
  currentPrice: number | null;
}

export async function fetchAlerts(userId: string): Promise<MobileAlert[]> {
  if (!supabase) {
    return demo.DEMO_ALERTS.map((alert) => ({
      ...alert,
      symbol: demo.DEMO_STOCKS.find((stock) => stock.id === alert.stockId)?.symbol ?? '—',
      name: demo.DEMO_STOCKS.find((stock) => stock.id === alert.stockId)?.name ?? '—',
      currentPrice:
        demo.DEMO_QUOTES.find((quote) => quote.stockId === alert.stockId)?.price ?? null,
    }));
  }

  const { data, error } = await supabase
    .from('v_alert_overview')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new ApiError('load_failed');

  return (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    stockId: row.stock_id as string,
    alertType: row.alert_type as PriceAlert['alertType'],
    operator: row.operator as PriceAlert['operator'],
    targetPrice: (row.target_price as number | null) ?? null,
    indicator: (row.indicator as PriceAlert['indicator']) ?? null,
    threshold: (row.threshold as number | null) ?? null,
    params: (row.params as Record<string, number>) ?? {},
    status: row.status as PriceAlert['status'],
    cooldownMinutes: (row.cooldown_minutes as number) ?? 30,
    lastTriggeredAt: (row.last_triggered_at as string | null) ?? null,
    notifyEmail: row.notify_email !== false,
    notifyPush: row.notify_push !== false,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: row.created_at as string,
    symbol: (row.symbol as string) ?? '—',
    name: (row.name as string) ?? '—',
    currentPrice: (row.current_price as number | null) ?? null,
  }));
}

export async function createPriceAlert(input: {
  userId: string;
  stockId: string;
  targetPrice?: number;
  operator?: 'above' | 'below';
}): Promise<MobileAlert> {
  const client = requireSupabase();
  const { data: stock, error: stockError } = await client
    .from('v_stock_overview')
    .select('id, symbol, name, compliance_status, price')
    .eq('id', input.stockId)
    .maybeSingle();
  if (stockError || !stock) throw new ApiError('not_found');
  if (stock.compliance_status !== 'halal') throw new ApiError('compliance_gate');

  const target =
    input.targetPrice && input.targetPrice > 0
      ? input.targetPrice
      : defaultAlertForStock((stock.price as number | null) ?? 0).targetPrice;

  const { error } = await client.from('price_alerts').insert({
    user_id: input.userId,
    stock_id: input.stockId,
    alert_type: 'price',
    operator: input.operator ?? 'above',
    target_price: target,
    cooldown_minutes: 30,
  });

  if (error) {
    if (error.message.includes('alert_limit_reached')) throw new ApiError('alert_limit');
    if (error.message.includes('compliance_gate')) throw new ApiError('compliance_gate');
    throw new ApiError('create_failed');
  }

  return {
    id: '',
    userId: input.userId,
    stockId: input.stockId,
    alertType: 'price',
    operator: input.operator ?? 'above',
    targetPrice: target,
    indicator: null,
    threshold: null,
    params: {},
    status: 'active',
    cooldownMinutes: 30,
    lastTriggeredAt: null,
    notifyEmail: true,
    notifyPush: true,
    expiresAt: null,
    createdAt: new Date().toISOString(),
    symbol: stock.symbol as string,
    name: stock.name as string,
    currentPrice: (stock.price as number | null) ?? null,
  };
}

export async function setAlertStatus(id: string, status: 'active' | 'paused'): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('price_alerts').update({ status }).eq('id', id);
  if (error) throw new ApiError('update_failed');
}

export async function deleteAlert(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('price_alerts').delete().eq('id', id);
  if (error) throw new ApiError('delete_failed');
}

export interface MobilePosition {
  id: string;
  stockId: string;
  symbol: string;
  name: string;
  exchange: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  complianceStatus: ComplianceStatus;
}

export interface MobilePortfolio {
  id: string;
  name: string;
  baseCurrency: string;
  isSimulated: boolean;
  positions: MobilePosition[];
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  nonCompliantValue: number;
}

export interface MobileEntitlements {
  planId: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: string | null;
  limits: Partial<PlanLimits>;
  features: Partial<PlanFeatures>;
  currentPeriodEnd: string | null;
  interval: BillingInterval | null;
}

export async function fetchEntitlements(userId: string): Promise<MobileEntitlements> {
  if (!supabase) {
    return {
      planId: 'pro',
      tier: 'pro',
      status: 'active',
      limits: PLAN_LIMITS.pro,
      features: PLAN_FEATURES.pro,
      currentPeriodEnd: demo.DEMO_SUBSCRIPTION.currentPeriodEnd,
      interval: 'month',
    };
  }

  const { data } = await supabase
    .from('v_user_entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return {
      planId: 'free',
      tier: 'free',
      status: null,
      limits: PLAN_LIMITS.free,
      features: PLAN_FEATURES.free,
      currentPeriodEnd: null,
      interval: null,
    };
  }

  return {
    planId: (data.plan_id as string) ?? 'free',
    tier: (data.tier as 'free' | 'pro' | 'enterprise') ?? 'free',
    status: (data.subscription_status as string | null) ?? null,
    limits: { ...PLAN_LIMITS.free, ...(data.limits as Partial<PlanLimits>) },
    features: { ...PLAN_FEATURES.free, ...(data.features as Partial<PlanFeatures>) },
    currentPeriodEnd: (data.current_period_end as string | null) ?? null,
    interval: (data.billing_interval as BillingInterval | null) ?? null,
  };
}

export async function fetchPortfolio(userId: string): Promise<MobilePortfolio | null> {
  if (!supabase) {
    return {
      id: demo.DEMO_PORTFOLIO.portfolio.id,
      name: demo.DEMO_PORTFOLIO.portfolio.name,
      baseCurrency: 'USD',
      isSimulated: true,
      positions: demo.DEMO_PORTFOLIO.positions.map((position) => ({
        id: position.id,
        stockId: position.stockId,
        symbol: position.stock.symbol,
        name: position.stock.name,
        exchange: position.stock.exchange,
        shares: position.shares,
        averageCost: position.averageCost,
        currentPrice: position.quote?.price ?? position.averageCost,
        marketValue: position.marketValue,
        costBasis: position.costBasis,
        unrealizedPnl: position.unrealizedPnl,
        complianceStatus: position.stock.complianceStatus,
      })),
      marketValue: demo.DEMO_PORTFOLIO.marketValue,
      costBasis: demo.DEMO_PORTFOLIO.costBasis,
      unrealizedPnl: demo.DEMO_PORTFOLIO.unrealizedPnl,
      nonCompliantValue: demo.DEMO_PORTFOLIO.nonCompliantValue,
    };
  }

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!portfolio) return null;

  const { data: rows } = await supabase
    .from('v_portfolio_positions')
    .select('*')
    .eq('portfolio_id', portfolio.id);

  const positions: MobilePosition[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    stockId: row.stock_id as string,
    symbol: row.symbol as string,
    name: row.name as string,
    exchange: row.exchange as string,
    shares: row.shares as number,
    averageCost: row.average_cost as number,
    currentPrice: row.current_price as number,
    marketValue: row.market_value as number,
    costBasis: row.cost_basis as number,
    unrealizedPnl: row.unrealized_pnl as number,
    complianceStatus: row.compliance_status as ComplianceStatus,
  }));

  const marketValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const costBasis = positions.reduce((sum, position) => sum + position.costBasis, 0);
  const nonCompliantValue = positions
    .filter((position) => position.complianceStatus !== 'halal')
    .reduce((sum, position) => sum + position.marketValue, 0);

  return {
    id: portfolio.id as string,
    name: portfolio.name as string,
    baseCurrency: portfolio.base_currency as string,
    isSimulated: Boolean(portfolio.is_simulated),
    positions,
    marketValue,
    costBasis,
    unrealizedPnl: marketValue - costBasis,
    nonCompliantValue,
  };
}

export async function createPortfolio(userId: string, name: string): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('portfolios')
    .insert({ user_id: userId, name, base_currency: 'USD', is_simulated: true })
    .select('id')
    .single();
  if (error) throw new ApiError('create_failed');
  return data.id as string;
}

export async function addHolding(input: {
  portfolioId: string;
  stockId: string;
  shares: number;
  averageCost: number;
}): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('holdings').insert({
    portfolio_id: input.portfolioId,
    stock_id: input.stockId,
    shares: input.shares,
    average_cost: input.averageCost,
  });
  if (error) {
    if (error.message.includes('holding_limit_reached')) throw new ApiError('holding_limit');
    if (error.code === '23505') throw new ApiError('duplicate');
    throw new ApiError('create_failed');
  }
}

export async function registerPushToken(userId: string, token: string, platform: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: platform === 'ios' || platform === 'android' ? platform : 'web',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error) throw new ApiError('push_registration_failed');
}

export async function updateProfileRow(userId: string, profile: Partial<Profile>) {
  const client = requireSupabase();
  return client
    .from('profiles')
    .update({
      ...(profile.fullName !== undefined ? { full_name: profile.fullName } : {}),
      ...(profile.locale !== undefined ? { locale: profile.locale } : {}),
      ...(profile.notifyEmail !== undefined ? { notify_email: profile.notifyEmail } : {}),
      ...(profile.notifyPush !== undefined ? { notify_push: profile.notifyPush } : {}),
    })
    .eq('id', userId);
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  if (!supabase) {
    return demo.DEMO_NOTIFICATIONS.filter((item) => !item.readAt).length;
  }
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return count ?? 0;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const client = requireSupabase();
  await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}

export function localizedPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : locale, {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}
