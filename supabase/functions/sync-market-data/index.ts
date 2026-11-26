import type { SupabaseClient } from '@supabase/supabase-js';

import { requireCron } from '../_shared/auth.ts';
import {
  assertMethod,
  errorResponse,
  handleOptions,
  json,
  optionalEnv,
  parsePositiveInt,
} from '../_shared/http.ts';
import { buildIndicatorSnapshot } from '../_shared/indicators.ts';
import {
  adminClient,
  getSystemFlag,
  logApiUsage,
  logError,
} from '../_shared/supabase.ts';

interface StockRow {
  id: string;
  symbol: string;
  exchange: string;
}

interface Bar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface QuoteUpdate {
  stock_id: string;
  price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  source: string;
  as_of: string;
}

const US_EXCHANGES = ['NASDAQ', 'NYSE', 'AMEX'];

function chunk<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const started = Date.now();
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as T;
  await logApiUsage({
    provider: new URL(url).hostname,
    endpoint: new URL(url).pathname,
    statusCode: response.status,
    latencyMs: Date.now() - started,
  });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return payload;
}

// ---------------------------------------------------------------------------
// Polygon.io
// ---------------------------------------------------------------------------
interface PolygonSnapshot {
  tickers?: Array<{
    ticker: string;
    updated?: number;
    day?: { c?: number; h?: number; l?: number; v?: number };
    prevDay?: { c?: number };
  }>;
}

interface PolygonBars {
  results?: Array<{
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }>;
}

async function polygonQuotes(
  stocks: StockRow[],
  apiKey: string,
): Promise<{ quotes: QuoteUpdate[]; history: Map<string, Bar[]> }> {
  const symbols = stocks.map((stock) => stock.symbol);
  const url =
    `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers` +
    `?tickers=${encodeURIComponent(symbols.join(','))}&apiKey=${encodeURIComponent(apiKey)}`;
  const payload = await fetchJson<PolygonSnapshot>(url);
  const bySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]));
  const quotes: QuoteUpdate[] = [];

  for (const ticker of payload.tickers ?? []) {
    const stock = bySymbol.get(ticker.ticker);
    const price = ticker.day?.c;
    const previousClose = ticker.prevDay?.c;
    if (!stock || typeof price !== 'number' || typeof previousClose !== 'number') continue;
    const change = price - previousClose;
    quotes.push({
      stock_id: stock.id,
      price,
      previous_close: previousClose,
      change,
      change_percent: previousClose > 0 ? change / previousClose : 0,
      day_high: ticker.day?.h ?? null,
      day_low: ticker.day?.l ?? null,
      volume: ticker.day?.v ?? null,
      source: 'polygon',
      as_of: ticker.updated
        ? new Date(ticker.updated / 1_000_000).toISOString()
        : new Date().toISOString(),
    });
  }

  return { quotes, history: new Map() };
}

async function polygonHistory(symbol: string, apiKey: string): Promise<Bar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - 400 * 86_400_000);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  const url =
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/` +
    `${format(from)}/${format(to)}?adjusted=true&sort=asc&limit=300&apiKey=${encodeURIComponent(apiKey)}`;
  const payload = await fetchJson<PolygonBars>(url);
  return (payload.results ?? []).map((bar) => ({
    ts: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}

// ---------------------------------------------------------------------------
// Yahoo Finance (keyless fallback; unofficial endpoint)
// ---------------------------------------------------------------------------
interface YahooChart {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

async function yahooHistory(symbol: string): Promise<Bar[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=1y&interval=1d&includePrePost=false`;
  const payload = await fetchJson<YahooChart>(url, {
    'User-Agent': 'Mozilla/5.0 (compatible; HalalStockEngine/1.0)',
  });
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];

  const bars: Bar[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = quote.close?.[index];
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    if (
      typeof close !== 'number' ||
      typeof open !== 'number' ||
      typeof high !== 'number' ||
      typeof low !== 'number'
    ) {
      continue;
    }
    bars.push({
      ts: (timestamps[index] as number) * 1000,
      open,
      high,
      low,
      close,
      volume: quote.volume?.[index] ?? 0,
    });
  }
  return bars;
}

function quoteFromBars(stock: StockRow, bars: Bar[], source: string): QuoteUpdate | null {
  const latest = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  if (!latest) return null;
  const previousClose = previous?.close ?? latest.open;
  const change = latest.close - previousClose;
  return {
    stock_id: stock.id,
    price: latest.close,
    previous_close: previousClose,
    change,
    change_percent: previousClose > 0 ? change / previousClose : 0,
    day_high: latest.high,
    day_low: latest.low,
    volume: latest.volume,
    source,
    as_of: new Date(latest.ts).toISOString(),
  };
}

