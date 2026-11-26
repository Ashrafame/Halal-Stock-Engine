import { describe, expect, it } from 'vitest';

import {
  defaultAlertForStock,
  evaluateAlert,
  evaluateAlerts,
  suggestedAlertTargets,
} from '../src/alerts/evaluate';
import type { EvaluableAlert } from '../src/alerts/evaluate';

const NOW = new Date('2026-11-25T15:00:00.000Z');

function alert(overrides: Partial<EvaluableAlert> = {}): EvaluableAlert {
  return {
    id: '77777777-7777-4777-8777-777777777701',
    alertType: 'price',
    operator: 'above',
    targetPrice: 250,
    indicator: null,
    threshold: null,
    params: {},
    status: 'active',
    cooldownMinutes: 30,
    lastTriggeredAt: null,
    expiresAt: null,
    ...overrides,
  };
}

const context = {
  stockSymbol: 'AAPL',
  quote: { price: 255, previousClose: 240 },
  indicators: { rsi14: 74, macd: 2.4, macdSignal: 1.9, volumeSpikeRatio: 2.6 },
  complianceStatus: 'halal' as const,
  now: NOW,
};

describe('Alert evaluation engine', () => {
  it('triggers a price-above alert', () => {
    const result = evaluateAlert(alert(), context);
    expect(result.outcome).toBe('triggered');
    expect(result.observedValue).toBe(255);
    expect(result.messageKey).toBe('alerts.messages.price');
    expect(result.dedupeKey).toContain('triggered');
  });

  it('does not trigger when the threshold is not met', () => {
    const result = evaluateAlert(alert({ targetPrice: 300 }), context);
    expect(result.outcome).toBe('not_triggered');
  });

  it('triggers a below alert', () => {
    const result = evaluateAlert(
      alert({ operator: 'below', targetPrice: 260, cooldownMinutes: 0 }),
      context,
    );
    expect(result.outcome).toBe('triggered');
  });

  it('requires a real crossing for crosses_above', () => {
    const crossed = evaluateAlert(
      alert({ operator: 'crosses_above', targetPrice: 250 }),
      context,
    );
    expect(crossed.outcome).toBe('triggered');

    const alreadyAbove = evaluateAlert(alert({ operator: 'crosses_above', targetPrice: 250 }), {
      ...context,
      quote: { price: 255, previousClose: 252 },
    });
    expect(alreadyAbove.outcome).toBe('not_triggered');
  });

  it('suppresses price alerts for non-halal stocks', () => {
    const result = evaluateAlert(alert(), { ...context, complianceStatus: 'questionable' });
    expect(result.outcome).toBe('skipped');
    expect(result.skipReason).toBe('not_compliant');
  });

  it('enforces the per-alert cooldown', () => {
    const result = evaluateAlert(
      alert({ lastTriggeredAt: '2026-11-25T14:50:00.000Z' }),
      context,
    );
    expect(result.outcome).toBe('skipped');
    expect(result.skipReason).toBe('cooldown');
    expect(result.cooldownRemainingMinutes).toBe(20);
  });

  it('allows firing again once the cooldown elapsed', () => {
    const result = evaluateAlert(
      alert({ lastTriggeredAt: '2026-11-25T14:00:00.000Z' }),
      context,
    );
    expect(result.outcome).toBe('triggered');
  });

  it('skips paused and expired alerts', () => {
    expect(evaluateAlert(alert({ status: 'paused' }), context).skipReason).toBe('inactive');
    expect(
      evaluateAlert(alert({ expiresAt: '2026-11-24T00:00:00.000Z' }), context).skipReason,
    ).toBe('expired');
  });

  it('evaluates RSI indicator alerts', () => {
    const result = evaluateAlert(
      alert({ alertType: 'indicator', indicator: 'rsi_14', operator: 'above', threshold: 70 }),
      context,
    );
    expect(result.outcome).toBe('triggered');
    expect(result.messageKey).toBe('alerts.messages.rsi');
    expect(result.observedValue).toBe(74);
  });

  it('evaluates volume-spike alerts', () => {
    const result = evaluateAlert(
      alert({
        alertType: 'indicator',
        indicator: 'volume_spike',
        operator: 'above',
        threshold: 2,
      }),
      context,
    );
    expect(result.outcome).toBe('triggered');
    expect(result.messageKey).toBe('alerts.messages.volume');
  });

  it('skips indicator alerts when the indicator snapshot is missing', () => {
    const result = evaluateAlert(
      alert({ alertType: 'indicator', indicator: 'sma_50', operator: 'above' }),
      { ...context, indicators: null },
    );
    expect(result.skipReason).toBe('missing_data');
  });

  it('fires a compliance alert only when the stock stops being halal', () => {
    const complianceAlert = alert({ alertType: 'compliance' });
    expect(evaluateAlert(complianceAlert, context).outcome).toBe('not_triggered');

    const downgrade = evaluateAlert(complianceAlert, {
      ...context,
      complianceStatus: 'haram',
    });
    expect(downgrade.outcome).toBe('triggered');
    expect(downgrade.messageKey).toBe('alerts.messages.complianceDowngrade');
  });

  it('skips when quote data is missing', () => {
    const result = evaluateAlert(alert(), { ...context, quote: null });
    expect(result.skipReason).toBe('missing_data');
  });

  it('evaluates batches and filters triggered results', () => {
    const results = evaluateAlerts(
      [alert({ id: 'a' }), alert({ id: 'b', targetPrice: 999 })],
      context,
    );
    expect(results).toHaveLength(2);
    expect(results.filter((result) => result.outcome === 'triggered')).toHaveLength(1);
  });

  it('creates a sensible one-click default of +5%', () => {
    expect(defaultAlertForStock(200)).toEqual({
      alertType: 'price',
      operator: 'above',
      targetPrice: 210,
    });
    expect(defaultAlertForStock(0).targetPrice).toBe(0);
  });

  it('suggests rounded targets above and below', () => {
    const suggestions = suggestedAlertTargets(101);
    expect(suggestions[0]?.targetPrice).toBe(106.05);
    expect(suggestions[2]?.targetPrice).toBe(95.95);
  });
});
