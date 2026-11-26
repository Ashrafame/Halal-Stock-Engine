import type { Metadata } from 'next';

import { PlanForm } from '@/components/admin/plan-form';
import { PageHeader } from '@/components/dashboard/shell';
import { getAdminPlans } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Admin plans' };

export default async function AdminPlansPage() {
  const [{ t }, plans] = await Promise.all([getI18n(), getAdminPlans()]);

  const labels = {
    save: t('common.save'),
    saved: t('admin.plans.saved'),
    error: t('errors.generic'),
    demo: t('admin.demoReadOnly'),
    name: t('admin.plans.name'),
    description: t('admin.plans.description'),
    priceMonthly: t('admin.plans.priceMonthly'),
    priceYearly: t('admin.plans.priceYearly'),
    trial: t('admin.plans.trial'),
    active: t('admin.plans.active'),
    sort: t('admin.plans.sort'),
    limits: t('admin.plans.limits'),
    features: t('admin.plans.features'),
    syncStripe: t('admin.plans.syncStripe'),
    stripeMissing: t('admin.plans.stripeMissing'),
    limitsLabels: {
      maxAlerts: t('nav.alerts'),
      maxWatchlistItems: t('nav.screener'),
      maxPortfolios: t('nav.portfolio'),
      maxHoldingsPerPortfolio: t('portfolio.holdings'),
      apiRequestsPerDay: t('admin.metrics.apiCalls'),
      alertCooldownMinutes: t('alerts.cooldown'),
    },
    featuresLabels: {
      realtimeQuotes: t('pricing.features.realtime'),
      technicalAlerts: t('pricing.features.technical'),
      emailAlerts: t('settings.emailAlerts'),
      pushAlerts: t('settings.push'),
      portfolioTracking: t('portfolio.title'),
      complianceReports: t('pricing.features.reports'),
      exportData: t('pricing.features.export'),
      prioritySupport: t('pricing.features.support'),
    },
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.admin')}
        title={t('admin.plans.title')}
        description={t('admin.plans.subtitle')}
      />
      <div className="space-y-5">
        {plans.map((plan) => (
          <PlanForm key={plan.id} plan={plan} labels={labels} />
        ))}
      </div>
    </div>
  );
}
