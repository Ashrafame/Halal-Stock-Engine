import Link from 'next/link';

import { ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LogoLink } from '@/components/logo';
import type { Locale } from '@hse/shared';

export function MarketingNav({
  t,
  locale,
  signedIn,
  isDemo,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: Locale;
  signedIn: boolean;
  isDemo: boolean;
}) {
  const ctaHref = isDemo ? '/dashboard' : signedIn ? '/dashboard' : '/signup';
  const ctaLabel = isDemo
    ? t('common.demo')
    : signedIn
      ? t('nav.dashboard')
      : t('nav.signup');

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <LogoLink inverted />

        <nav className="hidden items-center gap-7 text-sm font-medium text-sand-100/80 lg:flex">
          <a href="#features" className="transition-colors hover:text-white">
            {t('landing.featuresTitle')}
          </a>
          <a href="#how" className="transition-colors hover:text-white">
            {t('landing.howTitle')}
          </a>
          <a href="#pricing" className="transition-colors hover:text-white">
            {t('nav.pricing')}
          </a>
          <a href="#faq" className="transition-colors hover:text-white">
            {t('landing.faqTitle')}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} label={t('common.language')} inverted />
          {!signedIn && !isDemo ? (
            <Link
              href="/login"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-sand-100/80 transition-colors hover:text-white sm:inline-flex"
            >
              {t('nav.login')}
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-sand-100/80 transition-colors hover:text-white sm:inline-flex"
            >
              {t('nav.dashboard')}
            </Link>
          )}
          <ButtonLink href={ctaHref} variant="lime" size="sm" className="gap-1.5">
            {isDemo ? <LayoutDashboard className="size-4" /> : <Sparkles className="size-4" />}
            <span className="hidden sm:inline">{ctaLabel}</span>
            <ArrowRight className="size-4 flip-x" />
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
