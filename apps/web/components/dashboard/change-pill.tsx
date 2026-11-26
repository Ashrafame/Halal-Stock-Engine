import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn, formatSignedPercent, type Locale } from '@hse/shared';

export function ChangePill({
  value,
  locale,
  className,
}: {
  value: number;
  locale: Locale;
  className?: string;
}) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
        positive ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {formatSignedPercent(value, locale)}
    </span>
  );
}
