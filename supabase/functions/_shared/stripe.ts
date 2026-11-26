import { HttpError, optionalEnv, requireEnv } from './http.ts';

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface StripePrice {
  id: string;
  recurring?: { interval?: string } | null;
}

export interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean | null;
  trial_end?: number | null;
  items?: {
    data?: Array<{
      price?: StripePrice | null;
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  } | null;
}

const STRIPE_API = 'https://api.stripe.com/v1';
const API_VERSION = optionalEnv('STRIPE_API_VERSION') ?? '2024-06-20';

export async function stripeRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, string>;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const secret = requireEnv('STRIPE_SECRET_KEY');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    'Stripe-Version': API_VERSION,
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let body: string | undefined;
  if (options.body) {
    body = new URLSearchParams(options.body).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(`${STRIPE_API}${path}`, {
    method: options.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
  };

  if (!response.ok) {
    console.error('[stripe] API error', response.status, payload.error?.code);
    throw new HttpError(
      502,
      'stripe_error',
      payload.error?.message ?? `Stripe responded ${response.status}`,
    );
  }
  return payload as T;
}

function toHex(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) output += byte.toString(16).padStart(2, '0');
  return output;
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * Stripe `v1` signature verification over the raw body. Must run before the
 * payload is parsed or any database write occurs.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 't') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) {
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === null || signatures.length === 0) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = await hmacHex(`${timestamp}.${payload}`, secret);
  return signatures.some((candidate) => timingSafeEqual(candidate, expected));
}

const STATUS_MAP: Record<string, string> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  paused: 'paused',
};

export function mapStripeStatus(status: string): string {
  return STATUS_MAP[status] ?? 'incomplete';
}

export function unixToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export interface NormalizedSubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  interval: 'month' | 'year';
  planId: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripePriceId: string | null;
}

export function normalizeSubscription(subscription: StripeSubscriptionObject): NormalizedSubscription {
  const item = subscription.items?.data?.[0];
  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer,
    status: mapStripeStatus(subscription.status),
    interval: item?.price?.recurring?.interval === 'year' ? 'year' : 'month',
    planId: subscription.metadata?.plan_id ?? null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    trialEnd: unixToIso(subscription.trial_end),
    currentPeriodStart: unixToIso(item?.current_period_start),
    currentPeriodEnd: unixToIso(item?.current_period_end),
    stripePriceId: item?.price?.id ?? null,
  };
}
