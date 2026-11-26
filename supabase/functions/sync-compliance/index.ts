import { requireCron } from '../_shared/auth.ts';
import {
  assertMethod,
  errorResponse,
  handleOptions,
  json,
  optionalEnv,
  parsePositiveInt,
} from '../_shared/http.ts';
import {
  adminClient,
  getSystemFlag,
  logApiUsage,
  logError,
} from '../_shared/supabase.ts';

type Status = 'halal' | 'questionable' | 'haram' | 'unknown';
type Provider = 'zoya' | 'islamicly';

interface StockRow {
  id: string;
  symbol: string;
  exchange: string;
}

interface NormalizedReport {
  status: Status;
  score: number | null;
  ratios: {
    debtToAssets: number | null;
    interestIncomeRatio: number | null;
    nonCompliantRevenueRatio: number | null;
    receivablesToAssets: number | null;
  };
  revenueSegments: Array<{ name: string; share: number; prohibited: boolean; reason?: string }>;
  reasons: string[];
  purificationRate: number | null;
  sourceUrl: string | null;
}

function clamp01(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function clampScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

function normalizeStatus(raw: unknown): Status {
  const value = String(raw ?? '').trim().toLowerCase();
  if (['halal', 'compliant', 'permissible', 'pass', 'passed'].includes(value)) return 'halal';
  if (['haram', 'non-compliant', 'noncompliant', 'fail', 'failed', 'prohibited'].includes(value)) {
    return 'haram';
  }
  if (['questionable', 'doubtful', 'review', 'watchlist', 'mixed'].includes(value)) {
    return 'questionable';
  }
  return 'unknown';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.slice(0, 300))
    .slice(0, 20);
}

function normalizeSegments(value: unknown): NormalizedReport['revenueSegments'] {
  if (!Array.isArray(value)) return [];
  const output: NormalizedReport['revenueSegments'] = [];
  for (const item of value) {
    const segment = asRecord(item);
    const name = typeof segment.name === 'string' ? segment.name.slice(0, 120) : null;
    const share = clamp01(segment.share ?? segment.weight);
    if (!name || share === null) continue;
    output.push({
      name,
      share,
      prohibited: segment.prohibited === true,
      ...(typeof segment.reason === 'string' ? { reason: segment.reason.slice(0, 200) } : {}),
    });
  }
  return output.slice(0, 40);
}

/** Maps either provider's payload onto our canonical report shape. */
function normalizeProviderPayload(raw: unknown): NormalizedReport {
  const root = asRecord(raw);
  const data = asRecord(root.data ?? root.result ?? root);
  const ratios = asRecord(data.ratios ?? data.financial_ratios);

  return {
    status: normalizeStatus(data.status ?? data.compliance_status ?? data.verdict),
    score: clampScore(data.score ?? data.compliance_score),
    ratios: {
      debtToAssets: clamp01(ratios.debtToAssets ?? ratios.debt_to_assets ?? data.debt_to_assets),
      interestIncomeRatio: clamp01(
        ratios.interestIncomeRatio ?? ratios.interest_income_ratio ?? data.interest_income_ratio,
      ),
      nonCompliantRevenueRatio: clamp01(
        ratios.nonCompliantRevenueRatio ??
          ratios.non_compliant_revenue_ratio ??
          data.non_compliant_revenue_ratio,
      ),
      receivablesToAssets: clamp01(
        ratios.receivablesToAssets ?? ratios.receivables_to_assets ?? data.receivables_to_assets,
      ),
    },
    revenueSegments: normalizeSegments(data.revenue_segments ?? data.segments),
    reasons: normalizeReasons(data.reasons ?? data.flags),
    purificationRate: clamp01(data.purification_rate ?? data.purificationRate),
    sourceUrl:
      typeof data.source_url === 'string'
        ? data.source_url.slice(0, 500)
        : typeof data.url === 'string'
          ? data.url.slice(0, 500)
          : null,
  };
}

