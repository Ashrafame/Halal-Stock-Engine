import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import {
  formatCurrency,
  formatPercent,
  formatSignedPercent,
  localizedStockName,
  type Locale,
} from '@hse/shared';

import { ComplianceBadge } from '@/components/dashboard/compliance-badge';
import { StockAvatar } from '@/components/dashboard/stock-avatar';
import type { DashboardPosition } from '@/lib/data';

export function PositionsTable({
  positions,
  locale,
  t,
  compact = false,
}: {
  positions: DashboardPosition[];
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  compact?: boolean;
}) {
  if (positions.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[720px] text-start text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-[10px] uppercase tracking-wide text-ink-400">
            <th className="pb-2 pe-3 text-start font-semibold">{t('screener.columns.name')}</th>
            <th className="pb-2 pe-3 text-end font-semibold">{t('portfolio.shares')}</th>
            <th className="pb-2 pe-3 text-end font-semibold">{t('portfolio.averageCost')}</th>
            <th className="pb-2 pe-3 text-end font-semibold">{t('portfolio.marketValue')}</th>
            <th className="pb-2 pe-3 text-end font-semibold">{t('portfolio.pnl')}</th>
            <th className="pb-2 text-end font-semibold">{t('common.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {positions.map((position) => {
            const positive = position.unrealizedPnl >= 0;
            return (
              <tr key={position.id} className={position.compliant ? undefined : 'bg-red-50/40'}>
                <td className="py-3 pe-3">
                  <Link
                    href={`/dashboard/screener?search=${encodeURIComponent(position.symbol)}`}
                    className="flex items-center gap-2.5"
                  >
                    <StockAvatar symbol={position.symbol} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-xs font-semibold text-ink-900">
                        {position.symbol}
                        <ArrowUpRight className="size-3 text-ink-300" aria-hidden />
                      </p>
                      <p className="max-w-40 truncate text-[10px] text-ink-400">
                        {localizedStockName(
                          { name: position.name, nameAr: null, nameEs: null },
                          locale,
                        )}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="py-3 pe-3 text-end text-xs tabular-nums text-ink-600">
                  {position.shares}
                </td>
                <td className="py-3 pe-3 text-end text-xs tabular-nums text-ink-600">
                  {formatCurrency(position.averageCost, 'USD', locale)}
                </td>
                <td className="py-3 pe-3 text-end text-xs font-semibold tabular-nums text-ink-900">
                  {formatCurrency(position.marketValue, 'USD', locale)}
                </td>
                <td className="py-3 pe-3 text-end">
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      positive ? 'text-brand-700' : 'text-red-600'
                    }`}
                  >
                    {formatSignedPercent(position.unrealizedPnlPercent, locale, 1)}
                  </span>
                  {!compact ? (
                    <span className="ms-1 text-[10px] text-ink-400">
                      {formatCurrency(position.unrealizedPnl, 'USD', locale)}
                    </span>
                  ) : null}
                </td>
                <td className="py-3 text-end">
                  <ComplianceBadge
                    status={position.complianceStatus}
                    label={t(`compliance.status.${position.complianceStatus}`)}
                    size="sm"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WeightBar({
  positions,
}: {
  positions: DashboardPosition[];
}) {
  const total = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const colors = ['bg-brand-600', 'bg-ink-800', 'bg-sand-400', 'bg-sky-600', 'bg-amber-500'];

  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-ink-100">
        {positions.map((position, index) => (
          <span
            key={position.id}
            className={colors[index % colors.length]}
            style={{ width: `${total > 0 ? (position.marketValue / total) * 100 : 0}%` }}
            title={`${position.symbol} ${formatPercent(
              total > 0 ? position.marketValue / total : 0,
              'en',
              1,
            )}`}
          />
        ))}
      </div>
    </div>
  );
}
