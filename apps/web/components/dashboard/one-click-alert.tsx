'use client';

import { useActionState } from 'react';

import { BellPlus, Check, Loader2 } from 'lucide-react';

import { createOneClickAlert } from '@/app/actions/alerts';
import { initialActionState } from '@/lib/action-state';
import { cn } from '@hse/shared';

export interface OneClickLabels {
  action: string;
  created: string;
  hint: string;
  demo: string;
  limit: string;
  exists: string;
  compliance: string;
  feature: string;
  error: string;
}

function resolveLabel(code: string | undefined, labels: OneClickLabels): string {
  switch (code) {
    case 'demo':
      return labels.demo;
    case 'alert_limit':
      return labels.limit;
    case 'exists':
      return labels.exists;
    case 'compliance_gate':
      return labels.compliance;
    case 'feature_disabled':
      return labels.feature;
    default:
      return labels.error;
  }
}

export function OneClickAlertButton({
  stockId,
  labels,
  className,
  compact = false,
}: {
  stockId: string;
  labels: OneClickLabels;
  className?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createOneClickAlert, initialActionState);
  const done = state.ok;

  return (
    <form action={formAction} className={cn('relative', className)}>
      <input type="hidden" name="stockId" value={stockId} />
      <button
        type="submit"
        disabled={pending || done}
        title={labels.hint}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:cursor-default',
          compact ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-xs',
          done
            ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200'
            : 'bg-ink-900 text-sand-50 hover:bg-ink-800',
        )}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : done ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <BellPlus className="size-3.5" aria-hidden />
        )}
        <span>{done ? labels.created : labels.action}</span>
      </button>
      {state.message && !done ? (
        <p
          role="status"
          className="absolute end-0 top-full z-10 mt-1.5 w-48 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-medium leading-snug text-red-700 shadow-sm ring-1 ring-red-200"
        >
          {resolveLabel(state.code, labels)}
        </p>
      ) : null}
    </form>
  );
}
