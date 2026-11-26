import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@hse/shared';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  success: 'bg-brand-50 text-brand-800 ring-brand-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  brand: 'bg-ink-900 text-sand-50 ring-ink-900',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  halal: 'success',
  questionable: 'warning',
  haram: 'danger',
  unknown: 'neutral',
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  canceled: 'neutral',
  paused: 'neutral',
  triggered: 'warning',
  suspended: 'danger',
  deleted: 'danger',
  pending: 'warning',
  admin: 'brand',
  owner: 'brand',
  support: 'info',
};

export function StatusBadge({
  value,
  label,
  className,
}: {
  value: string;
  label: ReactNode;
  className?: string;
}) {
  return (
    <Badge tone={statusTone[value] ?? 'neutral'} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}
