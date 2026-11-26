import { PLAN_CATALOG } from '../constants';
import type {
  AdminMetrics,
  AppNotification,
  AuditLogEntry,
  Plan,
  PortfolioSummary,
  PriceAlert,
  Profile,
  Stock,
  StockQuote,
  Subscription,
  TopStock,
} from '../types';

/**
 * Deterministic fixtures used by the web and mobile shells when Supabase is not
 * configured. They are clearly labelled as demo data in the UI and are never
 * written back to a database.
 */

const CHECKED_AT = '2026-11-25T06:00:00.000Z';
const QUOTE_AT = '2026-11-25T14:30:00.000Z';

function stock(input: {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  nameAr: string;
  nameEs: string;
  sector: string;
  industry: string;
  country: string;
  currency?: string;
  marketCap: number;
  status: Stock['complianceStatus'];
  score: number;
}): Stock {
  return {
    id: input.id,
    symbol: input.symbol,
    exchange: input.exchange,
    name: input.name,
    nameAr: input.nameAr,
    nameEs: input.nameEs,
    sector: input.sector,
    industry: input.industry,
    country: input.country,
    currency: input.currency ?? 'USD',
    logoUrl: null,
    marketCap: input.marketCap,
    complianceStatus: input.status,
    complianceScore: input.score,
    lastComplianceCheck: CHECKED_AT,
    isActive: true,
    createdAt: '2026-01-04T00:00:00.000Z',
    updatedAt: CHECKED_AT,
  };
}

export const DEMO_STOCKS: Stock[] = [
  stock({
    id: '11111111-1111-4111-8111-111111110001',
    symbol: 'AAPL',
    exchange: 'NASDAQ',
    name: 'Apple Inc.',
    nameAr: 'شركة أبل',
    nameEs: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    country: 'US',
    marketCap: 3_420_000_000_000,
    status: 'halal',
    score: 96,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110002',
    symbol: 'MSFT',
    exchange: 'NASDAQ',
    name: 'Microsoft Corporation',
    nameAr: 'مايكروسوفت',
    nameEs: 'Microsoft Corporation',
    sector: 'Technology',
    industry: 'Software Infrastructure',
    country: 'US',
    marketCap: 3_180_000_000_000,
    status: 'halal',
    score: 94,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110003',
    symbol: 'NVDA',
    exchange: 'NASDAQ',
    name: 'NVIDIA Corporation',
    nameAr: 'إنفيديا',
    nameEs: 'NVIDIA Corporation',
    sector: 'Technology',
    industry: 'Semiconductors',
    country: 'US',
    marketCap: 2_950_000_000_000,
    status: 'halal',
    score: 92,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110004',
    symbol: 'TSM',
    exchange: 'NYSE',
    name: 'Taiwan Semiconductor Manufacturing',
    nameAr: 'تي إس إم سي',
    nameEs: 'Taiwan Semiconductor',
    sector: 'Technology',
    industry: 'Semiconductors',
    country: 'TW',
    marketCap: 890_000_000_000,
    status: 'halal',
    score: 91,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110005',
    symbol: 'JNJ',
    exchange: 'NYSE',
    name: 'Johnson & Johnson',
    nameAr: 'جونسون آند جونسون',
    nameEs: 'Johnson & Johnson',
    sector: 'Healthcare',
    industry: 'Pharmaceuticals',
    country: 'US',
    marketCap: 410_000_000_000,
    status: 'halal',
    score: 90,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110006',
    symbol: 'GOOGL',
    exchange: 'NASDAQ',
    name: 'Alphabet Inc.',
    nameAr: 'ألفابت',
    nameEs: 'Alphabet Inc.',
    sector: 'Communication Services',
    industry: 'Internet Content',
    country: 'US',
    marketCap: 2_240_000_000_000,
    status: 'halal',
    score: 88,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110007',
    symbol: 'AMZN',
    exchange: 'NASDAQ',
    name: 'Amazon.com Inc.',
    nameAr: 'أمازون',
    nameEs: 'Amazon.com Inc.',
    sector: 'Consumer Discretionary',
    industry: 'Internet Retail',
    country: 'US',
    marketCap: 2_310_000_000_000,
    status: 'halal',
    score: 85,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110008',
    symbol: 'XOM',
    exchange: 'NYSE',
    name: 'Exxon Mobil Corporation',
    nameAr: 'إكسون موبيل',
    nameEs: 'Exxon Mobil',
    sector: 'Energy',
    industry: 'Integrated Oil & Gas',
    country: 'US',
    marketCap: 480_000_000_000,
    status: 'halal',
    score: 83,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110009',
    symbol: 'UNH',
    exchange: 'NYSE',
    name: 'UnitedHealth Group',
    nameAr: 'يونايتد هيلث',
    nameEs: 'UnitedHealth Group',
    sector: 'Healthcare',
    industry: 'Managed Healthcare',
    country: 'US',
    marketCap: 520_000_000_000,
    status: 'questionable',
    score: 72,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110010',
    symbol: 'TSLA',
    exchange: 'NASDAQ',
    name: 'Tesla Inc.',
    nameAr: 'تسلا',
    nameEs: 'Tesla Inc.',
    sector: 'Consumer Discretionary',
    industry: 'Automobiles',
    country: 'US',
    marketCap: 780_000_000_000,
    status: 'questionable',
    score: 68,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110011',
    symbol: 'BUD',
    exchange: 'NYSE',
    name: 'Anheuser-Busch InBev',
    nameAr: 'أنهايزر بوش',
    nameEs: 'Anheuser-Busch InBev',
    sector: 'Consumer Staples',
    industry: 'Breweries',
    country: 'BE',
    marketCap: 130_000_000_000,
    status: 'haram',
    score: 8,
  }),
  stock({
    id: '11111111-1111-4111-8111-111111110012',
    symbol: 'JPM',
    exchange: 'NYSE',
    name: 'JPMorgan Chase & Co.',
    nameAr: 'جيه بي مورجان',
    nameEs: 'JPMorgan Chase',
    sector: 'Financials',
    industry: 'Conventional Banking',
    country: 'US',
    marketCap: 640_000_000_000,
    status: 'haram',
    score: 12,
  }),
];

