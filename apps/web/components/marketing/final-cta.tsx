import { ArrowRight, ShieldCheck } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

export function FinalCta({
  t,
  href,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  href: string;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink-950 px-6 py-14 text-center text-sand-50 sm:px-12">
        <div className="hero-glow absolute inset-0 opacity-70" aria-hidden />
        <div className="grid-paper absolute inset-0 opacity-30" aria-hidden />
        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-lime">
            <ShieldCheck className="size-3.5" aria-hidden />
            AAOIFI · DJIM
          </span>
          <h2 className="mt-5 font-display text-3xl leading-tight tracking-tight sm:text-5xl">
            {t('landing.finalCtaTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-sand-100/60">
            {t('landing.finalCtaBody')}
          </p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href={href} variant="lime" size="lg" className="group">
              {t('landing.ctaPrimary')}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 flip-x" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
