import type { Metadata } from 'next';
import Link from 'next/link';

import {
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import {
  formatCurrency,
  formatPercent,
  formatSignedPercent,
} from '@hse/shared';

import { AlertsPreview } from '@/components/dashboard/alerts';
import { NotificationList } from '@/components/dashboard/notification-list';
import { PositionsTable } from '@/components/dashboard/positions-table';
import { StockCard } from '@/components/dashboard/stock-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState, PageHeader, UpgradeCta } from '@/components/dashboard/shell';
import { ButtonLink } from '@/components/ui/button';
import { requireSession } from '@/lib/auth';
import { getDashboardData } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, { t, locale }, params] = await Promise.all([
    requireSession(),
    getI18n(),
    searchParams,
  ]);
  const data = await getDashboardData(session.userId);

  const firstName = session.profile.fullName?.split(' ')[0] ?? session.profile.email ?? '';
  const portfolio = data.portfolio;
  const activeAlerts = data.alerts.filter((alert) => alert.status === 'active').length;
  const averageScore =
    data.topStocks.length > 0
      ? data.topStocks.reduce((total, item) => total + (item.compliance.score ?? 0), 0) /
        data.topStocks.length
      : 0;

  return (
    <div className="space-y-6">
      {params.error === 'forbidden' ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {t('errors.forbidden')}
        </div>
      ) : null}

      <PageHeader
        eyebrow={t('nav.dashboard')}
        title={firstName ? `${t('dashboard.greeting')}, ${firstName}` : t('dashboard.greeting')}
        description={t('dashboard.subtitle')}
        actions={
          <ButtonLink href="/dashboard/screener" variant="outline">
            {t('dashboard.viewScreener')}
            <ArrowRight className="size-4 flip-x" aria-hidden />
          </ButtonLink>
        }
      />

      <section aria-labelledby="top-halal">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="top-halal" className="text-lg font-semibold text-ink-950">
              {t('dashboard.topHalalTitle')}
            </h2>
            <p className="text-xs text-ink-500">{t('dashboard.topHalalSubtitle')}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-inset ring-brand-200">
            <ShieldCheck className="size-3" aria-hidden />
            {formatPercent(averageScore / 100, locale, 0)} {t('dashboard.score')}
          </span>
        </div>

        {data.topStocks.length === 0 ? (
          <EmptyState title={t('dashboard.empty')} description={t('screener.empty')} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.topStocks.map((item, index) => (
              <StockCard
                key={item.stock.id}
                item={item}
                locale={locale}
                t={t}
                rank={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.portfolioValue')}
          value={formatCurrency(portfolio?.marketValue ?? 0, 'USD', locale)}
          sub={
            portfolio
              ? `${formatSignedPercent(portfolio.unrealizedPnlPercent, locale, 1)} ${t(
                  'dashboard.portfolioPnl',
                )}`
              : t('portfolio.empty')
          }
          icon={Wallet}
          tone="dark"
        />
        <StatCard
          label={t('dashboard.portfolioPnl')}
          value={formatCurrency(portfolio?.unrealizedPnl ?? 0, 'USD', locale)}
          sub={`${t('portfolio.costBasis')} ${formatCurrency(
            portfolio?.costBasis ?? 0,
            'USD',
            locale,
          )}`}
          icon={TrendingUp}
          tone={(portfolio?.unrealizedPnl ?? 0) >= 0 ? 'positive' : 'warning'}
        />
        <StatCard
          label={t('dashboard.alertsTitle')}
          value={String(activeAlerts)}
          sub={`${data.alerts.length} ${t('alerts.history').toLowerCase()}`}
          icon={BellRing}
        />
        <StatCard
          label={t('dashboard.notifications')}
          value={String(data.unreadCount)}
          sub={t('dashboard.unread')}
          icon={BriefcaseBusiness}
          tone={data.unreadCount > 0 ? 'warning' : 'default'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-3xl border border-ink-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">{t('dashboard.portfolioTitle')}</h2>
              <p className="text-[11px] text-ink-400">
                {portfolio?.portfolio.name ?? t('portfolio.empty')}
              </p>
            </div>
            <Link
              href="/dashboard/portfolio"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700"
            >
              {t('common.viewAll')}
              <ArrowRight className="size-3 flip-x" aria-hidden />
            </Link>
          </div>

          {portfolio && portfolio.positions.length > 0 ? (
            <>
              <PositionsTable
                positions={portfolio.positions}
                locale={locale}
                t={t}
                compact
              />
              {portfolio.nonCompliantValue > 0 ? (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-800">
                  {t('portfolio.nonCompliantWarning', {
                    count: portfolio.positions.filter((position) => !position.compliant).length,
                  })}
                </p>
              ) : null}
            </>
          ) : (
            <div className="mt-4">
              <EmptyState
                title={t('portfolio.empty')}
                description={t('portfolio.addTitle')}
                action={
                  <ButtonLink href="/dashboard/portfolio" size="sm">
                    {t('portfolio.addHolding')}
                  </ButtonLink>
                }
              />
            </div>
          )}
        </section>

        <NotificationList
          notifications={data.notifications}
          unreadCount={data.unreadCount}
          locale={locale}
          t={t}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <AlertsPreview alerts={data.alerts} locale={locale} t={t} />
        {data.entitlements.tier === 'free' ? <UpgradeCta t={t} /> : null}
      </div>
    </div>
  );
}
