import { BadgeCheck, BookOpenCheck, Landmark } from 'lucide-react';

import { SectionHeading } from '@/components/ui/card';

export function TrustSection({
  t,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const checks = [
    t('screening.checks.debtToAssets'),
    t('screening.checks.interestIncome'),
    t('screening.checks.nonCompliantRevenue'),
    t('screening.checks.receivables'),
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid items-center gap-10 rounded-[2rem] border border-ink-200 bg-white p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading
            eyebrow={t('compliance.methodology')}
            title={t('landing.guaranteeTitle')}
            description={t('landing.guaranteeBody')}
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-lime">
              <BadgeCheck className="size-3.5" aria-hidden />
              AAOIFI
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700">
              <Landmark className="size-3.5" aria-hidden />
              Dow Jones Islamic Market
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700">
              <BookOpenCheck className="size-3.5" aria-hidden />
              {t('compliance.manual')}
            </span>
          </div>
        </div>

        <div className="rounded-3xl bg-ink-950 p-6 text-sand-50">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime">
            {t('compliance.label')}
          </p>
          <ul className="mt-4 space-y-3">
            {checks.map((check, index) => (
              <li key={check} className="flex items-center justify-between gap-4">
                <span className="text-xs leading-relaxed text-sand-100/70">{check}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-lime">
                  {['≤ 33%', '≤ 5%', '≤ 5%', '≤ 49%'][index]}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-white/10 pt-4 text-[10px] leading-relaxed text-sand-100/40">
            {t('compliance.methodologyBody')}
          </div>
        </div>
      </div>
    </section>
  );
}