const QUOTE_VALUES: Record<string, [price: number, previousClose: number, volume: number]> = {
  AAPL: [241.18, 238.42, 51_240_000],
  MSFT: [512.66, 516.1, 22_410_000],
  NVDA: [188.94, 183.62, 214_800_000],
  TSM: [301.45, 297.8, 12_940_000],
  JNJ: [168.22, 167.4, 7_320_000],
  GOOGL: [204.88, 207.31, 31_760_000],
  AMZN: [236.5, 231.9, 44_180_000],
  XOM: [118.74, 120.02, 18_330_000],
  UNH: [342.11, 348.6, 9_840_000],
  TSLA: [421.3, 410.15, 98_220_000],
  BUD: [61.2, 61.9, 3_120_000],
  JPM: [298.74, 296.2, 12_010_000],
};

export const DEMO_QUOTES: StockQuote[] = DEMO_STOCKS.map((item) => {
  const [price, previousClose, volume] = QUOTE_VALUES[item.symbol] ?? [100, 100, 1_000_000];
  const change = price - previousClose;
  return {
    stockId: item.id,
    price,
    previousClose,
    change,
    changePercent: previousClose > 0 ? change / previousClose : 0,
    dayHigh: Math.max(price, previousClose) * 1.012,
    dayLow: Math.min(price, previousClose) * 0.988,
    volume,
    source: 'demo',
    asOf: QUOTE_AT,
  };
});

export const DEMO_PLANS: Plan[] = PLAN_CATALOG.map((plan) => ({ ...plan }));

