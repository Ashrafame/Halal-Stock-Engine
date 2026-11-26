import { describe, expect, it } from 'vitest';

import { DEMO_QUOTES, DEMO_STOCKS } from '../src/demo/data';
import { buildPosition, positionPnl, summarizePortfolio } from '../src/portfolio/calc';
import type { Holding, Portfolio } from '../src/types';

const portfolio: Portfolio = {
  id: '55555555-5555-4555-8555-555555555501',
  userId: 'user',
  name: 'Test',
  baseCurrency: 'USD',
  isSimulated: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: '44444444-4444-4444-8444-444444444401',
    portfolioId: portfolio.id,
    stockId: DEMO_STOCKS[0]!.id,
    shares: 10,
    averageCost: 200,
    openedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('portfolio calculations', () => {
  it('computes position P&L', () => {
    const result = positionPnl({ shares: 10, averageCost: 200, price: 250 });
    expect(result.marketValue).toBe(2_500);
    expect(result.costBasis).toBe(2_000);
    expect(result.pnl).toBe(500);
    expect(result.pnlPercent).toBeCloseTo(0.25);
  });

  it('guards against zero cost and negative inputs', () => {
    expect(positionPnl({ shares: 0, averageCost: 200, price: 250 }).pnlPercent).toBe(0);
    expect(positionPnl({ shares: -3, averageCost: 200, price: 250 }).marketValue).toBe(0);
  });

  it('builds a position using the live quote', () => {
    const position = buildPosition({
      holding: holding(),
      stock: DEMO_STOCKS[0]!,
      quote: DEMO_QUOTES[0]!,
    });
    expect(position.compliant).toBe(true);
    expect(position.marketValue).toBeCloseTo(10 * DEMO_QUOTES[0]!.price);
    expect(position.unrealizedPnl).toBeGreaterThan(0);
  });

  it('falls back to average cost when a quote is missing', () => {
    const position = buildPosition({
      holding: holding(),
      stock: DEMO_STOCKS[0]!,
      quote: null,
    });
    expect(position.marketValue).toBe(2_000);
    expect(position.unrealizedPnl).toBe(0);
  });

  it('aggregates a portfolio and flags non-compliant exposure', () => {
    const compliant = buildPosition({
      holding: holding(),
      stock: DEMO_STOCKS[0]!,
      quote: DEMO_QUOTES[0]!,
    });
    const nonCompliant = buildPosition({
      holding: holding({ id: 'second', stockId: DEMO_STOCKS[11]!.id, shares: 2 }),
      stock: DEMO_STOCKS[11]!,
      quote: DEMO_QUOTES[11]!,
    });

    const summary = summarizePortfolio(portfolio, [compliant, nonCompliant]);
    expect(summary.positions).toHaveLength(2);
    expect(summary.marketValue).toBeCloseTo(compliant.marketValue + nonCompliant.marketValue);
    expect(summary.nonCompliantValue).toBeCloseTo(nonCompliant.marketValue);
    expect(summary.unrealizedPnlPercent).toBeGreaterThan(0);
  });

  it('returns zero percentages for an empty portfolio', () => {
    const summary = summarizePortfolio(portfolio, []);
    expect(summary.marketValue).toBe(0);
    expect(summary.unrealizedPnlPercent).toBe(0);
  });
});
