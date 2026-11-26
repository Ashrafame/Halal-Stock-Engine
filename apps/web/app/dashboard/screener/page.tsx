import type { Metadata } from 'next';
import Link from 'next/link';

import { Filter, Search, ShieldCheck } from 'lucide-react';

import {
  formatCurrency,
  formatPercent,
  localizedStockName,
  type ComplianceStatus,
} from '@hse/shared';

import { ChangePill } from '@/components/dashboard/change-pill';
import { ComplianceBadge } from '@/components/dashboard/compliance-badge';
import { OneClickAlertButton } from '@/components/dashboard/one-click-alert';
import { ScoreRing } from '@/components/dashboard/score-ring';
import { StockAvatar } from '@/components/dashboard/stock-avatar';
import { EmptyState, PageHeader } from '@/components/dashboard/shell';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { mapQuote, mapStock } from '@/lib/mappers';
import { getScreenerStocks } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Sharia screener' };

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Communication Services',
  'Energy',
  'Industrials',
  'Utilities',
  'Real Estate',
  'Materials',
];

const COMPLIANCE_VALUES: ComplianceStatus[] = ['halal', 'questionable', 'haram', 'unknown'];

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; compliance?: string; sector?: string }>;
}) {
  const [{ t, locale }, params] = await Promise.all([getI18n(), searchParams]);
  const compliance = COMPLIANCE_VALUES.includes(params.compliance as ComplianceStatus)
    ? (params.compliance as ComplianceStatus)
    : undefined;
  const search = typeof params.search === 'string' ? params.search : '';
  const sector = typeof params.sector === 'string' ? params.sector : '';

  const rows = await getScreenerStocks({ search, compliance, sector });

  const alertLabels = {
    action: t('dashboard.oneClick'),
    created: t('common.success'),
    hint: t('dashboard.oneClickHint'),
    demo: t('admin.demoReadOnly'),
    limit: t('dashboard.alertLimit'),
    exists: t('dashboard.alertExists'),
    compliance: t('errors.complianceGate'),
    feature: t('alerts.upgrade'),
    error: t('errors.generic'),
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.screener')}
        title={t('screener.title')}
        description={t('screener.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600">
            <ShieldCheck className="size-3.5 text-brand-700" aria-hidden />
            {rows.length} {t('screener.results')}
          </span>
        }
      />

      <form
        method="GET"
        className="mb-5 grid gap-3 rounded-3xl border border-ink-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-ink-400"
            aria-hidden
          />
          <Input
            name="search"
            defaultValue={search}
            placeholder={t('screener.searchPlaceholder')}
            className="ps-10"
            aria-label={t('common.search')}
          />
        </div>
        <Select name="compliance" defaultValue={compliance ?? ''} aria-label={t('screener.compliance')}>
          <option value="">{t('screener.compliance')}</option>
          {COMPLIANCE_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`compliance.status.${value}`)}
            </option>
          ))}
        </Select>
        <Select name="sector" defaultValue={sector} aria-label={t('screener.sector')}>
          <option value="">{t('screener.sector')}</option>
          {SECTORS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          <Filter className="size-4" aria-hidden />
          {t('screener.apply')}
        </Button>
        <Link
          href="/dashboard/screener"
          className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-ink-500 hover:text-ink-900"
        >
          {t('screener.reset')}
        </Link>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={t('screener.empty')} description={t('screener.subtitle')} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-sand-50/60 text-[10px] uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 text-start font-semibold">{t('screener.columns.name')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.price')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.change')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('screener.columns.status')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.score')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.debt')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((row) => {
                  const stock = mapStock(row);
                  const quote = mapQuote(row);
                  const debt = row.ratios?.debtToAssets;
                  return (
                    <tr key={stock.id} className="transition-colors hover:bg-sand-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StockAvatar symbol={stock.symbol} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-950">{stock.symbol}</p>
                            <p className="max-w-52 truncate text-[10px] text-ink-400">
                              {localizedStockName(stock, locale)} · {stock.exchange}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end text-xs font-semibold tabular-nums text-ink-900">
                        {quote ? formatCurrency(quote.price, stock.currency, locale) : '—'}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {quote ? <ChangePill value={quote.changePercent} locale={locale} /> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ComplianceBadge
                          status={stock.complianceStatus}
                          label={t(`compliance.status.${stock.complianceStatus}`)}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end">
                          <ScoreRing score={stock.complianceScore} size={34} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end text-xs tabular-nums text-ink-600">
                        {typeof debt === 'number' ? formatPercent(debt, locale, 1) : '—'}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {stock.complianceStatus === 'halal' ? (
                          <OneClickAlertButton
                            stockId={stock.id}
                            labels={alertLabels}
                            compact
                          />
                        ) : (
                          <span className="text-[10px] text-ink-300">{t('common.none')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