async function persistHistory(
  admin: SupabaseClient,
  stock: StockRow,
  bars: Bar[],
  source: string,
): Promise<void> {
  if (bars.length === 0) return;

  const rows = bars.map((bar) => ({
    stock_id: stock.id,
    ts: new Date(bar.ts).toISOString(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    source,
  }));

  const { error } = await admin
    .from('stock_prices')
    .upsert(rows, { onConflict: 'stock_id,ts', ignoreDuplicates: false });
  if (error) throw new Error(`stock_prices_upsert_failed: ${error.message}`);

  const snapshot = buildIndicatorSnapshot({
    closes: bars.map((bar) => bar.close),
    volumes: bars.map((bar) => bar.volume),
  });

  const { error: indicatorError } = await admin.from('stock_indicators').upsert(
    {
      stock_id: stock.id,
      as_of: new Date(bars[bars.length - 1]!.ts).toISOString(),
      sma_20: snapshot.sma20,
      sma_50: snapshot.sma50,
      sma_200: snapshot.sma200,
      rsi_14: snapshot.rsi14,
      macd: snapshot.macd,
      macd_signal: snapshot.macdSignal,
      volume_avg_20: snapshot.volumeAvg20,
    },
    { onConflict: 'stock_id' },
  );
  if (indicatorError) throw new Error(`indicators_upsert_failed: ${indicatorError.message}`);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    assertMethod(req, ['POST']);
    await requireCron(req);

    if (!(await getSystemFlag('MARKET_DATA_SYNC_ENABLED', true))) {
      return json(req, { skipped: 'disabled' });
    }

    const admin = adminClient();
    const provider = (optionalEnv('MARKET_DATA_PROVIDER') ?? 'polygon').toLowerCase();
    const polygonKey = optionalEnv('POLYGON_API_KEY');

    if (provider !== 'polygon' && provider !== 'yahoo') {
      return json(req, { skipped: 'unsupported_provider' });
    }
    if (provider === 'polygon' && !polygonKey) {
      return json(req, { skipped: 'polygon_key_not_configured' });
    }
    const usePolygon = provider === 'polygon' && Boolean(polygonKey);

    const limit = parsePositiveInt(Deno.env.get('MARKET_SYNC_MAX_STOCKS'), 40, 500);
    const indicatorLimit = parsePositiveInt(Deno.env.get('MARKET_SYNC_INDICATOR_LIMIT'), 12, 200);

    const { data: stocks, error } = await admin
      .from('stocks')
      .select('id, symbol, exchange')
      .eq('is_active', true)
      .in('exchange', US_EXCHANGES)
      .order('market_cap', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`stocks_query_failed: ${error.message}`);

    const list = (stocks ?? []) as StockRow[];
    if (list.length === 0) return json(req, { updated: 0, indicators: 0, skipped: 'no_stocks' });

    const quotes: QuoteUpdate[] = [];
    const histories = new Map<string, Bar[]>();

    if (usePolygon) {
      for (const batch of chunk(list, 50)) {
        const result = await polygonQuotes(batch, polygonKey as string);
        quotes.push(...result.quotes);
      }
    }

    // Historical bars for indicators: Polygon for US symbols, Yahoo otherwise.
    const indicatorTargets = list.slice(0, indicatorLimit);
    for (const stock of indicatorTargets) {
      try {
        const bars = usePolygon
          ? await polygonHistory(stock.symbol, polygonKey as string)
          : await yahooHistory(stock.symbol);
        if (bars.length === 0) continue;
        histories.set(stock.id, bars);
        const quote = quoteFromBars(stock, bars, usePolygon ? 'polygon' : 'yahoo');
        if (quote) quotes.push(quote);
        await persistHistory(admin, stock, bars, usePolygon ? 'polygon' : 'yahoo');
      } catch (historyError) {
        await logError({
          message: 'market_history_failed',
          context: { symbol: stock.symbol },
          stack: historyError instanceof Error ? historyError.stack : undefined,
        });
      }
    }

    // De-duplicate quotes by stock, preferring the freshest timestamp.
    const byStock = new Map<string, QuoteUpdate>();
    for (const quote of quotes) {
      const existing = byStock.get(quote.stock_id);
      if (!existing || quote.as_of > existing.as_of) byStock.set(quote.stock_id, quote);
    }

    const rows = [...byStock.values()];
    if (rows.length > 0) {
      const { error: upsertError } = await admin
        .from('stock_quotes')
        .upsert(rows, { onConflict: 'stock_id' });
      if (upsertError) throw new Error(`quotes_upsert_failed: ${upsertError.message}`);
    }

    const stale = list.slice(indicatorLimit);
    return json(req, {
      quotes: rows.length,
      indicators: histories.size,
      provider: usePolygon ? 'polygon' : 'yahoo',
      // Remaining symbols are refreshed on subsequent runs.
      deferred: Math.max(0, stale.length),
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
