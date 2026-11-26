import type { Metadata } from 'next';

import { AlertTriangle, BriefcaseBusiness, Coins, TrendingUp, Wallet } from 'lucide-react';

import { formatCurrency, formatSignedPercent } from '@hse/shared';

import { AddHoldingForm, CreatePortfolioForm } from '@/components/dashboard/portfolio-forms';
import { PositionsTable, WeightBar } from '@/components/dashboard/positions-table';
import { EmptyState, PageHeader } from '@/components/dashboard/shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { requireSession } from '@/lib/auth';
import { getPortfolioData } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Portfolio' };

export default async function PortfolioPage() {
  const [session, { t, locale }] = await Promise.all([requireSession(), getI18n()]);
  const data = await getPortfolioData(session.userId);
  const summary = data.summary;

  const labels = {
    addTitle: t('portfolio.addTitle'),
    createTitle: t('portfolio.newPortfolio'),
    portfolio: t('portfolio.title'),
    stock: t('alerts.stock'),
    shares: t('portfolio.shares'),
    averageCost: t('portfolio.averageCost'),
    name: t('portfolio.portfolioName'),
    currency: t('portfolio.currency'),
    submitAdd: t('portfolio.addHolding'),
    submitCreate: t('portfolio.newPortfolio'),
    errors: {
      demo: t('admin.demoReadOnly'),
      exists: t('errors.generic'),
      limit: t('alerts.limitReached', { limit: t('common.unlimited') }),
      validation: t('errors.validation'),
      generic: t('errors.generic'),
      created: t('common.success'),
    },
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.portfolio')}
        title={t('portfolio.title')}
        description={t('portfolio.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600">
            <BriefcaseBusiness className="size-3.5 text-brand-700" aria-hidden />
            {summary?.portfolio.name ?? t('portfolio.newPortfolio')}
          </span>
        }
      />

      {summary && summary.nonCompliantValue > 0 ? (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('portfolio.nonCompliantWarning', {
            count: summary.positions.filter((position) => !position.compliant).length,
          })}
        </div>
      ) : null}

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('portfolio.totalValue')}
          value={formatCurrency(summary?.marketValue ?? 0, 'USD', locale)}
          sub={summary?.portfolio.baseCurrency ?? 'USD'}
          icon={Wallet}
          tone="dark"
        />
        <StatCard
          label={t('portfolio.costBasis')}
          value={formatCurrency(summary?.costBasis ?? 0, 'USD', locale)}
          sub={t('portfolio.holdings')}
          icon={Coins}
        />
        <StatCard
          label={t('portfolio.totalPnl')}
          value={formatCurrency(summary?.unrealizedPnl ?? 0, 'USD', locale)}
          sub={formatSignedPercent(summary?.unrealizedPnlPercent ?? 0, locale, 1)}
          icon={TrendingUp}
          tone={(summary?.unrealizedPnl ?? 0) >= 0 ? 'positive' : 'warning'}
        />
        <StatCard
          label={t('compliance.status.haram')}
          value={formatCurrency(summary?.nonCompliantValue ?? 0, 'USD', locale)}
          sub={`${summary?.positions.filter((position) => !position.compliant).length ?? 0} ${t('portfolio.holdings')}`}
          icon={AlertTriangle}
          tone={(summary?.nonCompliantValue ?? 0) > 0 ? 'warning' : 'default'}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="rounded-3xl border border-ink-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">{t('portfolio.holdings')}</h2>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">
              {summary?.positions.length ?? 0} {t('screener.results')}
            </span>
          </div>

          {summary && summary.positions.length > 0 ? (
            <>
              <PositionsTable positions={summary.positions} locale={locale} t={t} />
              <WeightBar positions={summary.positions} />
            </>
          ) : (
            <div className="mt-4">
              <EmptyState
                title={t('portfolio.empty')}
                description={t('portfolio.addTitle')}
                action={
                  <span className="text-[11px] text-ink-400">{t('portfolio.addHolding')}</span>
                }
              />
            </div>
          )}
        </section>

        <div className="space-y-4">
          {data.portfolios.length > 0 ? (
            <AddHoldingForm
              portfolios={data.portfolios}
              stocks={data.stocks}
              labels={labels}
            />
          ) : (
            <CreatePortfolioForm labels={labels} />
          )}

          <div className="rounded-3xl border border-ink-200 bg-sand-50 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              {t('compliance.purification')}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              {t('compliance.purificationHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
