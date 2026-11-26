import { Plus } from 'lucide-react';

import { SectionHeading } from '@/components/ui/card';

export function FaqSection({
  t,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const items = [1, 2, 3, 4, 5].map((index) => ({
    question: t(`landing.faq.q${index}`),
    answer: t(`landing.faq.a${index}`),
  }));

  return (
    <section id="faq" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          eyebrow={t('landing.faqTitle')}
          title={t('landing.faqTitle')}
          description={t('landing.finalCtaBody')}
        />
        <div className="divide-y divide-ink-200 rounded-[1.75rem] border border-ink-200 bg-white">
          {items.map((item) => (
            <details key={item.question} className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink-900">
                {item.question}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-500 transition group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand-700">
                  <Plus className="size-3.5" aria-hidden />
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
