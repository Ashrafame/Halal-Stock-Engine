import type { LucideIcon } from 'lucide-react';

import { cn } from '@hse/shared';

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: 'default' | 'dark' | 'positive' | 'warning';
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border p-5',
        tone === 'dark'
          ? 'border-ink-900 bg-ink-950 text-sand-50'
          : tone === 'positive'
            ? 'border-brand-200 bg-brand-50/60'
            : tone === 'warning'
              ? 'border-amber-200 bg-amber-50/60'
              : 'border-ink-200 bg-white',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-[0.14em]',
            tone === 'dark' ? 'text-sand-100/50' : 'text-ink-400',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'grid size-8 place-items-center rounded-xl',
            tone === 'dark'
              ? 'bg-white/10 text-lime'
              : tone === 'positive'
                ? 'bg-brand-100 text-brand-700'
                : tone === 'warning'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-sand-100 text-ink-500',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? (
        <p
          className={cn(
            'mt-1 text-[11px]',
            tone === 'dark' ? 'text-sand-100/45' : 'text-ink-400',
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
