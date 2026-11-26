import {
  ArrowRight,
  BellRing,
  Check,
  Globe2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import {
  formatCurrency,
  formatSignedPercent,
  localizedStockName,
  type Locale,
  type TopStock,
} from '@hse/shared';

import { ButtonLink } from '@/components/ui/button';
import { Sparkline } from '@/components/dashboard/sparkline';

export function Hero({
  t,
  locale,
  topStocks,
  primaryHref,
  primaryLabel,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: Locale;
  topStocks: TopStock[];
  primaryHref: string;
  primaryLabel: string;
}) {
  const display = topStocks.slice(0, 4);

  return (
    <section className="relative overflow-hidden bg-ink-950 text-sand-50">
      <div className="hero-glow absolute inset-0" aria-hidden />
      <div className="grid-paper absolute inset-0 opacity-40" aria-hidden />
      <div
        className="absolute -top-32 start-1/4 size-96 rounded-full bg-brand-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium text-sand-100/80 backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-lime" />
            </span>
            {t('landing.eyebrow')}
          </span>

          <h1 className="mt-6 text-balance font-display text-[2.7rem] leading-[0.98] tracking-[-0.03em] sm:text-6xl lg:text-[4.2rem]">
            {t('landing.heroTitle')}{' '}
            <span className="relative inline-block text-lime">
              {t('landing.heroHighlight')}
              <svg
                className="absolute -bottom-2 start-0 h-3 w-full text-lime/40"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M2 9C40 3 90 2 198 6"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-sand-100/70 sm:text-lg">
            {t('landing.heroSubtitle')}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href={primaryHref} variant="lime" size="lg" className="group">
              {primaryLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 flip-x" />
            </ButtonLink>
            <ButtonLink
              href="#how"
              size="lg"
              variant="ghost"
              className="border border-white/12 bg-white/5 text-sand-50 backdrop-blur hover:bg-white/10"
            >
              {t('landing.ctaSecondary')}
            </ButtonLink>
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-sand-100/45">
            <Check className="size-3.5 text-lime" aria-hidden />
            {t('landing.trustLine')}
          </p>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {[
              ['12,400+', t('landing.stats.stocks')],
              ['48,000+', t('landing.stats.clients')],
              ['99.9%', t('landing.stats.uptime')],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold tracking-tight text-white">{value}</dt>
                <dd className="mt-0.5 text-[11px] uppercase tracking-wide text-sand-100/40">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="fade-up fade-up-delay-2 relative mx-auto w-full max-w-[34rem] lg:mx-0">
          <div className="absolute -inset-6 rounded-[2.8rem] bg-gradient-to-br from-brand-400/20 via-transparent to-lime/10 blur-2xl" aria-hidden />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white text-ink-950 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold">{t('dashboard.topHalalTitle')}</p>
                <p className="mt-0.5 text-[11px] text-ink-400">{t('dashboard.topHalalSubtitle')}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-200">
                <span className="size-1.5 animate-pulse rounded-full bg-brand-600" />
                {t('common.updated')}
              </span>
            </div>

            <div className="divide-y divide-ink-100">
              {display.map((item) => {
                const quote = item.quote;
                return (
                  <div key={item.stock.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-[10px] font-bold text-lime">
                      {item.stock.symbol.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{item.stock.symbol}</p>
                      <p className="truncate text-[10px] text-ink-400">
                        {localizedStockName(item.stock, locale)}
                      </p>
                    </div>
                    <Sparkline
                      seed={item.stock.symbol}
                      positive={(quote?.changePercent ?? 0) >= 0}
                      className="hidden h-8 w-20 sm:block"
                    />
                    <div className="w-20 text-end">
                      <p className="text-xs font-semibold tabular-nums">
                        {quote ? formatCurrency(quote.price, item.stock.currency, locale) : '—'}
                      </p>
                      <p
                        className={`text-[10px] font-medium tabular-nums ${
                          (quote?.changePercent ?? 0) >= 0 ? 'text-brand-700' : 'text-red-600'
                        }`}
                      >
                        {quote ? formatSignedPercent(quote.changePercent, locale) : ''}
                      </p>
                    </div>
                    <span className="grid size-6 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                      <ShieldCheck className="size-3.5" aria-hidden />
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-ink-100 bg-sand-50/70 px-5 py-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-ink-500">
                <Globe2 className="size-3" aria-hidden />
                {t('landing.features.multilingual.title')}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-800">
                {t('dashboard.viewScreener')}
                <ArrowRight className="size-3 flip-x" aria-hidden />
              </span>
            </div>
          </div>

          <div className="absolute -bottom-8 -start-3 w-56 rounded-2xl border border-white/15 bg-ink-900/95 p-3.5 shadow-2xl backdrop-blur sm:-start-8">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-lime text-ink-950">
                <BellRing className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-lime">
                  {t('alerts.triggered')}
                </p>
                <p className="text-[10px] text-sand-100/60">NVDA · {t('alerts.suggestions.plus5')}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-sand-100/70">
              {t('dashboard.oneClickHint')}
            </p>
          </div>

          <div className="absolute -top-4 end-2 hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-sand-50 backdrop-blur sm:flex">
            <Sparkles className="size-3 text-lime" aria-hidden />
            AAOIFI · DJIM
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-[11px] uppercase tracking-[0.16em] text-sand-100/35 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2">
            <TrendingUp className="size-3.5" aria-hidden />
            {t('landing.stats.updates')}
          </span>
          <span>AAOIFI</span>
          <span>Dow Jones Islamic Market</span>
          <span className="inline-flex items-center gap-2">
            <Globe2 className="size-3.5" aria-hidden />
            English · العربية · Español
          </span>
        </div>
      </div>
    </section>
  );
}
