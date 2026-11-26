import { Check, Sparkles } from 'lucide-react';

import {
  formatCents,
  yearlySavingsPercent,
  type Locale,
  type Plan,
} from '@hse/shared';

import { CheckoutButton } from '@/components/marketing/checkout-button';
import { SectionHeading } from '@/components/ui/card';
import { cn } from '@hse/shared';

export function PricingSection({
  plans,
  t,
  locale,
  signedIn,
  demo,
}: {
  plans: Plan[];
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: Locale;
  signedIn: boolean;
  demo: boolean;
}) {
  return (
    <section id="pricing" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow={t('nav.pricing')}
        title={t('landing.pricingTitle')}
        description={t('landing.pricingSubtitle')}
        align="center"
      />

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const featured = plan.tier === 'pro';
          const savings = yearlySavingsPercent(plan.priceMonthlyCents, plan.priceYearlyCents);
          const limits = plan.limits;
          const features = [
            limits.maxAlerts === -1
              ? `${t('common.unlimited')} · ${t('nav.alerts')}`
              : t('pricing.features.alerts', { count: limits.maxAlerts }),
            limits.maxWatchlistItems === -1
              ? `${t('common.unlimited')} · ${t('nav.screener')}`
              : t('pricing.features.watchlist', { count: limits.maxWatchlistItems }),
            limits.maxPortfolios === -1
              ? `${t('common.unlimited')} · ${t('nav.portfolio')}`
              : t('pricing.features.portfolios', { count: limits.maxPortfolios }),
            plan.features.realtimeQuotes ? t('pricing.features.realtime') : null,
            plan.features.technicalAlerts ? t('pricing.features.technical') : null,
            plan.features.complianceReports ? t('pricing.features.reports') : null,
            plan.features.exportData ? t('pricing.features.export') : null,
            plan.features.prioritySupport ? t('pricing.features.support') : null,
          ].filter((item): item is string => Boolean(item));

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-[1.75rem] border p-6 sm:p-7',
                featured
                  ? 'border-ink-900 bg-ink-950 text-sand-50 shadow-[0_30px_80px_-30px_rgba(8,20,15,0.7)]'
                  : 'border-ink-200 bg-white text-ink-900',
              )}
            >
              {featured ? (
                <span className="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-950">
                  <Sparkles className="size-3" aria-hidden />
                  {t('pricing.mostPopular')}
                </span>
              ) : null}

              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-2xl tracking-tight">{plan.name}</h3>
                <span
                  className={cn(
                    'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                    featured ? 'bg-white/10 text-sand-100' : 'bg-sand-100 text-ink-600',
                  )}
                >
                  {plan.tier}
                </span>
              </div>

              <p
                className={cn(
                  'mt-1.5 text-xs',
                  featured ? 'text-sand-100/55' : 'text-ink-400',
                )}
              >
                {plan.tier === 'free'
                  ? t('pricing.freeForever')
                  : t('pricing.trial', { days: plan.trialDays })}
              </p>

              <div className="mt-6">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    {formatCents(plan.priceMonthlyCents, plan.currency, locale)}
                  </span>
                  <span
                    className={cn(
                      'pb-1 text-xs',
                      featured ? 'text-sand-100/50' : 'text-ink-400',
                    )}
                  >
                    {t('pricing.perMonth')}
                  </span>
                </div>
                {plan.priceYearlyCents > 0 ? (
                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      featured ? 'text-sand-100/50' : 'text-ink-400',
                    )}
                  >
                    {formatCents(plan.priceYearlyCents, plan.currency, locale)}{' '}
                    {t('pricing.perYear')}
                    {savings > 0 ? (
                      <span className={featured ? 'ms-1.5 text-lime' : 'ms-1.5 text-brand-700'}>
                        · {t('pricing.save', { percent: savings })}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed">
                    <Check
                      className={cn(
                        'mt-0.5 size-3.5 shrink-0',
                        featured ? 'text-lime' : 'text-brand-600',
                      )}
                      aria-hidden
                    />
                    <span className={featured ? 'text-sand-100/75' : 'text-ink-600'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                <CheckoutButton
                  planId={plan.id}
                  interval="month"
                  label={
                    plan.tier === 'free'
                      ? t('common.getStarted')
                      : t('pricing.cta', { plan: plan.name })
                  }
                  signedIn={signedIn}
                  demo={demo}
                  variant={featured ? 'lime' : 'outline'}
                  errorLabel={t('settings.checkoutError')}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-400">{t('landing.trustLine')}</p>
    </section>
  );
}
