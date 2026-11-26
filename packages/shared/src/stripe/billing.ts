import type { BillingInterval, SubscriptionStatus } from '../types';

/** Only these events mutate subscription state; everything else is acknowledged. */
export const HANDLED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

export type HandledStripeEvent = (typeof HANDLED_STRIPE_EVENTS)[number];

export function isHandledStripeEvent(type: string): type is HandledStripeEvent {
  return (HANDLED_STRIPE_EVENTS as readonly string[]).includes(type);
}

/** Minimal Stripe shapes — avoids a runtime dependency in shared code. */
export interface StripeSubscriptionLike {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean | null;
  trial_end?: number | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
        recurring?: { interval?: string } | null;
      } | null;
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  } | null;
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  paused: 'paused',
};

export function mapStripeStatus(status: string): SubscriptionStatus {
  return STATUS_MAP[status] ?? 'incomplete';
}

export function unixToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export interface NormalizedSubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  planId: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripePriceId: string | null;
}

export function normalizeStripeSubscription(
  subscription: StripeSubscriptionLike,
): NormalizedSubscription {
  const item = subscription.items?.data?.[0];
  const interval = item?.price?.recurring?.interval === 'year' ? 'year' : 'month';
  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer,
    status: mapStripeStatus(subscription.status),
    interval,
    planId: subscription.metadata?.plan_id ?? null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    trialEnd: unixToIso(subscription.trial_end),
    currentPeriodStart: unixToIso(item?.current_period_start),
    currentPeriodEnd: unixToIso(item?.current_period_end),
    stripePriceId: item?.price?.id ?? null,
  };
}

export function yearlySavingsPercent(monthlyCents: number, yearlyCents: number): number {
  if (monthlyCents <= 0 || yearlyCents <= 0) return 0;
  const fullYear = monthlyCents * 12;
  if (yearlyCents >= fullYear) return 0;
  return Math.round(((fullYear - yearlyCents) / fullYear) * 100);
}

export function monthlyEquivalentCents(
  priceMonthlyCents: number,
  priceYearlyCents: number,
  interval: BillingInterval,
): number {
  return interval === 'year' ? Math.round(priceYearlyCents / 12) : priceMonthlyCents;
}
