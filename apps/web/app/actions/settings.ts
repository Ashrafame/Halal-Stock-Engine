'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { fieldErrors, localeSchema } from '@hse/shared';

import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { requireSession } from '@/lib/auth';
import { APP_URL, SUPABASE_ANON_KEY, SUPABASE_URL, isDemoMode } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const profileSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  locale: localeSchema,
  timezone: z.string().trim().min(1).max(64),
  notifyEmail: z.boolean(),
  notifyPush: z.boolean(),
});

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (isDemoMode) {
    return actionError('demo', 'Demo mode is read-only. Connect Supabase to save settings.');
  }

  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName') || undefined,
    locale: formData.get('locale') || 'en',
    timezone: formData.get('timezone') || 'UTC',
    notifyEmail: formData.get('notifyEmail') === 'on',
    notifyPush: formData.get('notifyPush') === 'on',
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName ?? null,
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      notify_email: parsed.data.notifyEmail,
      notify_push: parsed.data.notifyPush,
    })
    .eq('id', session.userId);

  if (error) return actionError('error', 'Could not save your profile.');

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard');
  return actionOk('Settings saved.');
}

async function callBillingFunction(
  path: 'stripe-checkout' | 'stripe-portal',
  body?: Record<string, unknown>,
): Promise<string> {
  const session = await requireSession();
  if (!session.accessToken) throw new Error('missing_session');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !payload.url) throw new Error(payload.error ?? 'billing_failed');
  return payload.url;
}

export async function startCheckoutAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (isDemoMode) {
    return actionError('demo', 'Demo mode cannot start checkout. Connect Stripe and Supabase.');
  }

  const planId = String(formData.get('planId') ?? '');
  const interval = formData.get('interval') === 'year' ? 'year' : 'month';
  if (!planId) return actionError('validation', 'Choose a plan.');

  let url: string;
  try {
    url = await callBillingFunction('stripe-checkout', {
      planId,
      interval,
      successUrl: `${APP_URL}/dashboard/settings?checkout=success`,
      cancelUrl: `${APP_URL}/#pricing`,
    });
  } catch {
    return actionError('billing_failed', 'Could not start checkout. Please try again.');
  }
  redirect(url);
}

export async function openBillingPortalAction(): Promise<void> {
  if (isDemoMode) redirect('/dashboard/settings?billing=demo');
  try {
    const url = await callBillingFunction('stripe-portal');
    redirect(url);
  } catch {
    redirect('/dashboard/settings?billing=error');
  }
}