async function fetchProviderReport(input: {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  symbol: string;
}): Promise<{ normalized: NormalizedReport; raw: unknown }> {
  const started = Date.now();
  const isZoya = input.provider === 'zoya';
  const url = isZoya
    ? `${input.baseUrl.replace(/\/$/, '')}/v1/screen`
    : `${input.baseUrl.replace(/\/$/, '')}/v1/screen/${encodeURIComponent(input.symbol)}`;

  const response = await fetch(url, {
    method: isZoya ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
      ...(isZoya ? {} : { 'x-api-key': input.apiKey }),
    },
    body: isZoya ? JSON.stringify({ symbols: [input.symbol] }) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  const raw = await response.json().catch(() => ({}));
  await logApiUsage({
    provider: `compliance:${input.provider}`,
    endpoint: new URL(url).pathname,
    statusCode: response.status,
    latencyMs: Date.now() - started,
    metadata: { symbol: input.symbol },
  });

  if (!response.ok) throw new Error(`provider_${response.status}`);

  // Zoya returns a list; unwrap the matching row when present.
  if (isZoya) {
    const list = asRecord(raw).results;
    if (Array.isArray(list)) {
      const match = list.find(
        (row) => String(asRecord(row).symbol ?? '').toUpperCase() === input.symbol.toUpperCase(),
      );
      return { normalized: normalizeProviderPayload(match ?? list[0]), raw };
    }
  }

  return { normalized: normalizeProviderPayload(raw), raw };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    assertMethod(req, ['POST']);
    await requireCron(req);

    if (!(await getSystemFlag('COMPLIANCE_SYNC_ENABLED', true))) {
      return json(req, { skipped: 'disabled' });
    }

    const provider = (optionalEnv('COMPLIANCE_PROVIDER') ?? 'zoya').toLowerCase();
    if (provider !== 'zoya' && provider !== 'islamicly') {
      return json(req, { skipped: 'unknown_provider' });
    }

    const apiKey =
      provider === 'zoya'
        ? optionalEnv('ZOYA_API_KEY')
        : optionalEnv('ISLAMICLY_API_KEY');
    const baseUrl =
      optionalEnv('COMPLIANCE_API_BASE') ??
      (provider === 'zoya'
        ? optionalEnv('ZOYA_API_BASE') ?? ''
        : optionalEnv('ISLAMICLY_API_BASE') ?? '');

    if (!apiKey || !baseUrl) {
      // Honest failure mode: never invent compliance verdicts.
      return json(req, {
        skipped: 'provider_not_configured',
        hint: 'Set ZOYA_API_KEY / ISLAMICLY_API_KEY plus the matching API base URL.',
      });
    }

    const admin = adminClient();
    const limit = parsePositiveInt(Deno.env.get('COMPLIANCE_SYNC_LIMIT'), 50, 500);
    const { data: stocks, error } = await admin
      .from('stocks')
      .select('id, symbol, exchange')
      .eq('is_active', true)
      .order('last_compliance_check', { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) throw new Error(`stocks_query_failed: ${error.message}`);

    const list = (stocks ?? []) as StockRow[];
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    let synced = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const batch of [list.slice(0, 25), list.slice(25)]) {
      const results = await Promise.allSettled(
        batch.map(async (stock) => {
          // One report per provider per stock per day keeps history clean.
          const { data: existing } = await admin
            .from('compliance_reports')
            .select('id')
            .eq('stock_id', stock.id)
            .eq('provider', provider)
            .gte('effective_at', startOfDay.toISOString())
            .maybeSingle();
          if (existing?.id) return 'skipped' as const;

          const { normalized, raw } = await fetchProviderReport({
            provider,
            baseUrl,
            apiKey,
            symbol: stock.symbol,
          });

          const { error: insertError } = await admin.from('compliance_reports').insert({
            stock_id: stock.id,
            provider,
            status: normalized.status,
            score: normalized.score,
            ratios: normalized.ratios,
            revenue_segments: normalized.revenueSegments,
            reasons: normalized.reasons,
            purification_rate: normalized.purificationRate,
            source_url: normalized.sourceUrl,
            effective_at: new Date().toISOString(),
            expires_at: expiresAt,
            raw_payload: raw,
          });
          if (insertError) throw new Error(`report_insert_failed: ${insertError.message}`);
          return 'synced' as const;
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'synced') synced += 1;
          else skipped += 1;
        } else {
          failures.push(result.reason instanceof Error ? result.reason.message : 'unknown');
        }
      }
    }

    if (failures.length > 0) {
      await logError({
        level: 'warn',
        message: 'compliance_sync_partial_failure',
        context: { provider, failures: failures.slice(0, 20), count: failures.length },
      });
    }

    return json(req, {
      provider,
      synced,
      skipped,
      failed: failures.length,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