export const DEMO_PROFILE: Profile = {
  id: '99999999-9999-4999-8999-999999999999',
  email: 'investor@example.com',
  fullName: 'Amina Rahman',
  avatarUrl: null,
  locale: 'en',
  role: 'user',
  status: 'active',
  timezone: 'Europe/London',
  stripeCustomerId: 'cus_demo',
  notifyEmail: true,
  notifyPush: true,
  onboardingCompleted: true,
  createdAt: '2026-02-11T09:12:00.000Z',
  updatedAt: '2026-11-20T18:02:00.000Z',
};

export const DEMO_ADMIN_PROFILE: Profile = {
  ...DEMO_PROFILE,
  id: '99999999-9999-4999-8999-999999999998',
  email: 'admin@example.com',
  fullName: 'Yusuf Admin',
  role: 'owner',
  locale: 'en',
};

export const DEMO_SUBSCRIPTION: Subscription = {
  id: '88888888-8888-4888-8888-888888888888',
  userId: DEMO_PROFILE.id,
  planId: 'pro',
  stripeCustomerId: 'cus_demo',
  stripeSubscriptionId: 'sub_demo',
  status: 'active',
  interval: 'month',
  currentPeriodStart: '2026-11-01T00:00:00.000Z',
  currentPeriodEnd: '2026-12-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  trialEnd: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

export const DEMO_ALERTS: PriceAlert[] = [
  {
    id: '77777777-7777-4777-8777-777777777701',
    userId: DEMO_PROFILE.id,
    stockId: DEMO_STOCKS[0]!.id,
    alertType: 'price',
    operator: 'above',
    targetPrice: 255,
    indicator: null,
    threshold: null,
    params: {},
    status: 'active',
    cooldownMinutes: 5,
    lastTriggeredAt: null,
    notifyEmail: true,
    notifyPush: true,
    expiresAt: null,
    createdAt: '2026-11-18T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777702',
    userId: DEMO_PROFILE.id,
    stockId: DEMO_STOCKS[2]!.id,
    alertType: 'indicator',
    operator: 'above',
    targetPrice: null,
    indicator: 'rsi_14',
    threshold: 72,
    params: {},
    status: 'active',
    cooldownMinutes: 30,
    lastTriggeredAt: '2026-11-24T15:10:00.000Z',
    notifyEmail: false,
    notifyPush: true,
    expiresAt: null,
    createdAt: '2026-11-20T08:30:00.000Z',
  },
];

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: '66666666-6666-4666-8666-666666666601',
    userId: DEMO_PROFILE.id,
    type: 'alert_triggered',
    titleKey: 'alerts.messages.price',
    body: 'NVDA is at 188.94, meeting your above 185.00 alert.',
    data: { symbol: 'NVDA' },
    readAt: null,
    createdAt: '2026-11-24T15:10:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666602',
    userId: DEMO_PROFILE.id,
    type: 'compliance_update',
    titleKey: 'alerts.messages.complianceDowngrade',
    body: 'TSLA moved to questionable. Review your holdings.',
    data: { symbol: 'TSLA' },
    readAt: '2026-11-23T09:00:00.000Z',
    createdAt: '2026-11-22T06:00:00.000Z',
  },
];

export function demoTops(limit = 6): TopStock[] {
  return DEMO_STOCKS.filter((item) => item.complianceStatus === 'halal')
    .sort((a, b) => (b.complianceScore ?? 0) - (a.complianceScore ?? 0))
    .slice(0, limit)
    .map((item) => {
      const quote = DEMO_QUOTES.find((candidate) => candidate.stockId === item.id) ?? null;
      return {
        stock: item,
        quote,
        compliance: {
          status: item.complianceStatus,
          score: item.complianceScore,
          purificationRate: 0.028,
          lastCheckedAt: item.lastComplianceCheck,
          provider: 'internal',
        },
      };
    });
}

