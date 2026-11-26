import Link from 'next/link';

import { Logo } from '@/components/logo';
import { LOCALE_META, type Locale } from '@hse/shared';

export function MarketingFooter({
  t,
  locale,
}: {
  t: (key: string) => string;
  locale: Locale;
}) {
  return (
    <footer className="border-t border-white/10 bg-ink-950 text-sand-100/70">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo inverted />
          <p className="max-w-xs text-sm leading-relaxed text-sand-200/60">
            {t('landing.heroSubtitle')}
          </p>
          <p className="text-xs text-sand-200/40">
            {LOCALE_META[locale].nativeName} · {LOCALE_META[locale].englishName}
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sand-200/50">
            {t('footer.product')}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/dashboard" className="transition hover:text-white">
                {t('nav.dashboard')}
              </Link>
            </li>
            <li>
              <Link href="/dashboard/screener" className="transition hover:text-white">
                {t('nav.screener')}
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="transition hover:text-white">
                {t('nav.pricing')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sand-200/50">
            {t('footer.company')}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="mailto:support@halalstockengine.app" className="transition hover:text-white">
                {t('footer.contact')}
              </a>
            </li>
            <li>
              <Link href="/login" className="transition hover:text-white">
                {t('nav.login')}
              </Link>
            </li>
            <li>
              <Link href="/signup" className="transition hover:text-white">
                {t('nav.signup')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sand-200/50">
            {t('footer.legal')}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="cursor-default">{t('footer.privacy')}</span>
            </li>
            <li>
              <span className="cursor-default">{t('footer.terms')}</span>
            </li>
            <li>
              <span className="cursor-default">{t('compliance.methodology')}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-sand-200/40 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} Halal Stock Engine. {t('footer.rights')}
          </p>
          <p className="max-w-2xl leading-relaxed">{t('landing.disclaimer')}</p>
        </div>
      </div>
    </footer>
  );
}
