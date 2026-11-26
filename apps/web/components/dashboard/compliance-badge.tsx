import { AlertTriangle, HelpCircle, ShieldCheck, XCircle } from 'lucide-react';

import { cn, type ComplianceStatus } from '@hse/shared';

const config: Record<
  ComplianceStatus,
  { label: string; className: string; icon: typeof ShieldCheck }
> = {
  halal: {
    label: 'Halal',
    className: 'bg-brand-50 text-brand-800 ring-brand-200',
    icon: ShieldCheck,
  },
  questionable: {
    label: 'Questionable',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
    icon: AlertTriangle,
  },
  haram: {
    label: 'Not compliant',
    className: 'bg-red-50 text-red-700 ring-red-200',
    icon: XCircle,
  },
  unknown: {
    label: 'Not screened',
    className: 'bg-ink-100 text-ink-600 ring-ink-200',
    icon: HelpCircle,
  },
};

export function ComplianceBadge({
  status,
  label,
  size = 'md',
  className,
}: {
  status: ComplianceStatus;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const entry = config[status] ?? config.unknown;
  const Icon = entry.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        entry.className,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-2.5' : 'size-3'} aria-hidden />
      {label}
    </span>
  );
}
