import { describe, expect, it } from 'vitest';

import { PLAN_CATALOG } from '../src/constants';
import {
  canAddHolding,
  canAddWatchlistItem,
  canCreateAlert,
  canCreatePortfolio,
  effectiveTier,
  hasFeature,
  isLimitReached,
  isSubscriptionActive,
  monthlyRecurringCents,
  remainingQuota,
  resolveLimits,
  trialDaysRemaining,
} from '../src/subscriptions/entitlements';
import type { Plan, Subscription } from '../src/types';

const free = PLAN_CATALOG.find((plan) => plan.tier === 'free') as Plan;
const pro = PLAN_CATALOG.find((plan) => plan.tier === 'pro') as Plan;
const enterprise = PLAN_CATALOG.find((plan) => plan.tier === 'enterprise') as Plan;

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-row',
    userId: 'user',
    planId: 'pro',
    stripeCustomerId: 'cus',
    stripeSubscriptionId: 'sub',
    status: 'active',
    interval: 'month',
    currentPeriodStart: '2026-11-01T00:00:00.000Z',
    currentPeriodEnd: '2026-12-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    trialEnd: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('subscription entitlements', () => {
  it('enforces the free alert limit', () => {
    expect(canCreateAlert({ plan: free, activeAlertCount: 2, alertType: 'price' }).allowed).toBe(
      true,
    );
    const blocked = canCreateAlert({ plan: free, activeAlertCount: 3, alertType: 'price' });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('limit_reached');
  });

  it('blocks technical alerts on the free tier', () => {
    const decision = canCreateAlert({
      plan: free,
      activeAlertCount: 0,
      alertType: 'indicator',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('feature_disabled');
  });

  it('allows technical alerts on pro', () => {
    expect(
      canCreateAlert({ plan: pro, activeAlertCount: 0, alertType: 'indicator' }).allowed,
    ).toBe(true);
  });

  it('treats enterprise limits as unlimited', () => {
    const decision = canCreateAlert({
      plan: enterprise,
      activeAlertCount: 100_000,
      alertType: 'indicator',
    });
    expect(decision.allowed).toBe(true);
    expect(remainingQuota(100_000, resolveLimits(enterprise).maxAlerts)).toBe(Infinity);
    expect(isLimitReached(1_000, resolveLimits(enterprise).maxAlerts)).toBe(false);
  });

  it('applies watchlist, portfolio and holding limits', () => {
    expect(canAddWatchlistItem({ plan: free, currentItems: 9 })).toBe(true);
    expect(canAddWatchlistItem({ plan: free, currentItems: 10 })).toBe(false);
    expect(canCreatePortfolio({ plan: free, currentPortfolios: 1 })).toBe(false);
    expect(canAddHolding({ plan: pro, currentHoldings: 100 })).toBe(false);
    expect(canAddHolding({ plan: enterprise, currentHoldings: 999 })).toBe(true);
  });

  it('merges runtime plan overrides with tier defaults', () => {
    const custom: Plan = {
      ...pro,
      limits: { ...pro.limits, maxAlerts: 7 },
    };
    expect(resolveLimits(custom).maxAlerts).toBe(7);
    expect(resolveLimits(custom).maxWatchlistItems).toBe(pro.limits.maxWatchlistItems);
  });

  it('exposes feature flags per tier', () => {
    expect(hasFeature(free, 'realtimeQuotes')).toBe(false);
    expect(hasFeature(pro, 'realtimeQuotes')).toBe(true);
    expect(hasFeature(enterprise, 'prioritySupport')).toBe(true);
  });

  it('validates subscription windows', () => {
    const now = new Date('2026-11-25T00:00:00.000Z');
    expect(isSubscriptionActive(subscription(), now)).toBe(true);
    expect(isSubscriptionActive(subscription({ status: 'canceled' }), now)).toBe(false);
    expect(
      isSubscriptionActive(subscription({ currentPeriodEnd: '2026-11-01T00:00:00.000Z' }), now),
    ).toBe(false);
    expect(isSubscriptionActive(null, now)).toBe(false);
  });

  it('falls back to free when a paid subscription lapses', () => {
    expect(effectiveTier(pro, subscription())).toBe('pro');
    expect(effectiveTier(pro, subscription({ status: 'canceled' }))).toBe('free');
    expect(effectiveTier(free, null)).toBe('free');
    expect(effectiveTier(null, null)).toBe('free');
  });

  it('counts trial days remaining', () => {
    const trial = subscription({
      status: 'trialing',
      trialEnd: '2026-12-05T00:00:00.000Z',
    });
    expect(trialDaysRemaining(trial, new Date('2026-11-25T00:00:00.000Z'))).toBe(10);
    expect(trialDaysRemaining(subscription(), new Date())).toBe(0);
  });

  it('computes MRR from active monthly and yearly subscriptions', () => {
    const mrr = monthlyRecurringCents(
      [
        { status: 'active', interval: 'month' },
        { status: 'active', interval: 'year' },
        { status: 'canceled', interval: 'month' },
      ],
      1_200,
      11_500,
    );
    expect(mrr).toBe(1_200 + Math.round(11_500 / 12));
  });
});
