/* eslint-disable no-useless-assignment -- branch-scoped initialisation mirrors the evaluator spec */
import { isAlertable } from '../sharia/screening';
import type {
  AlertOperator,
  ComplianceStatus,
  IndicatorName,
  PriceAlert,
  StockIndicatorSnapshot,
  StockQuote,
} from '../types';

export type AlertEvaluationOutcome = 'triggered' | 'not_triggered' | 'skipped';

export type AlertSkipReason = 'inactive' | 'expired' | 'not_compliant' | 'cooldown' | 'missing_data';

export interface AlertEvaluationResult {
  outcome: AlertEvaluationOutcome;
  alertId: string;
  messageKey: string;
  messageParams: Record<string, string | number>;
  observedValue: number | null;
  targetValue: number | null;
  skipReason?: AlertSkipReason;
  cooldownRemainingMinutes?: number;
  dedupeKey: string;
  triggeredAt: string;
}

export type EvaluableAlert = Pick<
  PriceAlert,
  | 'id'
  | 'alertType'
  | 'operator'
  | 'targetPrice'
  | 'indicator'
  | 'threshold'
  | 'params'
  | 'status'
  | 'cooldownMinutes'
  | 'lastTriggeredAt'
  | 'expiresAt'
>;

export interface AlertEvaluationContext {
  stockSymbol: string;
  quote: Pick<StockQuote, 'price' | 'previousClose'> | null;
  indicators:
    | (Partial<StockIndicatorSnapshot> & { volumeSpikeRatio?: number | null })
    | null;
  complianceStatus: ComplianceStatus;
  now?: Date;
}

function dedupeKey(alertId: string, now: Date, outcome: AlertEvaluationOutcome): string {
  const minute = Math.floor(now.getTime() / 60_000);
  return `${alertId}:${outcome}:${minute}`;
}

function compare(
  operator: AlertOperator,
  observed: number,
  target: number,
  previous?: number | null,
): boolean {
  switch (operator) {
    case 'above':
      return observed >= target;
    case 'below':
      return observed <= target;
    case 'crosses_above':
      return typeof previous === 'number' && previous < target && observed >= target;
    case 'crosses_below':
      return typeof previous === 'number' && previous > target && observed <= target;
    default:
      return false;
  }
}

function cooldownRemaining(
  lastTriggeredAt: string | null,
  cooldownMinutes: number,
  now: Date,
): number {
  if (!lastTriggeredAt || cooldownMinutes <= 0) return 0;
  const last = new Date(lastTriggeredAt).getTime();
  if (!Number.isFinite(last)) return 0;
  const elapsedMinutes = (now.getTime() - last) / 60_000;
  return Math.max(0, Math.ceil(cooldownMinutes - elapsedMinutes));
}

const INDICATOR_MESSAGE_KEYS: Record<IndicatorName, string> = {
  rsi_14: 'alerts.messages.rsi',
  sma_20: 'alerts.messages.sma',
  sma_50: 'alerts.messages.sma',
  sma_200: 'alerts.messages.sma',
  macd: 'alerts.messages.macd',
  volume_spike: 'alerts.messages.volume',
};

/**
 * Pure evaluation of one alert. The background worker (Supabase Edge Function)
 * uses this exact logic so behaviour is identical in tests and production.
 */
