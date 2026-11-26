import { getI18n } from '@/lib/i18n';
import { getSessionContext } from '@/lib/auth';
import { getPublicPlans, getTopStocks } from '@/lib/data';

import { FaqSection } from '@/components/marketing/faq';
import { FeaturesSection } from '@/components/marketing/features';
import { FinalCta } from '@/components/marketing/final-cta';
import { MarketingFooter } from '@/components/marketing/footer';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { MarketingNav } from '@/components/marketing/nav';
import { PricingSection } from '@/components/marketing/pricing-section';
import { TrustSection } from '@/components/marketing/trust';

export default async function LandingPage() {
  const [{ t, locale }, session, topStocks, plans] = await Promise.all([
    getI18n(),
    getSessionContext(),
    getTopStocks(4),
    getPublicPlans(),
  ]);

  const isDemo = session?.isDemo ?? false;
  const signedIn = Boolean(session) && !isDemo;
  const primaryHref = isDemo || signedIn ? '/dashboard' : '/signup';
  const primaryLabel = isDemo
    ? t('nav.dashboard')
    : signedIn
      ? t('nav.dashboard')
      : t('landing.ctaPrimary');

  return (
    <>
      <MarketingNav t={t} locale={locale} signedIn={signedIn} isDemo={isDemo} />
      <main>
        <Hero
          t={t}
          locale={locale}
          topStocks={topStocks}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
        />
        <FeaturesSection t={t} />
        <HowItWorks t={t} />
        <TrustSection t={t} />
        <PricingSection
          plans={plans}
          t={t}
          locale={locale}
          signedIn={signedIn}
          demo={isDemo}
        />
        <FaqSection t={t} />
        <FinalCta t={t} href={primaryHref} />
      </main>
      <MarketingFooter t={t} locale={locale} />
    </>
  );
}
