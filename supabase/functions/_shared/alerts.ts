/* eslint-disable no-useless-assignment -- branch-scoped initialisation mirrors packages/shared */
/**
 * Edge copy of the alert evaluator. Canonical logic + tests live in
 * `packages/shared/src/alerts/evaluate.ts`; keep the two in sync.
 */

export interface EvaluableAlert {
  id: string;
  user_id: string;
  stock_id: string;
  alert_type: 'price' | 'indicator' | 'compliance';
  operator: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  target_price: number | null;
  indicator: string | null;
  threshold: number | null;
  status: string;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  expires_at: string | null;
}

export interface AlertEvaluation {
  outcome: 'triggered' | 'not_triggered' | 'skipped';
  alertId: string;
  messageKey: string;
  messageParams: Record<string, string | number>;
  observedValue: number | null;
  targetValue: number | null;
  skipReason: string | null;
  dedupeKey: string;
  triggeredAt: string;
}

export interface EvaluationContext {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  macd: number | null;
  macdSignal: number | null;
  volumeSpikeRatio: number | null;
  complianceStatus: string;
  now?: Date;
}

function bucket(now: Date): number {
  return Math.floor(now.getTime() / 60_000);
}

function compare(
  operator: string,
  observed: number,
  target: number,
  previous: number | null,
): boolean {
  switch (operator) {
    case 'above':
      return observed >= target;
    case 'below':
      return observed <= target;
    case 'crosses_above':
      return previous !== null && previous < target && observed >= target;
    case 'crosses_below':
      return previous !== null && previous > target && observed <= target;
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
  return Math.max(0, Math.ceil(cooldownMinutes - (now.getTime() - last) / 60_000));
}

export function evaluateAlert(alert: EvaluableAlert, context: EvaluationContext): AlertEvaluation {
  const now = context.now ?? new Date();
  const base = {
    alertId: alert.id,
    triggeredAt: now.toISOString(),
    observedValue: null as number | null,
    targetValue: null as number | null,
    skipReason: null as string | null,
  };

  const skip = (reason: string): AlertEvaluation => ({
    ...base,
    outcome: 'skipped',
    messageKey: `alerts.skip.${reason}`,
    messageParams: { symbol: context.symbol },
    skipReason: reason,
    dedupeKey: `${alert.id}:skipped:${reason}:${bucket(now)}`,
  });

  if (alert.status !== 'active') return skip('inactive');
  if (alert.expires_at && new Date(alert.expires_at).getTime() <= now.getTime()) {
    return skip('expired');
  }

  if (alert.alert_type === 'compliance') {
    const stillHalal = context.complianceStatus === 'halal';
    return {
      ...base,
      outcome: stillHalal ? 'not_triggered' : 'triggered',
      messageKey: stillHalal
        ? 'alerts.messages.complianceOk'
        : 'alerts.messages.complianceDowngrade',
      messageParams: { symbol: context.symbol, status: context.complianceStatus },
      dedupeKey: `${alert.id}:${stillHalal ? 'ok' : 'compliance'}:${bucket(now)}`,
    };
  }

  if (context.complianceStatus !== 'halal') return skip('not_compliant');

  const remaining = cooldownRemaining(alert.last_triggered_at, alert.cooldown_minutes, now);
  if (remaining > 0) return skip('cooldown');

  const price = context.price;
  if (price === null || !Number.isFinite(price)) return skip('missing_data');

  let observed: number | null = null;
  let target: number | null = null;
  let messageKey = 'alerts.messages.price';
  let params: Record<string, string | number> = { symbol: context.symbol };

  if (alert.alert_type === 'price') {
    if (alert.target_price === null) return skip('missing_data');
    observed = price;
    target = alert.target_price;
    params = { symbol: context.symbol, price, target, direction: alert.operator };
  } else {
    switch (alert.indicator) {
      case 'rsi_14':
        if (context.rsi14 === null) return skip('missing_data');
        observed = context.rsi14;
        target = alert.threshold ?? 70;
        messageKey = 'alerts.messages.rsi';
        break;
      case 'macd':
        if (context.macd === null || context.macdSignal === null) return skip('missing_data');
        observed = context.macd;
        target = alert.threshold ?? context.macdSignal;
        messageKey = 'alerts.messages.macd';
        break;
      case 'volume_spike':
        if (context.volumeSpikeRatio === null) return skip('missing_data');
        observed = context.volumeSpikeRatio;
        target = alert.threshold ?? 2;
        messageKey = 'alerts.messages.volume';
        break;
      case 'sma_20':
      case 'sma_50':
      case 'sma_200': {
        const smaValue =
          alert.indicator === 'sma_20'
            ? context.sma20
            : alert.indicator === 'sma_50'
              ? context.sma50
              : context.sma200;
        if (smaValue === null) return skip('missing_data');
        observed = price;
        target = alert.threshold ?? smaValue;
        messageKey = 'alerts.messages.sma';
        break;
      }
      default:
        return skip('missing_data');
    }
    params = { symbol: context.symbol, value: observed, threshold: target };
  }

  if (observed === null || target === null) return skip('missing_data');

  const triggered = compare(alert.operator, observed, target, context.previousClose);
  return {
    ...base,
    outcome: triggered ? 'triggered' : 'not_triggered',
    messageKey: triggered ? messageKey : 'alerts.messages.notTriggered',
    messageParams: params,
    observedValue: observed,
    targetValue: target,
    dedupeKey: `${alert.id}:${triggered ? 'triggered' : 'no'}:${bucket(now)}`,
  };
}
