import { describe, expect, it } from 'vitest';

import {
  mapStripeStatus,
  normalizeStripeSubscription,
  unixToIso,
  yearlySavingsPercent,
} from '../src/stripe/billing';
import {
  computeStripeSignature,
  timingSafeEqualHex,
  verifyStripeSignature,
} from '../src/stripe/signature';

const SECRET = 'whsec_test_secret';
const PAYLOAD = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
const NOW = 1_800_000_000;

async function headerFor(timestamp = NOW, secret = SECRET, payload = PAYLOAD): Promise<string> {
  const signature = await computeStripeSignature(payload, secret, timestamp);
  return `t=${timestamp},v1=${signature}`;
}

describe('Stripe webhook signatures', () => {
  it('accepts a valid signature', async () => {
    const result = await verifyStripeSignature({
      payload: PAYLOAD,
      header: await headerFor(),
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result).toEqual({ valid: true, timestamp: NOW });
  });

  it('accepts one of several v1 signatures', async () => {
    const valid = await computeStripeSignature(PAYLOAD, SECRET, NOW);
    const header = `t=${NOW},v1=${'0'.repeat(64)},v1=${valid}`;
    const result = await verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const result = await verifyStripeSignature({
      payload: `${PAYLOAD} `,
      header: await headerFor(),
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects a wrong secret', async () => {
    const result = await verifyStripeSignature({
      payload: PAYLOAD,
      header: await headerFor(NOW, 'whsec_other'),
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects stale timestamps outside the tolerance window', async () => {
    const result = await verifyStripeSignature({
      payload: PAYLOAD,
      header: await headerFor(NOW - 3_600),
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('timestamp_out_of_tolerance');
  });

  it('rejects malformed headers explicitly', async () => {
    const missingHeader = await verifyStripeSignature({
      payload: PAYLOAD,
      header: null,
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(missingHeader.reason).toBe('missing_header');

    const missingTimestamp = await verifyStripeSignature({
      payload: PAYLOAD,
      header: `v1=${'a'.repeat(64)}`,
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(missingTimestamp.reason).toBe('missing_timestamp');

    const missingSignature = await verifyStripeSignature({
      payload: PAYLOAD,
      header: `t=${NOW}`,
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(missingSignature.reason).toBe('missing_signature');
  });

  it('compares signatures without leaking length differences', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'abcde')).toBe(false);
  });
});

describe('Stripe billing normalization', () => {
  it('maps Stripe statuses safely', () => {
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('trialing')).toBe('trialing');
    expect(mapStripeStatus('something_new')).toBe('incomplete');
  });

  it('normalizes a yearly subscription with period dates', () => {
    const normalized = normalizeStripeSubscription({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      metadata: { plan_id: 'pro' },
      cancel_at_period_end: true,
      trial_end: 1_800_000_000,
      items: {
        data: [
          {
            price: { id: 'price_123', recurring: { interval: 'year' } },
            current_period_start: 1_799_000_000,
            current_period_end: 1_830_000_000,
          },
        ],
      },
    });

    expect(normalized).toMatchObject({
      stripeSubscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
      status: 'active',
      interval: 'year',
      planId: 'pro',
      cancelAtPeriodEnd: true,
      stripePriceId: 'price_123',
    });
    expect(normalized.currentPeriodEnd).toBe(new Date(1_830_000_000 * 1000).toISOString());
  });

  it('defaults to monthly and null periods when Stripe data is sparse', () => {
    const normalized = normalizeStripeSubscription({
      id: 'sub_min',
      customer: 'cus_min',
      status: 'incomplete',
    });
    expect(normalized.interval).toBe('month');
    expect(normalized.currentPeriodEnd).toBeNull();
    expect(normalized.trialEnd).toBeNull();
  });

  it('converts unix seconds defensively', () => {
    expect(unixToIso(0)).toBeNull();
    expect(unixToIso(Number.NaN)).toBeNull();
    expect(unixToIso(1_700_000_000)).toBe('2023-11-14T22:13:20.000Z');
  });

  it('calculates yearly savings', () => {
    expect(yearlySavingsPercent(1_200, 11_500)).toBe(20);
    expect(yearlySavingsPercent(1_200, 14_400)).toBe(0);
    expect(yearlySavingsPercent(0, 0)).toBe(0);
  });
});