export const DEMO_PORTFOLIO: PortfolioSummary = {
  portfolio: {
    id: '55555555-5555-4555-8555-555555555501',
    userId: DEMO_PROFILE.id,
    name: 'Long-term halal',
    baseCurrency: 'USD',
    isSimulated: true,
    createdAt: '2026-03-02T00:00:00.000Z',
  },
  positions: [
    {
      id: '44444444-4444-4444-8444-444444444401',
      portfolioId: '55555555-5555-4555-8555-555555555501',
      stockId: DEMO_STOCKS[0]!.id,
      shares: 12,
      averageCost: 205.4,
      openedAt: '2026-03-04T00:00:00.000Z',
      stock: DEMO_STOCKS[0]!,
      quote: DEMO_QUOTES[0]!,
      marketValue: 2_894.16,
      costBasis: 2_464.8,
      unrealizedPnl: 429.36,
      unrealizedPnlPercent: 0.1742,
      compliant: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444402',
      portfolioId: '55555555-5555-4555-8555-555555555501',
      stockId: DEMO_STOCKS[2]!.id,
      shares: 20,
      averageCost: 142.1,
      openedAt: '2026-04-12T00:00:00.000Z',
      stock: DEMO_STOCKS[2]!,
      quote: DEMO_QUOTES[2]!,
      marketValue: 3_778.8,
      costBasis: 2_842,
      unrealizedPnl: 936.8,
      unrealizedPnlPercent: 0.3296,
      compliant: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444403',
      portfolioId: '55555555-5555-4555-8555-555555555501',
      stockId: DEMO_STOCKS[9]!.id,
      shares: 5,
      averageCost: 320,
      openedAt: '2026-06-20T00:00:00.000Z',
      stock: DEMO_STOCKS[9]!,
      quote: DEMO_QUOTES[9]!,
      marketValue: 2_106.5,
      costBasis: 1_600,
      unrealizedPnl: 506.5,
      unrealizedPnlPercent: 0.3166,
      compliant: false,
    },
  ],
  marketValue: 8_779.46,
  costBasis: 6_906.8,
  unrealizedPnl: 1_872.66,
  unrealizedPnlPercent: 0.2711,
  nonCompliantValue: 2_106.5,
};

export const DEMO_ADMIN_METRICS: AdminMetrics = {
  totalUsers: 18_426,
  activeUsers30d: 7_912,
  newUsers7d: 612,
  activeSubscriptions: 2_184,
  trialingSubscriptions: 318,
  mrrCents: 2_982_400,
  churnRate: 0.021,
  alertsActive: 14_208,
  alertsTriggered24h: 1_942,
  apiCalls24h: 486_210,
  apiErrorRate: 0.0032,
  p95LatencyMs: 214,
};

export const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 1042,
    actorId: DEMO_ADMIN_PROFILE.id,
    actorEmail: DEMO_ADMIN_PROFILE.email,
    action: 'plan.updated',
    entityType: 'plan',
    entityId: 'pro',
    before: { priceMonthlyCents: 1000 },
    after: { priceMonthlyCents: 1200 },
    ip: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-11-24T11:02:00.000Z',
  },
  {
    id: 1041,
    actorId: DEMO_ADMIN_PROFILE.id,
    actorEmail: DEMO_ADMIN_PROFILE.email,
    action: 'stock.compliance_override',
    entityType: 'stock',
    entityId: DEMO_STOCKS[9]!.id,
    before: { status: 'halal' },
    after: { status: 'questionable', reason: 'Revenue mix review pending' },
    ip: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-11-22T06:00:00.000Z',
  },
  {
    id: 1040,
    actorId: DEMO_ADMIN_PROFILE.id,
    actorEmail: DEMO_ADMIN_PROFILE.email,
    action: 'user.suspended',
    entityType: 'profile',
    entityId: '99999999-9999-4999-8999-999999999997',
    before: { status: 'active' },
    after: { status: 'suspended' },
    ip: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-11-20T16:44:00.000Z',
  },
];

export const DEMO_TOP_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSM', 'JNJ', 'GOOGL'] as const;
