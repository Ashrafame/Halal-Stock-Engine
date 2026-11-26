import Link from 'next/link';

import { BellRing, ChevronRight, Pause, Play, Trash2 } from 'lucide-react';

import {
  formatCurrency,
  formatRelativeTime,
  type Locale,
  type PriceAlert,
} from '@hse/shared';

import { StatusBadge } from '@/components/ui/badge';
import { deleteAlertAction, toggleAlertAction } from '@/app/actions/alerts';
import type { AlertWithMeta } from '@/lib/data';

export function alertCondition(alert: PriceAlert, locale: Locale, t: (key: string) => string): string {
  if (alert.alertType === 'compliance') return t('alerts.types.compliance');
  if (alert.alertType === 'indicator') {
    return `${t(`alerts.indicators.${alert.indicator ?? 'rsi_14'}`)} ${t(
      `alerts.operators.${alert.operator}`,
    )} ${alert.threshold ?? '—'}`;
  }
  return `${t(`alerts.operators.${alert.operator}`)} ${
    alert.targetPrice ? formatCurrency(alert.targetPrice, 'USD', locale) : '—'
  }`;
}

export function AlertsPreview({
  alerts,
  locale,
  t,
}: {
  alerts: AlertWithMeta[];
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="rounded-3xl border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-ink-900">{t('dashboard.alertsTitle')}</h2>
        <Link
          href="/dashboard/alerts"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700"
        >
          {t('dashboard.viewAlerts')}
          <ChevronRight className="size-3 flip-x" aria-hidden />
        </Link>
      </div>
      <ul className="divide-y divide-ink-100">
        {alerts.length === 0 ? (
          <li className="px-5 py-8 text-center text-xs text-ink-400">{t('alerts.empty')}</li>
        ) : (
          alerts.map((alert) => (
            <li key={alert.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sand-100 text-ink-600">
                <BellRing className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-900">
                  {alert.symbol}{' '}
                  <span className="font-normal text-ink-400">
                    · {formatCurrency(alert.currentPrice ?? 0, 'USD', locale)}
                  </span>
                </p>
                <p className="truncate text-[10px] text-ink-500">
                  {alertCondition(alert, locale, t)}
                </p>
              </div>
              <StatusBadge value={alert.status} label={t(`alerts.${alert.status}`)} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export function AlertCard({
  alert,
  locale,
  t,
}: {
  alert: AlertWithMeta;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-sand-100 text-ink-700">
            <BellRing className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-950">
              {alert.symbol}{' '}
              <span className="text-xs font-normal text-ink-400">{alert.name}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-ink-500">{alertCondition(alert, locale, t)}</p>
          </div>
        </div>
        <StatusBadge value={alert.status} label={t(`alerts.${alert.status}`)} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-sand-50 p-3 text-center">
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-ink-400">
            {t('alerts.currentPrice')}
          </dt>
          <dd className="mt-0.5 text-xs font-semibold text-ink-900">
            {alert.currentPrice ? formatCurrency(alert.currentPrice, 'USD', locale) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-ink-400">{t('alerts.channels')}</dt>
          <dd className="mt-0.5 text-xs font-semibold text-ink-900">
            {[alert.notifyPush ? t('settings.push') : null, alert.notifyEmail ? t('settings.emailAlerts') : null]
              .filter(Boolean)
              .join(' · ') || t('common.none')}
          </dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-ink-400">{t('alerts.cooldown')}</dt>
          <dd className="mt-0.5 text-xs font-semibold text-ink-900">
            {alert.cooldownMinutes}m
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[10px] text-ink-400">
          {alert.lastTriggeredAt
            ? `${t('alerts.triggered')} ${formatRelativeTime(alert.lastTriggeredAt, locale)}`
            : t('alerts.created')}
        </p>
        <div className="flex items-center gap-1.5">
          {alert.status !== 'active' ? (
            <form action={toggleAlertAction}>
              <input type="hidden" name="id" value={alert.id} />
              <input type="hidden" name="next" value="active" />
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-ink-200 px-2.5 text-[10px] font-semibold text-ink-600 hover:text-ink-900"
              >
                <Play className="size-3" aria-hidden />
                {t('alerts.resumeAction')}
              </button>
            </form>
          ) : (
            <form action={toggleAlertAction}>
              <input type="hidden" name="id" value={alert.id} />
              <input type="hidden" name="next" value="paused" />
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-ink-200 px-2.5 text-[10px] font-semibold text-ink-600 hover:text-ink-900"
              >
                <Pause className="size-3" aria-hidden />
                {t('alerts.pauseAction')}
              </button>
            </form>
          )}
          <form action={deleteAlertAction}>
            <input type="hidden" name="id" value={alert.id} />
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-red-200 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-3" aria-hidden />
              {t('alerts.deleteAction')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
