import { describe, expect, it } from 'vitest';

import {
  SHARIA_THRESHOLDS,
  assessCompliance,
  calculatePurification,
  isAlertable,
  screenBusinessActivity,
  screenFinancials,
} from '../src/sharia/screening';

const healthy = {
  debtToAssets: 0.2,
  interestIncomeRatio: 0.01,
  nonCompliantRevenueRatio: 0.005,
  receivablesToAssets: 0.3,
};

describe('Sharia screening engine', () => {
  it('passes a clean technology company', () => {
    const result = assessCompliance({
      sector: 'Technology',
      industry: 'Consumer Electronics',
      ratios: healthy,
      segments: [{ name: 'Hardware', share: 1, prohibited: false }],
    });

    expect(result.status).toBe('halal');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.reasons).toHaveLength(0);
    expect(result.purificationRate).toBeCloseTo(0.015);
  });

  it('fails on interest-bearing debt above 33% of assets', () => {
    const result = assessCompliance({
      sector: 'Technology',
      ratios: { ...healthy, debtToAssets: 0.45 },
    });

    expect(result.status).toBe('haram');
    expect(result.reasons).toContain('screening.reasons.debt');
    expect(result.score).toBeLessThanOrEqual(39);
  });

  it('fails on interest income above 5% of revenue', () => {
    const result = assessCompliance({
      sector: 'Technology',
      ratios: { ...healthy, interestIncomeRatio: 0.08 },
    });

    expect(result.status).toBe('haram');
    expect(result.reasons).toContain('screening.reasons.interest');
  });

  it('flags a company close to the debt ceiling as questionable, not halal', () => {
    const result = assessCompliance({
      sector: 'Technology',
      ratios: { ...healthy, debtToAssets: 0.3 },
    });

    expect(result.status).toBe('questionable');
    expect(result.checks.find((check) => check.id === 'debt_to_assets')?.borderline).toBe(true);
    expect(result.score).toBeLessThanOrEqual(74);
  });

  it('rejects a prohibited core sector regardless of ratios', () => {
    const result = assessCompliance({
      sector: 'Financials',
      industry: 'Conventional Banking',
      ratios: healthy,
    });

    expect(result.status).toBe('haram');
    expect(result.reasons).toContain('screening.reasons.prohibited_sector');
  });

  it('rejects a company whose prohibited revenue exceeds 5%', () => {
    const business = screenBusinessActivity({
      sector: 'Consumer Discretionary',
      segments: [
        { name: 'Retail', share: 0.9, prohibited: false },
        { name: 'Alcohol sales', share: 0.1, prohibited: true },
      ],
    });

    expect(business.status).toBe('haram');
    expect(business.nonCompliantRevenueRatio).toBeCloseTo(0.1);
  });

  it('treats mixed but tiny prohibited revenue as questionable', () => {
    const result = assessCompliance({
      sector: 'Consumer Discretionary',
      ratios: { ...healthy, nonCompliantRevenueRatio: 0.045 },
      segments: [
        { name: 'Retail', share: 0.96, prohibited: false },
        { name: 'Alcohol sales', share: 0.04, prohibited: true },
      ],
    });

    expect(result.status).toBe('questionable');
    expect(result.purificationRate).toBeCloseTo(0.055);
  });

  it('returns unknown when financials are missing but the business is permissible', () => {
    const result = assessCompliance({ sector: 'Technology' });

    expect(result.status).toBe('unknown');
    expect(result.reasons).toContain('screening.reasons.missing_financials');
    expect(result.score).toBe(0);
  });

  it('still fails a prohibited business when financials are missing', () => {
    const result = assessCompliance({ sector: 'Gambling' });

    expect(result.status).toBe('haram');
  });

  it('builds a check per financial ratio including receivables', () => {
    const checks = screenFinancials(healthy);
    expect(checks.map((check) => check.id)).toEqual([
      'debt_to_assets',
      'interest_income',
      'non_compliant_revenue',
      'receivables',
    ]);
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it('marks missing ratio data as failed rather than silently passing', () => {
    const checks = screenFinancials({
      debtToAssets: Number.NaN,
      interestIncomeRatio: 0.01,
      nonCompliantRevenueRatio: 0.01,
    });
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.detail).toBe('missing_data');
  });

  it('uses the conservative thresholds from AAOIFI', () => {
    expect(SHARIA_THRESHOLDS.maxDebtToAssets).toBe(0.33);
    expect(SHARIA_THRESHOLDS.maxInterestIncomeRatio).toBe(0.05);
    expect(SHARIA_THRESHOLDS.maxNonCompliantRevenueRatio).toBe(0.05);
  });

  it('only permits alerts for halal names', () => {
    expect(isAlertable('halal')).toBe(true);
    expect(isAlertable('questionable')).toBe(false);
    expect(isAlertable('haram')).toBe(false);
    expect(isAlertable('unknown')).toBe(false);
  });

  it('calculates dividend purification to six decimal places', () => {
    const amount = calculatePurification(2.5, {
      nonCompliantRevenueRatio: 0.02,
      interestIncomeRatio: 0.01,
    });
    expect(amount).toBeCloseTo(0.075, 6);
    expect(calculatePurification(-1, {
      nonCompliantRevenueRatio: 0.1,
      interestIncomeRatio: 0.1,
    })).toBe(0);
  });
});
