import type { Plan, PlanFeatures, PlanLimits, PlanTier, SubscriptionStatus } from './types';

/** Sentinel for "no limit". Kept as -1 so JSON/DB round-trips cleanly. */
export const UNLIMITED = -1;

export const DEFAULT_ALERT_COOLDOWN_MINUTES = 30;

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    realtimeQuotes: false,
    technicalAlerts: false,
    emailAlerts: true,
    pushAlerts: true,
    portfolioTracking: true,
    complianceReports: false,
    exportData: false,
    prioritySupport: false,
  },
  pro: {
    realtimeQuotes: true,
    technicalAlerts: true,
    emailAlerts: true,
    pushAlerts: true,
    portfolioTracking: true,
    complianceReports: true,
    exportData: true,
    prioritySupport: false,
  },
  enterprise: {
    realtimeQuotes: true,
    technicalAlerts: true,
    emailAlerts: true,
    pushAlerts: true,
    portfolioTracking: true,
    complianceReports: true,
    exportData: true,
    prioritySupport: true,
  },
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxAlerts: 3,
    maxWatchlistItems: 10,
    maxPortfolios: 1,
    maxHoldingsPerPortfolio: 10,
    apiRequestsPerDay: 100,
    alertCooldownMinutes: 60,
  },
  pro: {
    maxAlerts: 50,
    maxWatchlistItems: 200,
    maxPortfolios: 5,
    maxHoldingsPerPortfolio: 100,
    apiRequestsPerDay: 10_000,
    alertCooldownMinutes: 5,
  },
  enterprise: {
    maxAlerts: UNLIMITED,
    maxWatchlistItems: UNLIMITED,
    maxPortfolios: UNLIMITED,
    maxHoldingsPerPortfolio: UNLIMITED,
    apiRequestsPerDay: UNLIMITED,
    alertCooldownMinutes: 1,
  },
};

/**
 * Canonical plan catalog. Supabase seeds these rows; the admin dashboard may
 * edit them at runtime (and syncs price changes to Stripe).
 */
export const PLAN_CATALOG: readonly Plan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'Free',
    description: 'Screen halal stocks and track one portfolio, forever free.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    currency: 'USD',
    trialDays: 0,
    limits: PLAN_LIMITS.free,
    features: PLAN_FEATURES.free,
    stripeProductId: null,
    stripePriceMonthlyId: null,
    stripePriceYearlyId: null,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'pro',
    tier: 'pro',
    name: 'Pro',
    description: 'Real-time data, technical alerts and unlimited screening for serious investors.',
    priceMonthlyCents: 1200,
    priceYearlyCents: 11500,
    currency: 'USD',
    trialDays: 14,
    limits: PLAN_LIMITS.pro,
    features: PLAN_FEATURES.pro,
    stripeProductId: null,
    stripePriceMonthlyId: null,
    stripePriceYearlyId: null,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'enterprise',
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited alerts, team access, API quota and priority Sharia support.',
    priceMonthlyCents: 4900,
    priceYearlyCents: 47000,
    currency: 'USD',
    trialDays: 30,
    limits: PLAN_LIMITS.enterprise,
    features: PLAN_FEATURES.enterprise,
    stripeProductId: null,
    stripePriceMonthlyId: null,
    stripePriceYearlyId: null,
    isActive: true,
    sortOrder: 3,
  },
];

export const ACTIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['active', 'trialing'];

export const PAST_DUE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'past_due',
  'unpaid',
];

/** Markets covered by default by the data pipeline. */
export const SUPPORTED_EXCHANGES = ['NASDAQ', 'NYSE', 'AMEX', 'LSE', 'TADAWUL', 'DFM', 'ADX'] as const;

export const SUPPORTED_CURRENCIES = ['USD', 'GBP', 'SAR', 'AED', 'EUR'] as const;
