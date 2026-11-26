import type {
  AppNotification,
  Plan,
  PlanFeatures,
  PlanLimits,
  Portfolio,
  PortfolioSummary,
  PriceAlert,
  Profile,
  Stock,
  StockQuote,
  Subscription,
  TopStock,
} from '@hse/shared';

export interface StockViewRow {
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
  compliance_status: Stock['complianceStatus'];
  compliance_score: number | null;
  compliance_override: Stock['complianceStatus'] | null;
  override_reason: string | null;
  override_expires_at: string | null;
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
  rsi_14: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  macd: number | null;
  macd_signal: number | null;
  provider: string | null;
  purification_rate: number | null;
  ratios: Record<string, number> | null;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  locale: Profile['locale'];
  role: Profile['role'];
  status: Profile['status'];
  timezone: string;
  stripe_customer_id: string | null;
  notify_email: boolean;
  notify_push: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  tier: Plan['tier'];
  name: string;
  description: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  currency: string;
  trial_days: number;
  limits: PlanLimits;
  features: PlanFeatures;
  stripe_product_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_yearly_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface AlertViewRow {
  id: string;
  user_id: string;
  stock_id: string;
  alert_type: PriceAlert['alertType'];
  operator: PriceAlert['operator'];
  target_price: number | null;
  indicator: PriceAlert['indicator'];
  threshold: number | null;
  params: Record<string, number>;
  status: PriceAlert['status'];
  cooldown_minutes: number;
  last_triggered_at: string | null;
  notify_email: boolean;
  notify_push: boolean;
  expires_at: string | null;
  created_at: string;
  symbol: string;
  name: string;
  exchange: string;
  compliance_status: Stock['complianceStatus'];
  current_price: number | null;
}

export interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  is_simulated: boolean;
  created_at: string;
}

export interface PositionViewRow {
  id: string;
  portfolio_id: string;
  user_id: string;
  portfolio_name: string;
  base_currency: string;
  is_simulated: boolean;
  stock_id: string;
  shares: number;
  average_cost: number;
  opened_at: string;
  symbol: string;
  name: string;
  exchange: string;
  compliance_status: Stock['complianceStatus'];
  price: number | null;
  current_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pnl: number;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title_key: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface EntitlementRow {
  user_id: string;
  role: string;
  status: string;
  locale: string;
  plan_id: string;
  tier: Plan['tier'];
  limits: Partial<PlanLimits>;
  features: Partial<PlanFeatures>;
  subscription_status: Subscription['status'] | null;
  billing_interval: Subscription['interval'] | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  trial_end: string | null;
}

export function mapStock(row: StockViewRow): Stock {
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

export function mapQuote(row: StockViewRow): StockQuote | null {
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

export function mapTopStock(row: StockViewRow): TopStock {
  return {
    stock: mapStock(row),
    quote: mapQuote(row),
    compliance: {
      status: row.compliance_status,
      score: row.compliance_score,
      purificationRate: row.purification_rate,
      lastCheckedAt: row.last_compliance_check,
      provider:
        row.provider === 'zoya' ||
        row.provider === 'islamicly' ||
        row.provider === 'manual' ||
        row.provider === 'internal'
          ? row.provider
          : null,
    },
  };
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    role: row.role,
    status: row.status,
    timezone: row.timezone,
    stripeCustomerId: row.stripe_customer_id,
    notifyEmail: row.notify_email,
    notifyPush: row.notify_push,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    tier: row.tier,
    name: row.name,
    description: row.description,
    priceMonthlyCents: row.price_monthly_cents,
    priceYearlyCents: row.price_yearly_cents,
    currency: row.currency,
    trialDays: row.trial_days,
    limits: row.limits,
    features: row.features,
    stripeProductId: row.stripe_product_id,
    stripePriceMonthlyId: row.stripe_price_monthly_id,
    stripePriceYearlyId: row.stripe_price_yearly_id,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export function mapAlert(row: AlertViewRow): PriceAlert & { symbol: string; name: string; currentPrice: number | null } {
  return {
    id: row.id,
    userId: row.user_id,
    stockId: row.stock_id,
    alertType: row.alert_type,
    operator: row.operator,
    targetPrice: row.target_price,
    indicator: row.indicator,
    threshold: row.threshold,
    params: row.params,
    status: row.status,
    cooldownMinutes: row.cooldown_minutes,
    lastTriggeredAt: row.last_triggered_at,
    notifyEmail: row.notify_email,
    notifyPush: row.notify_push,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    symbol: row.symbol,
    name: row.name,
    currentPrice: row.current_price,
  };
}

export function mapPortfolio(row: PortfolioRow): Portfolio {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    baseCurrency: row.base_currency,
    isSimulated: row.is_simulated,
    createdAt: row.created_at,
  };
}

export function mapPosition(row: PositionViewRow) {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    stockId: row.stock_id,
    shares: row.shares,
    averageCost: row.average_cost,
    openedAt: row.opened_at,
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    complianceStatus: row.compliance_status,
    currentPrice: row.current_price,
    marketValue: row.market_value,
    costBasis: row.cost_basis,
    unrealizedPnl: row.unrealized_pnl,
    unrealizedPnlPercent: row.cost_basis > 0 ? row.unrealized_pnl / row.cost_basis : 0,
    compliant: row.compliance_status === 'halal',
  };
}

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    titleKey: row.title_key,
    body: row.body,
    data: row.data,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function summarizePositions(
  portfolio: Portfolio,
  positions: ReturnType<typeof mapPosition>[],
): Omit<PortfolioSummary, 'positions'> & { positions: ReturnType<typeof mapPosition>[] } {
  const marketValue = positions.reduce((total, position) => total + position.marketValue, 0);
  const costBasis = positions.reduce((total, position) => total + position.costBasis, 0);
  const nonCompliantValue = positions
    .filter((position) => !position.compliant)
    .reduce((total, position) => total + position.marketValue, 0);

  return {
    portfolio,
    positions,
    marketValue,
    costBasis,
    unrealizedPnl: marketValue - costBasis,
    unrealizedPnlPercent: costBasis > 0 ? (marketValue - costBasis) / costBasis : 0,
    nonCompliantValue,
  };
}
