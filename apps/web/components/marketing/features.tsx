import {
  BellRing,
  Gauge,
  Languages,
  LineChart,
  PieChart,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';

import { SectionHeading } from '@/components/ui/card';
import { cn } from '@hse/shared';

export function FeaturesSection({
  t,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const features = [
    {
      key: 'screening',
      icon: ShieldCheck,
      title: t('landing.features.screening.title'),
      body: t('landing.features.screening.body'),
    },
    {
      key: 'alerts',
      icon: BellRing,
      title: t('landing.features.alerts.title'),
      body: t('landing.features.alerts.body'),
    },
    {
      key: 'realtime',
      icon: LineChart,
      title: t('landing.features.realtime.title'),
      body: t('landing.features.realtime.body'),
    },
    {
      key: 'portfolio',
      icon: PieChart,
      title: t('landing.features.portfolio.title'),
      body: t('landing.features.portfolio.body'),
    },
    {
      key: 'purification',
      icon: Gauge,
      title: t('landing.features.purification.title'),
      body: t('landing.features.purification.body'),
    },
  ];

  return (
    <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow={t('nav.screener')}
        title={t('landing.featuresTitle')}
        description={t('landing.featuresSubtitle')}
      />

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <div className="group relative overflow-hidden rounded-[1.75rem] border border-ink-200 bg-white p-6 md:col-span-2 lg:col-span-7">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink-950">{features[0]!.title}</h3>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-500">
                {features[0]!.body}
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-2.5 rounded-2xl border border-ink-100 bg-sand-50/60 p-4 sm:grid-cols-2">
            {[
              ['Debt / assets', '21%', 21, 'ok'],
              ['Interest income', '1.2%', 12, 'ok'],
              ['Non-compliant revenue', '0.4%', 4, 'ok'],
              ['Receivables', '28%', 28, 'ok'],
            ].map(([label, value, pct, tone]) => (
              <div key={String(label)} className="rounded-xl bg-white p-3 ring-1 ring-ink-100">
                <div className="flex items-center justify-between text-[10px] font-medium text-ink-400">
                  <span>{label}</span>
                  <span className={tone === 'ok' ? 'text-brand-700' : 'text-amber-700'}>
                    {value}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Number(pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-wide text-ink-400">
            AAOIFI · 33% / 5% / 5% / 49%
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[1.75rem] bg-ink-950 p-6 text-sand-50 md:col-span-2 lg:col-span-5">
          <div className="absolute inset-0 stripe-bg opacity-40" aria-hidden />
          <div className="relative">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-lime ring-1 ring-inset ring-white/15">
              <BellRing className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{features[1]!.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-sand-100/60">{features[1]!.body}</p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-lime">
                  {t('alerts.messages.price', { symbol: 'NVDA', price: '188.94', direction: 'above', target: '185.00' })}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lime px-3 text-[10px] font-bold text-ink-950"
                >
                  <BellRing className="size-3" aria-hidden />
                  {t('dashboard.oneClick')}
                </button>
                <span className="text-[10px] text-sand-100/45">{t('dashboard.oneClickHint')}</span>
              </div>
            </div>
          </div>
        </div>

        {features.slice(2).map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.key}
              className="card-lift rounded-[1.75rem] border border-ink-200 bg-white p-6 lg:col-span-4"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-sand-100 text-ink-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-950">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{feature.body}</p>
            </div>
          );
        })}

        <div className="relative overflow-hidden rounded-[1.75rem] border border-ink-200 bg-gradient-to-br from-sand-50 to-sand-100 p-6 lg:col-span-12">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-brand-700 ring-1 ring-ink-200">
                <Languages className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-ink-950">
                  {t('landing.features.multilingual.title')}
                </h3>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-500">
                  {t('landing.features.multilingual.body')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['English', 'العربية', 'Español'].map((language, index) => (
                <span
                  key={language}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold',
                    index === 1
                      ? 'bg-ink-900 text-sand-50'
                      : 'bg-white text-ink-600 ring-1 ring-ink-200',
                  )}
                  dir={index === 1 ? 'rtl' : 'ltr'}
                >
                  {language}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-400">
            <ScrollText className="size-3" aria-hidden />
            {t('compliance.methodology')} · {t('landing.stats.updates')}
          </div>
        </div>
      </div>
    </section>
  );
}