export function evaluateAlert(
  alert: EvaluableAlert,
  context: AlertEvaluationContext,
): AlertEvaluationResult {
  const now = context.now ?? new Date();
  const symbol = context.stockSymbol;
  const base = {
    alertId: alert.id,
    dedupeKey: dedupeKey(alert.id, now, 'not_triggered'),
    triggeredAt: now.toISOString(),
  };

  const skipped = (
    reason: AlertSkipReason,
    extra?: { cooldownRemainingMinutes?: number },
  ): AlertEvaluationResult => ({
    ...base,
    outcome: 'skipped',
    messageKey: `alerts.skip.${reason}`,
    messageParams: { symbol },
    observedValue: null,
    targetValue: null,
    skipReason: reason,
    ...extra,
  });

  if (alert.status !== 'active') return skipped('inactive');

  if (alert.expiresAt) {
    const expiry = new Date(alert.expiresAt).getTime();
    if (Number.isFinite(expiry) && expiry <= now.getTime()) return skipped('expired');
  }

  // A compliance alert is the one type that should fire when a stock stops
  // being halal. Everything else is suppressed for non-halal names.
  if (alert.alertType === 'compliance') {
    const stillHalal = context.complianceStatus === 'halal';
    return {
      ...base,
      outcome: stillHalal ? 'not_triggered' : 'triggered',
      messageKey: stillHalal
        ? 'alerts.messages.complianceOk'
        : 'alerts.messages.complianceDowngrade',
      messageParams: { symbol, status: context.complianceStatus },
      observedValue: null,
      targetValue: null,
      dedupeKey: dedupeKey(alert.id, now, stillHalal ? 'not_triggered' : 'triggered'),
    };
  }

  if (!isAlertable(context.complianceStatus)) return skipped('not_compliant');

  const remaining = cooldownRemaining(alert.lastTriggeredAt, alert.cooldownMinutes, now);
  if (remaining > 0) return skipped('cooldown', { cooldownRemainingMinutes: remaining });

  const price = context.quote?.price ?? null;
  if (price === null || !Number.isFinite(price)) return skipped('missing_data');

  let observed: number | null = null;
  let target: number | null = null;
  let messageKey = 'alerts.messages.price';
  let messageParams: Record<string, string | number> = { symbol };

  if (alert.alertType === 'price') {
    if (alert.targetPrice === null || !Number.isFinite(alert.targetPrice)) {
      return skipped('missing_data');
    }
    observed = price;
    target = alert.targetPrice;
    messageKey = 'alerts.messages.price';
    messageParams = {
      symbol,
      price,
      target,
      direction: alert.operator,
    };
  } else {
    if (!alert.indicator) return skipped('missing_data');
    messageKey = INDICATOR_MESSAGE_KEYS[alert.indicator] ?? 'alerts.messages.indicator';

    switch (alert.indicator) {
      case 'rsi_14': {
        const value = context.indicators?.rsi14;
        if (typeof value !== 'number') return skipped('missing_data');
        observed = value;
        target = alert.threshold ?? 70;
        messageParams = { symbol, value, threshold: target };
        break;
      }
      case 'macd': {
        const value = context.indicators?.macd;
        const signal = context.indicators?.macdSignal;
        if (typeof value !== 'number' || typeof signal !== 'number') {
          return skipped('missing_data');
        }
        observed = value;
        target = alert.threshold ?? signal;
        messageParams = { symbol, value, threshold: target };
        break;
      }
      case 'volume_spike': {
        const value = context.indicators?.volumeSpikeRatio;
        if (typeof value !== 'number') return skipped('missing_data');
        observed = value;
        target = alert.threshold ?? 2;
        messageParams = { symbol, value, threshold: target };
        break;
      }
      case 'sma_20':
      case 'sma_50':
      case 'sma_200': {
        const key = alert.indicator === 'sma_20' ? 'sma20' : alert.indicator === 'sma_50' ? 'sma50' : 'sma200';
        const value = context.indicators?.[key];
        if (typeof value !== 'number') return skipped('missing_data');
        observed = price;
        target = typeof alert.threshold === 'number' ? alert.threshold : value;
        messageParams = { symbol, value: observed, threshold: target };
        break;
      }
      default:
        return skipped('missing_data');
    }
  }

  if (observed === null || target === null) return skipped('missing_data');

  const triggered = compare(alert.operator, observed, target, context.quote?.previousClose ?? null);

  return {
    ...base,
    outcome: triggered ? 'triggered' : 'not_triggered',
    messageKey: triggered ? messageKey : 'alerts.messages.notTriggered',
    messageParams,
    observedValue: observed,
    targetValue: target,
    dedupeKey: dedupeKey(alert.id, now, triggered ? 'triggered' : 'not_triggered'),
  };
}

export function evaluateAlerts(
  alerts: readonly EvaluableAlert[],
  context: AlertEvaluationContext,
): AlertEvaluationResult[] {
  return alerts.map((alert) => evaluateAlert(alert, context));
}

export function triggeredResults(results: readonly AlertEvaluationResult[]): AlertEvaluationResult[] {
  return results.filter((result) => result.outcome === 'triggered');
}

/**
 * Sensible one-click default: alert me when this halal stock rises 5%.
 * Rounded to cents to keep the stored value clean.
 */
export function defaultAlertForStock(price: number): {
  alertType: 'price';
  operator: AlertOperator;
  targetPrice: number;
} {
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  return {
    alertType: 'price',
    operator: 'above',
    targetPrice: Math.round(safePrice * 1.05 * 100) / 100,
  };
}

export function suggestedAlertTargets(price: number): Array<{
  operator: AlertOperator;
  targetPrice: number;
  labelKey: string;
}> {
  const round = (value: number) => Math.round(value * 100) / 100;
  return [
    { operator: 'above', targetPrice: round(price * 1.05), labelKey: 'alerts.suggestions.plus5' },
    { operator: 'above', targetPrice: round(price * 1.1), labelKey: 'alerts.suggestions.plus10' },
    { operator: 'below', targetPrice: round(price * 0.95), labelKey: 'alerts.suggestions.minus5' },
  ];
}
