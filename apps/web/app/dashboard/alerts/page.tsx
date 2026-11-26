import type { Metadata } from 'next';

import { BellRing, TrendingUp } from 'lucide-react';

import { AlertCard } from '@/components/dashboard/alerts';
import { CreateAlertForm } from '@/components/dashboard/create-alert-form';
import { EmptyState, PageHeader } from '@/components/dashboard/shell';
import { requireSession } from '@/lib/auth';
import { getAlertsData } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Alerts' };

export default async function AlertsPage() {
  const [session, { t, locale }] = await Promise.all([requireSession(), getI18n()]);
  const data = await getAlertsData(session.userId);

  const active = data.alerts.filter((alert) => alert.status === 'active').length;
  const maxAlerts = data.entitlements.limits.maxAlerts ?? 3;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.alerts')}
        title={t('alerts.title')}
        description={t('alerts.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600">
            <BellRing className="size-3.5 text-brand-700" aria-hidden />
            {active} / {maxAlerts === -1 ? t('common.unlimited') : maxAlerts}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <CreateAlertForm
            stocks={data.stocks}
            canTechnical={data.entitlements.features.technicalAlerts ?? false}
            labels={{
              title: t('alerts.createTitle'),
              stock: t('alerts.stock'),
              type: t('alerts.alertType'),
              condition: t('alerts.condition'),
              targetPrice: t('alerts.targetPrice'),
              indicator: t('alerts.indicator'),
              threshold: t('alerts.threshold'),
              notifyEmail: t('alerts.notifyEmail'),
              notifyPush: t('alerts.notifyPush'),
              submit: t('alerts.create'),
              technicalLocked: t('alerts.upgrade'),
              types: {
                price: t('alerts.types.price'),
                indicator: t('alerts.types.indicator'),
                compliance: t('alerts.types.compliance'),
              },
              operators: {
                above: t('alerts.operators.above'),
                below: t('alerts.operators.below'),
                crosses_above: t('alerts.operators.crosses_above'),
                crosses_below: t('alerts.operators.crosses_below'),
              },
              indicators: {
                rsi_14: t('alerts.indicators.rsi_14'),
                sma_20: t('alerts.indicators.sma_20'),
                sma_50: t('alerts.indicators.sma_50'),
                sma_200: t('alerts.indicators.sma_200'),
                macd: t('alerts.indicators.macd'),
                volume_spike: t('alerts.indicators.volume_spike'),
              },
              errors: {
                created: t('alerts.created'),
                limit: t('alerts.limitReached', { limit: maxAlerts }),
                demo: t('admin.demoReadOnly'),
                compliance: t('errors.complianceGate'),
                feature: t('alerts.upgrade'),
                generic: t('errors.generic'),
                validation: t('errors.validation'),
              },
            }}
          />

          <div className="rounded-3xl border border-ink-200 bg-white p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              <TrendingUp className="size-3.5" aria-hidden />
              {t('alerts.cooldown')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              {t('compliance.purificationHint')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {data.alerts.length === 0 ? (
            <EmptyState title={t('alerts.empty')} description={t('alerts.createTitle')} />
          ) : (
            data.alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} locale={locale} t={t} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
