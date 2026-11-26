import { ArrowRight, BellPlus, ScanSearch, UserPlus } from 'lucide-react';

import { SectionHeading } from '@/components/ui/card';

export function HowItWorks({
  t,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const steps = [
    { icon: UserPlus, title: t('landing.steps.one.title'), body: t('landing.steps.one.body') },
    { icon: ScanSearch, title: t('landing.steps.two.title'), body: t('landing.steps.two.body') },
    { icon: BellPlus, title: t('landing.steps.three.title'), body: t('landing.steps.three.body') },
  ];

  return (
    <section id="how" className="relative overflow-hidden border-y border-ink-200/70 bg-sand-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t('nav.home')}
          title={t('landing.howTitle')}
          description={t('landing.howSubtitle')}
          align="center"
        />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative rounded-[1.75rem] border border-ink-200 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-ink-950 text-lime">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-5xl leading-none text-ink-100">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.body}</p>
                {index < steps.length - 1 ? (
                  <ArrowRight
                    className="absolute -end-3 top-1/2 hidden size-5 -translate-y-1/2 text-ink-300 md:block flip-x"
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
