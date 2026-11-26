import Link from 'next/link';
import type { ReactNode } from 'react';

import { ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

import { LanguageSwitcher } from '@/components/language-switcher';
import { LogoLink } from '@/components/logo';
import type { Locale } from '@hse/shared';

export function AuthShell({
  locale,
  t,
  children,
}: {
  locale: Locale;
  t: (key: string) => string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-10 text-sand-50 lg:flex lg:flex-col lg:justify-between">
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="grid-paper absolute inset-0 opacity-40" aria-hidden />

        <div className="relative">
          <LogoLink inverted />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-lime">
            <Sparkles className="size-3.5" aria-hidden />
            {t('landing.eyebrow')}
          </span>
          <h2 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight">
            {t('landing.heroTitle')} <span className="text-lime">{t('landing.heroHighlight')}</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-sand-100/60">{t('landing.heroSubtitle')}</p>

          <ul className="mt-8 space-y-3 text-sm text-sand-100/70">
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-lime" aria-hidden />
              {t('landing.features.screening.title')}
            </li>
            <li className="flex items-center gap-2.5">
              <TrendingUp className="size-4 text-lime" aria-hidden />
              {t('landing.features.realtime.title')}
            </li>
            <li className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-lime" aria-hidden />
              {t('landing.features.multilingual.title')}
            </li>
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-sand-100/40">
          <span>© {new Date().getFullYear()} Halal Stock Engine</span>
          <Link href="/" className="transition hover:text-white">
            {t('nav.home')}
          </Link>
        </div>
      </aside>

      <main className="flex flex-col bg-sand-50">
        <div className="flex items-center justify-between border-b border-ink-200/70 px-5 py-4 lg:hidden">
          <LogoLink />
          <LanguageSwitcher locale={locale} label={t('common.language')} />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <div className="hidden justify-end px-8 pb-6 lg:flex">
          <LanguageSwitcher locale={locale} label={t('common.language')} />
        </div>
      </main>
    </div>
  );
}
