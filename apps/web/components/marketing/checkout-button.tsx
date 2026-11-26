'use client';

import { useActionState } from 'react';

import { CreditCard, Loader2 } from 'lucide-react';

import { startCheckoutAction } from '@/app/actions/settings';
import { initialActionState } from '@/lib/action-state';
import { Button, ButtonLink } from '@/components/ui/button';

export function CheckoutButton({
  planId,
  interval,
  label,
  signedIn,
  demo,
  variant = 'primary',
  errorLabel,
}: {
  planId: string;
  interval: 'month' | 'year';
  label: string;
  signedIn: boolean;
  demo: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'lime';
  errorLabel: string;
}) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, initialActionState);

  if (!signedIn || demo) {
    return (
      <ButtonLink
        href={demo ? '/dashboard' : `/signup?plan=${encodeURIComponent(planId)}`}
        variant={variant}
        className="w-full"
      >
        {label}
      </ButtonLink>
    );
  }

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="interval" value={interval} />
      <Button type="submit" variant={variant} className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <CreditCard className="size-4" aria-hidden />
        )}
        {label}
      </Button>
      {state.message && !state.ok ? (
        <p className="mt-2 text-center text-[11px] font-medium text-red-600" role="alert">
          {errorLabel}
        </p>
      ) : null}
    </form>
  );
}
