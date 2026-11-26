import Link from 'next/link';

import { ArrowUpRight, Info } from 'lucide-react';

import {
  formatCurrency,
  formatPercent,
  localizedStockName,
  type Locale,
  type TopStock,
} from '@hse/shared';

import { ChangePill } from '@/components/dashboard/change-pill';
import { ComplianceBadge } from '@/components/dashboard/compliance-badge';
import { OneClickAlertButton } from '@/components/dashboard/one-click-alert';
import { ScoreRing } from '@/components/dashboard/score-ring';
import { Sparkline } from '@/components/dashboard/sparkline';
import { StockAvatar } from '@/components/dashboard/stock-avatar';

export function StockCard({
  item,
  locale,
  t,
  rank,
}: {
  item: TopStock;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  rank?: number;
}) {
  const { stock, quote, compliance } = item;
  const name = localizedStockName(stock, locale);
  const positive = (quote?.changePercent ?? 0) >= 0;

  return (
    <article className="card-lift group relative flex flex-col rounded-3xl border border-ink-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(8,20,15,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <StockAvatar symbol={stock.symbol} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-ink-950">{stock.symbol}</h3>
              {rank ? (
                <span className="rounded-full bg-sand-100 px-1.5 py-0.5 text-[9px] font-bold text-ink-500">
                  #{rank}
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-ink-400">{name}</p>
          </div>
        </div>
        <ComplianceBadge
          status={compliance.status}
          label={t(`compliance.status.${compliance.status}`)}
          size="sm"
        />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-ink-950">
            {quote ? formatCurrency(quote.price, stock.currency, locale) : '—'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {quote ? <ChangePill value={quote.changePercent} locale={locale} /> : null}
            <span className="text-[11px] text-ink-400">{stock.exchange}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ScoreRing score={compliance.score} />
          <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">
            {t('dashboard.score')}
          </span>
        </div>
      </div>

      <Sparkline seed={stock.symbol} positive={positive} className="mt-2 h-10" />

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3.5">
        <div className="flex items-center gap-1 text-[10px] text-ink-400">
          <Info className="size-3" aria-hidden />
          <span>
            {t('compliance.purification')}{' '}
            {formatPercent(compliance.purificationRate ?? 0, locale, 1)}
          </span>
        </div>
        <OneClickAlertButton
          stockId={stock.id}
          compact
          className="relative z-20"
          labels={{
            action: t('dashboard.oneClick'),
            created: t('common.success'),
            hint: t('dashboard.oneClickHint'),
            demo: t('admin.demoReadOnly'),
            limit: t('dashboard.alertLimit'),
            exists: t('dashboard.alertExists'),
            compliance: t('errors.complianceGate'),
            feature: t('alerts.upgrade'),
            error: t('errors.generic'),
          }}
        />
      </div>

      <Link
        href={`/dashboard/screener?search=${encodeURIComponent(stock.symbol)}`}
        className="absolute inset-0 -z-0 rounded-3xl"
        aria-label={`${name} details`}
      />
      <span className="pointer-events-none absolute end-4 top-1/2 hidden -translate-y-1/2 text-ink-300 opacity-0 transition group-hover:opacity-100 lg:block">
        <ArrowUpRight className="size-4" aria-hidden />
      </span>
    </article>
  );
}
