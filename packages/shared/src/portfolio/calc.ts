import type {
  Holding,
  Portfolio,
  PortfolioPosition,
  PortfolioSummary,
  Stock,
  StockQuote,
} from '../types';

export function positionValue(shares: number, price: number): number {
  const safeShares = Number.isFinite(shares) && shares > 0 ? shares : 0;
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  return safeShares * safePrice;
}

export function positionPnl(input: {
  shares: number;
  averageCost: number;
  price: number;
}): { marketValue: number; costBasis: number; pnl: number; pnlPercent: number } {
  const marketValue = positionValue(input.shares, input.price);
  const costBasis = positionValue(input.shares, input.averageCost);
  const pnl = marketValue - costBasis;
  return {
    marketValue,
    costBasis,
    pnl,
    pnlPercent: costBasis > 0 ? pnl / costBasis : 0,
  };
}

export function buildPosition(input: {
  holding: Holding;
  stock: Stock;
  quote: StockQuote | null;
}): PortfolioPosition {
  const price = input.quote?.price ?? input.holding.averageCost;
  const calculated = positionPnl({
    shares: input.holding.shares,
    averageCost: input.holding.averageCost,
    price,
  });
  return {
    ...input.holding,
    stock: input.stock,
    quote: input.quote,
    marketValue: calculated.marketValue,
    costBasis: calculated.costBasis,
    unrealizedPnl: calculated.pnl,
    unrealizedPnlPercent: calculated.pnlPercent,
    compliant: input.stock.complianceStatus === 'halal',
  };
}

export function summarizePortfolio(
  portfolio: Portfolio,
  positions: readonly PortfolioPosition[],
): PortfolioSummary {
  const totals = positions.reduce(
    (accumulator, position) => ({
      marketValue: accumulator.marketValue + position.marketValue,
      costBasis: accumulator.costBasis + position.costBasis,
      nonCompliantValue:
        accumulator.nonCompliantValue + (position.compliant ? 0 : position.marketValue),
    }),
    { marketValue: 0, costBasis: 0, nonCompliantValue: 0 },
  );

  const unrealizedPnl = totals.marketValue - totals.costBasis;
  return {
    portfolio,
    positions: [...positions],
    marketValue: totals.marketValue,
    costBasis: totals.costBasis,
    unrealizedPnl,
    unrealizedPnlPercent: totals.costBasis > 0 ? unrealizedPnl / totals.costBasis : 0,
    nonCompliantValue: totals.nonCompliantValue,
  };
}
