import type { Metadata } from 'next';
import Link from 'next/link';

import {
  Activity,
  AlertOctagon,
  BellRing,
  CreditCard,
  Gauge,
  ServerCog,
  Users,
} from 'lucide-react';

import { formatCents, formatDate, formatPercent } from '@hse/shared';

import { PageHeader } from '@/components/dashboard/shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { getAdminOverview } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Admin overview' };

export default async function AdminOverviewPage() {
  const [{ t, locale }, data] = await Promise.all([getI18n(), getAdminOverview()]);
  const m = data.metrics;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.admin')}
        title={t('admin.title')}
        description={t('admin.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
            <span className="size-1.5 animate-pulse rounded-full bg-brand-600" />
            {t('common.updated')} {formatDate(new Date(), locale, { timeStyle: 'short' })}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('admin.metrics.users')}
          value={m.totalUsers.toLocaleString(locale === 'ar' ? 'ar-SA-u-nu-latn' : locale)}
          sub={`+${m.newUsers7d} ${t('admin.metrics.newUsers')}`}
          icon={Users}
          tone="dark"
        />
        <StatCard
          label={t('admin.metrics.mrr')}
          value={formatCents(m.mrrCents, 'USD', locale, { maximumFractionDigits: 0 })}
          sub={`${m.activeSubscriptions} ${t('admin.metrics.activeSubs')}`}
          icon={CreditCard}
        />
        <StatCard
          label={t('admin.metrics.alerts')}
          value={m.alertsActive.toLocaleString('en-US')}
          sub={`${m.alertsTriggered24h} ${t('admin.metrics.alerts24h')}`}
          icon={BellRing}
          tone="positive"
        />
        <StatCard
          label={t('admin.metrics.apiCalls')}
          value={m.apiCalls24h.toLocaleString('en-US')}
          sub={`${formatPercent(m.apiErrorRate, locale, 2)} ${t('admin.metrics.errorRate')}`}
          icon={Activity}
          tone={m.apiErrorRate > 0.01 ? 'warning' : 'default'}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-ink-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-950">{t('admin.nav.logs')}</h2>
              <p className="text-[11px] text-ink-400">{t('admin.logs.subtitle')}</p>
            </div>
            <Link
              href="/admin/logs"
              className="text-[10px] font-semibold text-brand-700"
            >
              {t('common.viewAll')}
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-[9px] uppercase tracking-wide text-ink-400">
                  <th className="pb-2 pe-3 text-start font-semibold">{t('admin.logs.action')}</th>
                  <th className="pb-2 pe-3 text-start font-semibold">{t('admin.logs.actor')}</th>
                  <th className="pb-2 text-end font-semibold">{t('admin.logs.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-ink-400">
                      {t('admin.logs.empty')}
                    </td>
                  </tr>
                ) : (
                  data.logs.slice(0, 8).map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2.5 pe-3">
                        <span className="font-mono text-[10px] font-semibold text-ink-800">
                          {entry.action}
                        </span>
                        <p className="text-[10px] text-ink-400">
                          {entry.entity_type}
                          {entry.entity_id ? ` · ${entry.entity_id.slice(0, 12)}` : ''}
                        </p>
                      </td>
                      <td className="py-2.5 pe-3 text-[10px] text-ink-500">
                        {entry.actor_email ?? 'system'}
                      </td>
                      <td className="py-2.5 text-end text-[10px] text-ink-400">
                        {formatDate(entry.created_at, locale, { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-3xl border border-ink-200 bg-ink-950 p-5 text-sand-50">
            <div className="flex items-center gap-2">
              <ServerCog className="size-4 text-lime" aria-hidden />
              <h2 className="text-sm font-semibold">{t('admin.metrics.latency')}</h2>
            </div>
            <div className="mt-4 space-y-4">
              {[
                [t('admin.metrics.latency'), `${m.p95LatencyMs} ms`, Math.min(100, m.p95LatencyMs / 5)],
                [t('admin.metrics.errorRate'), formatPercent(m.apiErrorRate, locale, 2), Math.min(100, m.apiErrorRate * 5_000)],
                [t('admin.metrics.churn'), formatPercent(m.churnRate, locale, 2), Math.min(100, m.churnRate * 1_000)],
              ].map(([label, value, width]) => (
                <div key={String(label)}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-sand-100/50">{label}</span>
                    <span className="font-semibold text-sand-50">{value}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-lime"
                      style={{ width: `${Number(width)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-sand-100/40">
              <span>{t('admin.metrics.activeSubs')}</span>
              <span className="font-semibold text-lime">
                {m.activeSubscriptions} · {m.trialingSubscriptions} {t('admin.metrics.trialing')}
              </span>
            </div>
          </section>

          <section className="rounded-3xl border border-ink-200 bg-white p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
              <AlertOctagon className="size-4 text-amber-600" aria-hidden />
              {t('admin.logs.title')}
            </h2>
            <ul className="mt-3 space-y-2">
              {data.errors.length === 0 ? (
                <li className="rounded-xl bg-brand-50 px-3 py-2 text-[11px] text-brand-800">
                  {t('admin.logs.empty')}
                </li>
              ) : (
                data.errors.slice(0, 4).map((error) => (
                  <li key={error.id} className="rounded-xl bg-red-50 px-3 py-2">
                    <p className="text-[10px] font-semibold text-red-700">{error.message}</p>
                    <p className="mt-0.5 text-[9px] text-red-500">
                      {formatDate(error.created_at, locale, { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ['/admin/users', t('admin.users.title'), t('admin.users.subtitle')],
          ['/admin/plans', t('admin.plans.title'), t('admin.plans.subtitle')],
          ['/admin/compliance', t('admin.stocks.title'), t('admin.stocks.subtitle')],
        ].map(([href, title, description]) => (
          <Link
            key={href}
            href={href!}
            className="group rounded-2xl border border-ink-200 bg-white p-4 transition hover:border-brand-300"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
              <Gauge className="size-3.5 text-brand-700" aria-hidden />
              {title}
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-ink-400">
              {description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
