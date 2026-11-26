import type { SupabaseClient } from '@supabase/supabase-js';

import { evaluateAlert, type EvaluableAlert } from '../_shared/alerts.ts';
import { requireCron } from '../_shared/auth.ts';
import {
  assertMethod,
  errorResponse,
  handleOptions,
  json,
  optionalEnv,
} from '../_shared/http.ts';
import { dispatchAlert, type Locale } from '../_shared/notify.ts';
import {
  adminClient,
  getSystemFlag,
  getSystemNumber,
  logError,
} from '../_shared/supabase.ts';

interface AlertRow extends EvaluableAlert {
  notify_email: boolean;
  notify_push: boolean;
  stocks: {
    symbol: string;
    compliance_status: string;
    stock_quotes:
      | { price: number; previous_close: number; volume: number | null }
      | Array<{ price: number; previous_close: number; volume: number | null }>
      | null;
    stock_indicators:
      | {
          rsi_14: number | null;
          sma_20: number | null;
          sma_50: number | null;
          sma_200: number | null;
          macd: number | null;
          macd_signal: number | null;
          volume_avg_20: number | null;
        }
      | Array<{
          rsi_14: number | null;
          sma_20: number | null;
          sma_50: number | null;
          sma_200: number | null;
          macd: number | null;
          macd_signal: number | null;
          volume_avg_20: number | null;
        }>
      | null;
  };
}

interface ProfileRow {
  id: string;
  email: string | null;
  locale: string;
  notify_email: boolean;
  notify_push: boolean;
  status: string;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function localeOf(value: string): Locale {
  return value === 'ar' || value === 'es' ? value : 'en';
}

const ALERT_SELECT = `
  id, user_id, stock_id, alert_type, operator, target_price, indicator, threshold,
  status, cooldown_minutes, last_triggered_at, expires_at, notify_email, notify_push,
  stocks!inner (
    symbol,
    compliance_status,
    stock_quotes ( price, previous_close, volume ),
    stock_indicators ( rsi_14, sma_20, sma_50, sma_200, macd, macd_signal, volume_avg_20 )
  )
`;

async function loadProfiles(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileRow>> {
  const output = new Map<string, ProfileRow>();
  for (const batch of [userIds.slice(0, 100), userIds.slice(100)]) {
    if (batch.length === 0) continue;
    const { data } = await admin
      .from('profiles')
      .select('id, email, locale, notify_email, notify_push, status')
      .in('id', batch);
    for (const row of (data ?? []) as ProfileRow[]) output.set(row.id, row);
  }
  return output;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    assertMethod(req, ['POST']);
    await requireCron(req);

    if (!(await getSystemFlag('ALERT_ENGINE_ENABLED', true))) {
      return json(req, { skipped: 'disabled' });
    }

    const admin = adminClient();
    const maxPerRun = await getSystemNumber('ALERT_MAX_PER_RUN', 500);
    const batchSize = await getSystemNumber('ALERT_BATCH_SIZE', 100);
    const appUrl = optionalEnv('APP_URL') ?? 'https://halalstockengine.app';

    let evaluated = 0;
    let triggered = 0;
    let delivered = 0;
    let failed = 0;

    for (let offset = 0; offset < maxPerRun; offset += batchSize) {
      const remaining = Math.min(batchSize, maxPerRun - offset);
      const { data, error } = await admin
        .from('price_alerts')
        .select(ALERT_SELECT)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .range(offset, offset + remaining - 1);

      if (error) throw new Error(`alerts_query_failed: ${error.message}`);
      const alerts = (data ?? []) as unknown as AlertRow[];
      if (alerts.length === 0) break;

      const profiles = await loadProfiles(admin, [...new Set(alerts.map((row) => row.user_id))]);

      for (const alert of alerts) {
        evaluated += 1;
        const stock = alert.stocks;
        const quote = first(stock?.stock_quotes);
        const indicators = first(stock?.stock_indicators);
        const profile = profiles.get(alert.user_id);

        const volumeRatio =
          quote?.volume && indicators?.volume_avg_20 && indicators.volume_avg_20 > 0
            ? quote.volume / indicators.volume_avg_20
            : null;

        const evaluation = evaluateAlert(alert, {
          symbol: stock?.symbol ?? 'UNKNOWN',
          price: quote?.price ?? null,
          previousClose: quote?.previous_close ?? null,
          rsi14: indicators?.rsi_14 ?? null,
          sma20: indicators?.sma_20 ?? null,
          sma50: indicators?.sma_50 ?? null,
          sma200: indicators?.sma_200 ?? null,
          macd: indicators?.macd ?? null,
          macdSignal: indicators?.macd_signal ?? null,
          volumeSpikeRatio: volumeRatio,
          complianceStatus: stock?.compliance_status ?? 'unknown',
        });

        if (evaluation.outcome !== 'triggered' || !profile || profile.status !== 'active') {
          continue;
        }

        triggered += 1;

        const { data: event, error: eventError } = await admin
          .from('alert_events')
          .insert({
            alert_id: alert.id,
            user_id: alert.user_id,
            stock_id: alert.stock_id,
            outcome: evaluation.outcome,
            observed_value: evaluation.observedValue,
            target_value: evaluation.targetValue,
            message_key: evaluation.messageKey,
            skip_reason: evaluation.skipReason,
            dedupe_key: evaluation.dedupeKey,
            payload: evaluation.messageParams,
            triggered_at: evaluation.triggeredAt,
          })
          .select('id')
          .maybeSingle();

        if (eventError?.code === '23505') continue; // already processed this minute
        if (eventError || !event?.id) {
          failed += 1;
          await logError({
            message: 'alert_event_insert_failed',
            context: { alertId: alert.id, error: eventError?.message },
          });
          continue;
        }

        await admin
          .from('price_alerts')
          .update({
            last_triggered_at: evaluation.triggeredAt,
            ...(alert.alert_type === 'compliance' ? { status: 'triggered' } : {}),
          })
          .eq('id', alert.id);

        try {
          const result = await dispatchAlert({
            admin,
            userId: alert.user_id,
            email: profile.email,
            locale: localeOf(profile.locale),
            symbol: stock.symbol,
            evaluation,
            stockId: alert.stock_id,
            alertId: alert.id,
            eventId: event.id as string,
            notifyEmail: alert.notify_email && profile.notify_email,
            notifyPush: alert.notify_push && profile.notify_push,
            appUrl,
          });
          if (result.email === 'failed' || result.push === 'failed') failed += 1;
          else delivered += 1;
        } catch (dispatchError) {
          failed += 1;
          await logError({
            message: 'alert_dispatch_failed',
            context: { alertId: alert.id },
            stack: dispatchError instanceof Error ? dispatchError.stack : undefined,
          });
        }
      }

      if (alerts.length < remaining) break;
    }

    return json(req, { evaluated, triggered, delivered, failed });
  } catch (error) {
    return errorResponse(req, error);
  }
});
