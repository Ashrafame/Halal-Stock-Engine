'use client';

import { useActionState } from 'react';

import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react';

import {
  clearComplianceOverrideAction,
  overrideComplianceAction,
} from '@/app/actions/admin';
import { initialActionState } from '@/lib/action-state';

export function OverrideForm({
  stockId,
  currentStatus,
  currentScore,
  overrideReason,
  overrideExpiresAt,
  hasOverride,
  labels,
}: {
  stockId: string;
  currentStatus: string;
  currentScore: number | null;
  overrideReason: string | null;
  overrideExpiresAt: string | null;
  hasOverride: boolean;
  labels: {
    save: string;
    saved: string;
    error: string;
    demo: string;
    status: string;
    reason: string;
    expires: string;
    clear: string;
  };
}) {
  const [state, formAction, pending] = useActionState(overrideComplianceAction, initialActionState);

  return (
    <div className="space-y-1.5">
      <form action={formAction} className="flex flex-wrap items-end gap-1.5">
        <input type="hidden" name="stockId" value={stockId} />
        <select
          name="status"
          defaultValue={currentStatus}
          aria-label={labels.status}
          className="h-8 rounded-lg border border-ink-200 bg-white px-1.5 text-[10px] font-medium text-ink-700"
        >
          {['halal', 'questionable', 'haram', 'unknown'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          name="score"
          type="number"
          min="0"
          max="100"
          step="1"
          defaultValue={currentScore ?? ''}
          aria-label="score"
          placeholder="score"
          className="h-8 w-16 rounded-lg border border-ink-200 bg-white px-1.5 text-[10px] text-ink-700"
        />
        <input
          name="reason"
          required
          minLength={10}
          maxLength={500}
          defaultValue={overrideReason ?? ''}
          aria-label={labels.reason}
          placeholder={labels.reason}
          className="h-8 w-44 rounded-lg border border-ink-200 bg-white px-2 text-[10px] text-ink-700"
        />
        <input
          name="expiresAt"
          type="date"
          defaultValue={overrideExpiresAt?.slice(0, 10) ?? ''}
          aria-label={labels.expires}
          className="h-8 rounded-lg border border-ink-200 bg-white px-1.5 text-[10px] text-ink-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-ink-900 px-2.5 text-[10px] font-semibold text-sand-50 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="size-3" aria-hidden />
          )}
          {labels.save}
        </button>
        {hasOverride ? (
          <button
            type="submit"
            formAction={clearComplianceOverrideAction}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-ink-200 px-2.5 text-[10px] font-semibold text-ink-600 hover:text-ink-900"
          >
            <RotateCcw className="size-3" aria-hidden />
            {labels.clear}
          </button>
        ) : null}
      </form>
      {state.message ? (
        <p
          role="status"
          className={`text-[9px] font-medium ${state.ok ? 'text-brand-700' : 'text-red-600'}`}
        >
          {state.ok ? labels.saved : state.code === 'demo' ? labels.demo : labels.error}
        </p>
      ) : null}
    </div>
  );
}
