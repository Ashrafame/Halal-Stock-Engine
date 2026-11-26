import type { Metadata } from 'next';

import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { formatPercent } from '@hse/shared';

import { OverrideForm } from '@/components/admin/override-form';
import { ComplianceBadge } from '@/components/dashboard/compliance-badge';
import { StockAvatar } from '@/components/dashboard/stock-avatar';
import { PageHeader } from '@/components/dashboard/shell';
import { Badge } from '@/components/ui/badge';
import { getScreenerStocks } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Admin compliance' };

export default async function AdminCompliancePage() {
  const [{ t, locale }, rows] = await Promise.all([getI18n(), getScreenerStocks({})]);
  const overrides = rows.filter((row) => row.compliance_override).length;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.admin')}
        title={t('admin.stocks.title')}
        description={t('admin.stocks.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <ShieldAlert className="size-3.5" aria-hidden />
            {overrides} {t('compliance.manual')}
          </span>
        }
      />

      <div className="rounded-3xl border border-ink-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-sand-50/60 text-[9px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 text-start font-semibold">{t('screener.columns.name')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('screener.columns.status')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.score')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.debt')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('screener.columns.interest')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.stocks.override')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-ink-400">
                    {t('screener.empty')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.compliance_override ? 'bg-amber-50/30' : undefined}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <StockAvatar symbol={row.symbol} size="sm" />
                        <div>
                          <p className="text-xs font-semibold text-ink-900">{row.symbol}</p>
                          <p className="max-w-56 truncate text-[10px] text-ink-400">
                            {row.name} · {row.exchange}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <ComplianceBadge
                          status={row.compliance_status}
                          label={t(`compliance.status.${row.compliance_status}`)}
                          size="sm"
                        />
                        {row.compliance_override ? (
                          <Badge tone="warning" className="text-[8px]">
                            <ShieldCheck className="size-2.5" aria-hidden />
                            {t('compliance.manual')}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end text-xs tabular-nums text-ink-700">
                      {row.compliance_score ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-end text-[10px] tabular-nums text-ink-500">
                      {typeof row.ratios?.debtToAssets === 'number'
                        ? formatPercent(row.ratios.debtToAssets, locale, 1)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-end text-[10px] tabular-nums text-ink-500">
                      {typeof row.ratios?.interestIncomeRatio === 'number'
                        ? formatPercent(row.ratios.interestIncomeRatio, locale, 2)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <OverrideForm
                        stockId={row.id}
                        currentStatus={row.compliance_status}
                        currentScore={row.compliance_score}
                        overrideReason={row.override_reason}
                        overrideExpiresAt={row.override_expires_at}
                        hasOverride={Boolean(row.compliance_override)}
                        labels={{
                          save: t('common.save'),
                          saved: t('admin.stocks.saved'),
                          error: t('errors.generic'),
                          demo: t('admin.demoReadOnly'),
                          status: t('common.status'),
                          reason: t('admin.stocks.reason'),
                          expires: t('admin.stocks.expires'),
                          clear: t('admin.stocks.clear'),
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
