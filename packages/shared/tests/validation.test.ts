import { describe, expect, it } from 'vitest';

import { PLAN_CATALOG } from '../src/constants';
import {
  adminPlanSchema,
  adminUserUpdateSchema,
  alertInputSchema,
  checkoutRequestSchema,
  fieldErrors,
  holdingInputSchema,
  oneClickAlertSchema,
  paginationSchema,
  passwordSchema,
  signupSchema,
  stockComplianceOverrideSchema,
  translationUpsertSchema,
} from '../src/validation/schemas';

const STOCK_ID = '11111111-1111-4111-8111-111111110001';
const USER_ID = '99999999-9999-4999-8999-999999999999';

describe('input validation', () => {
  it('requires a target price for price alerts', () => {
    const missing = alertInputSchema.safeParse({ stockId: STOCK_ID, alertType: 'price' });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.path).toEqual(['targetPrice']);
    }

    const valid = alertInputSchema.parse({
      stockId: STOCK_ID,
      alertType: 'price',
      targetPrice: 250,
    });
    expect(valid.operator).toBe('above');
    expect(valid.notifyEmail).toBe(true);
    expect(valid.notifyPush).toBe(true);
  });

  it('requires an indicator for indicator alerts', () => {
    const result = alertInputSchema.safeParse({
      stockId: STOCK_ID,
      alertType: 'indicator',
    });
    expect(result.success).toBe(false);
  });

  it('rejects past expiry dates', () => {
    const result = alertInputSchema.safeParse({
      stockId: STOCK_ID,
      alertType: 'price',
      targetPrice: 100,
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a minimal one-click alert payload', () => {
    const parsed = oneClickAlertSchema.parse({ stockId: STOCK_ID });
    expect(parsed.operator).toBe('above');
    expect(parsed.targetPrice).toBeUndefined();
  });

  it('rejects invalid UUIDs', () => {
    expect(oneClickAlertSchema.safeParse({ stockId: 'not-a-uuid' }).success).toBe(false);
  });

  it('enforces password strength', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('alllettersonly').success).toBe(false);
    expect(passwordSchema.safeParse('StrongPass123').success).toBe(true);
  });

  it('requires terms acceptance at signup', () => {
    const base = {
      email: 'investor@example.com',
      password: 'StrongPass123',
      acceptedTerms: true as const,
    };
    expect(signupSchema.safeParse(base).success).toBe(true);
    expect(
      signupSchema.safeParse({ ...base, acceptedTerms: false }).success,
    ).toBe(false);
  });

  it('validates holdings and checkout URLs', () => {
    expect(
      holdingInputSchema.safeParse({
        portfolioId: USER_ID,
        stockId: STOCK_ID,
        shares: 10,
        averageCost: 100,
      }).success,
    ).toBe(true);
    expect(
      holdingInputSchema.safeParse({
        portfolioId: USER_ID,
        stockId: STOCK_ID,
        shares: -1,
        averageCost: 100,
      }).success,
    ).toBe(false);
    expect(
      checkoutRequestSchema.safeParse({
        planId: 'pro',
        interval: 'month',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }).success,
    ).toBe(true);
    expect(
      checkoutRequestSchema.safeParse({
        planId: 'pro',
        successUrl: 'javascript:alert(1)',
        cancelUrl: 'https://example.com',
      }).success,
    ).toBe(false);
  });

  it('validates a complete admin plan payload', () => {
    const pro = PLAN_CATALOG.find((plan) => plan.tier === 'pro')!;
    const parsed = adminPlanSchema.parse({
      ...pro,
      syncStripe: true,
    });
    expect(parsed.syncStripe).toBe(true);
    expect(parsed.limits.maxAlerts).toBe(pro.limits.maxAlerts);

    expect(adminPlanSchema.safeParse({ ...pro, id: 'Pro Plan' }).success).toBe(false);
    expect(adminPlanSchema.safeParse({ ...pro, priceMonthlyCents: -5 }).success).toBe(false);
  });

  it('requires at least one user change and validates roles', () => {
    expect(adminUserUpdateSchema.safeParse({ userId: USER_ID }).success).toBe(false);
    expect(
      adminUserUpdateSchema.safeParse({ userId: USER_ID, status: 'suspended' }).success,
    ).toBe(true);
    expect(
      adminUserUpdateSchema.safeParse({ userId: USER_ID, role: 'root' }).success,
    ).toBe(false);
  });

  it('validates CMS translation keys', () => {
    expect(
      translationUpsertSchema.safeParse({
        locale: 'ar',
        namespace: 'landing',
        key: 'heroTitle',
        value: 'عنوان',
      }).success,
    ).toBe(true);
    expect(
      translationUpsertSchema.safeParse({
        locale: 'ar',
        namespace: 'landing',
        key: 'bad key',
        value: 'x',
      }).success,
    ).toBe(false);
  });

  it('requires an auditable reason for compliance overrides', () => {
    const result = stockComplianceOverrideSchema.safeParse({
      stockId: STOCK_ID,
      status: 'halal',
      reason: 'short',
    });
    expect(result.success).toBe(false);
    expect(
      stockComplianceOverrideSchema.safeParse({
        stockId: STOCK_ID,
        status: 'halal',
        reason: 'Reviewed by scholar on 2026-11-25',
      }).success,
    ).toBe(true);
  });

  it('coerces pagination query parameters with caps', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(paginationSchema.parse({ page: '2', pageSize: '10' })).toMatchObject({
      page: 2,
      pageSize: 10,
    });
    expect(paginationSchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('flattens zod errors for form rendering', () => {
    const result = alertInputSchema.safeParse({ stockId: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.stockId).toBeDefined();
    }
  });
});
