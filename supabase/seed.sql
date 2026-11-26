-- Local development seed: matches packages/shared/src/demo/data.ts so the web
-- and mobile shells have data immediately after `supabase db reset`.
-- Upserts are idempotent and safe to re-run.

insert into public.stocks (
  id, symbol, exchange, name, name_ar, name_es, sector, industry, country,
  currency, market_cap, compliance_status, compliance_score, last_compliance_check
)
values
  ('11111111-1111-4111-8111-111111110001', 'AAPL', 'NASDAQ', 'Apple Inc.', 'شركة أبل', 'Apple Inc.', 'Technology', 'Consumer Electronics', 'US', 'USD', 3420000000000, 'halal', 96, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110002', 'MSFT', 'NASDAQ', 'Microsoft Corporation', 'مايكروسوفت', 'Microsoft Corporation', 'Technology', 'Software Infrastructure', 'US', 'USD', 3180000000000, 'halal', 94, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110003', 'NVDA', 'NASDAQ', 'NVIDIA Corporation', 'إنفيديا', 'NVIDIA Corporation', 'Technology', 'Semiconductors', 'US', 'USD', 2950000000000, 'halal', 92, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110004', 'TSM', 'NYSE', 'Taiwan Semiconductor Manufacturing', 'تي إس إم سي', 'Taiwan Semiconductor', 'Technology', 'Semiconductors', 'TW', 'USD', 890000000000, 'halal', 91, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110005', 'JNJ', 'NYSE', 'Johnson & Johnson', 'جونسون آند جونسون', 'Johnson & Johnson', 'Healthcare', 'Pharmaceuticals', 'US', 'USD', 410000000000, 'halal', 90, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110006', 'GOOGL', 'NASDAQ', 'Alphabet Inc.', 'ألفابت', 'Alphabet Inc.', 'Communication Services', 'Internet Content', 'US', 'USD', 2240000000000, 'halal', 88, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110007', 'AMZN', 'NASDAQ', 'Amazon.com Inc.', 'أمازون', 'Amazon.com Inc.', 'Consumer Discretionary', 'Internet Retail', 'US', 'USD', 2310000000000, 'halal', 85, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110008', 'XOM', 'NYSE', 'Exxon Mobil Corporation', 'إكسون موبيل', 'Exxon Mobil', 'Energy', 'Integrated Oil & Gas', 'US', 'USD', 480000000000, 'halal', 83, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110009', 'UNH', 'NYSE', 'UnitedHealth Group', 'يونايتد هيلث', 'UnitedHealth Group', 'Healthcare', 'Managed Healthcare', 'US', 'USD', 520000000000, 'questionable', 72, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110010', 'TSLA', 'NASDAQ', 'Tesla Inc.', 'تسلا', 'Tesla Inc.', 'Consumer Discretionary', 'Automobiles', 'US', 'USD', 780000000000, 'questionable', 68, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110011', 'BUD', 'NYSE', 'Anheuser-Busch InBev', 'أنهايزر بوش', 'Anheuser-Busch InBev', 'Consumer Staples', 'Breweries', 'BE', 'USD', 130000000000, 'haram', 8, '2026-11-25T06:00:00Z'),
  ('11111111-1111-4111-8111-111111110012', 'JPM', 'NYSE', 'JPMorgan Chase & Co.', 'جيه بي مورجان', 'JPMorgan Chase', 'Financials', 'Conventional Banking', 'US', 'USD', 640000000000, 'haram', 12, '2026-11-25T06:00:00Z')
on conflict (id) do update
set compliance_status = excluded.compliance_status,
    compliance_score = excluded.compliance_score,
    last_compliance_check = excluded.last_compliance_check;

insert into public.stock_quotes (
  stock_id, price, previous_close, change, change_percent, day_high, day_low, volume, source, as_of
)
select
  s.id,
  q.price,
  q.previous_close,
  q.price - q.previous_close,
  case when q.previous_close = 0 then 0 else (q.price - q.previous_close) / q.previous_close end,
  greatest(q.price, q.previous_close) * 1.012,
  least(q.price, q.previous_close) * 0.988,
  q.volume,
  'seed',
  '2026-11-25T14:30:00Z'::timestamptz
from (
  values
    ('AAPL', 241.18, 238.42, 51240000::bigint),
    ('MSFT', 512.66, 516.10, 22410000::bigint),
    ('NVDA', 188.94, 183.62, 214800000::bigint),
    ('TSM', 301.45, 297.80, 12940000::bigint),
    ('JNJ', 168.22, 167.40, 7320000::bigint),
    ('GOOGL', 204.88, 207.31, 31760000::bigint),
    ('AMZN', 236.50, 231.90, 44180000::bigint),
    ('XOM', 118.74, 120.02, 18330000::bigint),
    ('UNH', 342.11, 348.60, 9840000::bigint),
    ('TSLA', 421.30, 410.15, 98220000::bigint),
    ('BUD', 61.20, 61.90, 3120000::bigint),
    ('JPM', 298.74, 296.20, 12010000::bigint)
) as q(symbol, price, previous_close, volume)
join public.stocks s on s.symbol = q.symbol
on conflict (stock_id) do update
set price = excluded.price,
    previous_close = excluded.previous_close,
    change = excluded.change,
    change_percent = excluded.change_percent,
    volume = excluded.volume,
    as_of = excluded.as_of,
    updated_at = now();

insert into public.stock_indicators (
  stock_id, as_of, sma_20, sma_50, sma_200, rsi_14, macd, macd_signal, volume_avg_20
)
select
  s.id, '2026-11-25T14:30:00Z'::timestamptz,
  q.price * 0.98, q.price * 0.95, q.price * 0.9,
  55 + (s.compliance_score / 10), q.price * 0.01, q.price * 0.008,
  q.volume * 0.85
from public.stocks s
join public.stock_quotes q on q.stock_id = s.id
on conflict (stock_id) do update
set as_of = excluded.as_of,
    sma_20 = excluded.sma_20,
    sma_50 = excluded.sma_50,
    sma_200 = excluded.sma_200,
    rsi_14 = excluded.rsi_14,
    macd = excluded.macd,
    macd_signal = excluded.macd_signal,
    volume_avg_20 = excluded.volume_avg_20,
    updated_at = now();

insert into public.compliance_reports (
  stock_id, provider, status, score, ratios, revenue_segments, reasons, purification_rate, effective_at
)
select
  s.id,
  'internal',
  s.compliance_status,
  s.compliance_score,
  jsonb_build_object(
    'debtToAssets', case s.compliance_status when 'halal' then 0.21 when 'questionable' then 0.31 else 0.55 end,
    'interestIncomeRatio', 0.012,
    'nonCompliantRevenueRatio', case s.compliance_status when 'halal' then 0.004 else 0.09 end,
    'receivablesToAssets', 0.28
  ),
  '[]'::jsonb,
  case s.compliance_status
    when 'halal' then array[]::text[]
    when 'questionable' then array['screening.reasons.requires_review']
    else array['screening.reasons.prohibited_sector']
  end,
  0.016,
  '2026-11-25T06:00:00Z'::timestamptz
from public.stocks s
where not exists (
  select 1 from public.compliance_reports r
  where r.stock_id = s.id and r.provider = 'internal'
);
