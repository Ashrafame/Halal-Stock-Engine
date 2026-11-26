import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  PLAN_FEATURES,
  PLAN_LIMITS,
  UNLIMITED,
} from '../constants';
import type {
  Plan,
  PlanFeatures,
  PlanLimits,
  PlanTier,
  Subscription,
  SubscriptionStatus,
} from '../types';

export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED;
}

/** `used` has reached `limit`? Unlimited always false. */
export function isLimitReached(used: number, limit: number): boolean {
  return !isUnlimited(limit) && used >= limit;
}

export function remainingQuota(used: number, limit: number): number {
  return isUnlimited(limit) ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);
}

export function limitsFor(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier];
}

export function featuresFor(tier: PlanTier): PlanFeatures {
  return PLAN_FEATURES[tier];
}

/** Runtime plan rows may have custom limits; missing keys fall back to tier defaults. */
export function resolveLimits(plan: Pick<Plan, 'tier' | 'limits'>): PlanLimits {
  return { ...limitsFor(plan.tier), ...(plan.limits ?? {}) };
}

export function resolveFeatures(plan: Pick<Plan, 'tier' | 'features'>): PlanFeatures {
  return { ...featuresFor(plan.tier), ...(plan.features ?? {}) };
}

export interface AlertQuotaDecision {
  allowed: boolean;
  used: number;
  limit: number;
  reason?: 'limit_reached' | 'feature_disabled';
}

export function canCreateAlert(input: {
  plan: Plan;
  activeAlertCount: number;
  alertType: 'price' | 'indicator' | 'compliance';
}): AlertQuotaDecision {
  const limits = resolveLimits(input.plan);
  const features = resolveFeatures(input.plan);

  if (input.alertType === 'indicator' && !features.technicalAlerts) {
    return {
      allowed: false,
      used: input.activeAlertCount,
      limit: limits.maxAlerts,
      reason: 'feature_disabled',
    };
  }

  if (isLimitReached(input.activeAlertCount, limits.maxAlerts)) {
    return {
      allowed: false,
      used: input.activeAlertCount,
      limit: limits.maxAlerts,
      reason: 'limit_reached',
    };
  }

  return { allowed: true, used: input.activeAlertCount, limit: limits.maxAlerts };
}

export function canAddWatchlistItem(input: {
  plan: Plan;
  currentItems: number;
}): boolean {
  return !isLimitReached(input.currentItems, resolveLimits(input.plan).maxWatchlistItems);
}

export function canCreatePortfolio(input: { plan: Plan; currentPortfolios: number }): boolean {
  return !isLimitReached(input.currentPortfolios, resolveLimits(input.plan).maxPortfolios);
}

export function canAddHolding(input: { plan: Plan; currentHoldings: number }): boolean {
  return !isLimitReached(
    input.currentHoldings,
    resolveLimits(input.plan).maxHoldingsPerPortfolio,
  );
}

export function hasFeature(plan: Plan, feature: keyof PlanFeatures): boolean {
  return resolveFeatures(plan)[feature] ?? false;
}

export function isSubscriptionActive(
  subscription: Pick<Subscription, 'status' | 'currentPeriodEnd'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)) return false;
  if (!subscription.currentPeriodEnd) return true;
  const end = new Date(subscription.currentPeriodEnd);
  return Number.isFinite(end.getTime()) ? end.getTime() > now.getTime() : true;
}

/** Maps a Stripe subscription status to our persisted enum. Unknown values are `incomplete`. */
export function normalizeStripeStatus(status: string): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
  ];
  return allowed.includes(status as SubscriptionStatus)
    ? (status as SubscriptionStatus)
    : 'incomplete';
}

/**
 * Effective access tier: a lapsed paid subscription falls back to free limits
 * rather than locking the user out of the product entirely.
 */
export function effectiveTier(plan: Plan | null, subscription: Subscription | null): PlanTier {
  if (!plan) return 'free';
  if (plan.tier === 'free') return 'free';
  return isSubscriptionActive(subscription) ? plan.tier : 'free';
}

export function trialDaysRemaining(subscription: Subscription | null, now: Date = new Date()): number {
  if (!subscription || subscription.status !== 'trialing' || !subscription.trialEnd) return 0;
  const end = new Date(subscription.trialEnd).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

/** Monthly recurring revenue in minor units, from active subscriptions. */
export function monthlyRecurringCents(
  subscriptions: Array<Pick<Subscription, 'status' | 'interval'>>,
  monthlyPriceCents: number,
  yearlyPriceCents: number,
): number {
  return subscriptions.reduce((total, subscription) => {
    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)) return total;
    const cents =
      subscription.interval === 'year'
        ? Math.round(yearlyPriceCents / 12)
        : monthlyPriceCents;
    return total + cents;
  }, 0);
}
