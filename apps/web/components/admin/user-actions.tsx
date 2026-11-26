'use client';

import { useActionState } from 'react';

import { Loader2, Save } from 'lucide-react';

import { updateUserAction } from '@/app/actions/admin';
import { initialActionState } from '@/lib/action-state';

export function UserActions({
  userId,
  role,
  status,
  planId,
  plans,
  labels,
}: {
  userId: string;
  role: string;
  status: string;
  planId: string | null;
  plans: Array<{ id: string; name: string }>;
  labels: { save: string; saved: string; error: string; demo: string };
}) {
  const [state, formAction, pending] = useActionState(updateUserAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        aria-label="role"
        className="h-8 rounded-lg border border-ink-200 bg-white px-1.5 text-[10px] font-medium text-ink-700"
      >
        {['user', 'support', 'admin', 'owner'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <select
        name="status"
        defaultValue={status}
        aria-label="status"
        className="h-8 rounded-lg border border-ink-200 bg-white px-1.5 text-[10px] font-medium text-ink-700"
      >
        {['active', 'suspended', 'pending', 'deleted'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <select
        name="planId"
        defaultValue={planId ?? ''}
        aria-label="plan"
        className="h-8 rounded-lg border border-ink-200 bg-white px-1.5 text-[10px] font-medium text-ink-700"
      >
        <option value="">—</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center gap-1 rounded-full bg-ink-900 px-2.5 text-[10px] font-semibold text-sand-50 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <Save className="size-3" aria-hidden />
        )}
        {labels.save}
      </button>
      {state.message ? (
        <span
          role="status"
          className={`basis-full text-end text-[9px] font-medium ${
            state.ok ? 'text-brand-700' : 'text-red-600'
          }`}
        >
          {state.ok ? labels.saved : state.code === 'demo' ? labels.demo : labels.error}
        </span>
      ) : null}
    </form>
  );
}
