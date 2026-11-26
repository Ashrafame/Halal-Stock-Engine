/**
 * Canonical domain types.
 *
 * These mirror the Supabase schema in `supabase/migrations`. Keep them in sync:
 * the database is the source of truth, and `packages/shared/tests/schema.test.ts`
 * asserts the high-level shape of the SQL contract.
 */

export type Locale = 'en' | 'ar' | 'es';
export type Direction = 'ltr' | 'rtl';
export type ThemePreference = 'system' | 'light' | 'dark';

export type UserRole = 'user' | 'support' | 'admin' | 'owner';
export type UserStatus = 'active' | 'suspended' | 'pending' | 'deleted';

export type PlanTier = 'free' | 'pro' | 'enterprise';
export type BillingInterval = 'month' | 'year';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type ComplianceStatus = 'halal' | 'questionable' | 'haram' | 'unknown';
export type ComplianceProvider = 'zoya' | 'islamicly' | 'internal' | 'manual';

export type AlertType = 'price' | 'indicator' | 'compliance';
export type AlertOperator = 'above' | 'below' | 'crosses_above' | 'crosses_below';
export type AlertStatus = 'active' | 'paused' | 'triggered' | 'expired';

export type IndicatorName = 'rsi_14' | 'sma_20' | 'sma_50' | 'sma_200' | 'macd' | 'volume_spike';
export type NotificationChannel = 'push' | 'email' | 'in_app';
export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'skipped';
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'fee';

export interface PlanLimits {
  /** Active alerts a user may hold. -1 means unlimited. */
  maxAlerts: number;
  maxWatchlistItems: number;
  maxPortfolios: number;
  maxHoldingsPerPortfolio: number;
  apiRequestsPerDay: number;
  /** Minimum minutes between two firings of the same alert. */
  alertCooldownMinutes: number;
}

export interface PlanFeatures {
  realtimeQuotes: boolean;
  technicalAlerts: boolean;
  emailAlerts: boolean;
  pushAlerts: boolean;
  portfolioTracking: boolean;
  complianceReports: boolean;
  exportData: boolean;
  prioritySupport: boolean;
}

export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  locale: Locale;
  role: UserRole;
  status: UserStatus;
  timezone: string;
  stripeCustomerId: string | null;
  notifyEmail: boolean;
  notifyPush: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  currency: string;
  trialDays: number;
  limits: PlanLimits;
  features: PlanFeatures;
  stripeProductId: string | null;
  stripePriceMonthlyId: string | null;
  stripePriceYearlyId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stock {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  nameAr: string | null;
  nameEs: string | null;
  sector: string;
  industry: string | null;
  country: string;
  currency: string;
  logoUrl: string | null;
  marketCap: number | null;
  complianceStatus: ComplianceStatus;
  complianceScore: number | null;
  lastComplianceCheck: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockQuote {
  stockId: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  source: string;
  asOf: string;
}

export interface FinancialRatios {
  /** Total interest-bearing debt divided by total assets (0..1). */
  debtToAssets: number;
  /** Interest (riba) income divided by total revenue (0..1). */
  interestIncomeRatio: number;
  /** Non-permissible revenue divided by total revenue (0..1). */
  nonCompliantRevenueRatio: number;
  /** Accounts receivable divided by total assets (0..1). */
  receivablesToAssets?: number;
}

export interface RevenueSegment {
  name: string;
  /** 0..1 share of total revenue. */
  share: number;
  prohibited: boolean;
  reason?: string;
}

export interface ComplianceCheck {
  id: string;
  labelKey: string;
  passed: boolean;
  borderline: boolean;
  value: number | null;
  threshold: number | null;
  detail?: string;
}

export interface ComplianceAssessment {
  status: ComplianceStatus;
  score: number;
  checks: ComplianceCheck[];
  reasons: string[];
  purificationRate: number;
}

export interface ComplianceReport {
  id: string;
  stockId: string;
  provider: ComplianceProvider;
  status: ComplianceStatus;
  score: number | null;
  ratios: FinancialRatios;
  revenueSegments: RevenueSegment[];
  reasons: string[];
  purificationRate: number | null;
  sourceUrl: string | null;
  reviewedBy: string | null;
  effectiveAt: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface StockIndicatorSnapshot {
  stockId: string;
  asOf: string;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  volumeAvg20: number | null;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface PriceAlert {
  id: string;
  userId: string;
  stockId: string;
  alertType: AlertType;
  operator: AlertOperator;
  targetPrice: number | null;
  indicator: IndicatorName | null;
  threshold: number | null;
  params: Record<string, number>;
  status: AlertStatus;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  notifyEmail: boolean;
  notifyPush: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  baseCurrency: string;
  isSimulated: boolean;
  createdAt: string;
}

export interface Holding {
  id: string;
  portfolioId: string;
  stockId: string;
  shares: number;
  averageCost: number;
  openedAt: string;
}

export interface PortfolioTransaction {
  id: string;
  portfolioId: string;
  stockId: string;
  type: TransactionType;
  shares: number;
  price: number;
  fees: number;
  executedAt: string;
  notes: string | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  titleKey: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface TopStock {
  stock: Stock;
  quote: StockQuote | null;
  compliance: {
    status: ComplianceStatus;
    score: number | null;
    purificationRate: number | null;
    lastCheckedAt: string | null;
    provider: ComplianceProvider | null;
  };
}

export interface PortfolioPosition extends Holding {
  stock: Stock;
  quote: StockQuote | null;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  compliant: boolean;
}

export interface PortfolioSummary {
  portfolio: Portfolio;
  positions: PortfolioPosition[];
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  nonCompliantValue: number;
}

export interface AdminMetrics {
  totalUsers: number;
  activeUsers30d: number;
  newUsers7d: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  mrrCents: number;
  churnRate: number;
  alertsActive: number;
  alertsTriggered24h: number;
  apiCalls24h: number;
  apiErrorRate: number;
  p95LatencyMs: number;
}

export interface AuditLogEntry {
  id: number;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
