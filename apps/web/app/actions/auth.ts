'use server';

import { redirect } from 'next/navigation';

import { fieldErrors, loginSchema, signupSchema } from '@hse/shared';

import { APP_URL, isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/action-state';

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      code: 'demo',
      message: 'Authentication is not configured in this environment.',
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, code: 'validation', message: Object.values(fieldErrors(parsed.error))[0] };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, code: 'invalid_credentials', message: 'Email or password is incorrect.' };
  }

  redirect(safeNext(formData.get('next')));
}

export async function signUpAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      code: 'demo',
      message: 'Authentication is not configured in this environment.',
    };
  }

  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName') || undefined,
    locale: formData.get('locale') || 'en',
    acceptedTerms: formData.get('acceptedTerms') === 'on',
  });
  if (!parsed.success) {
    return { ok: false, code: 'validation', message: Object.values(fieldErrors(parsed.error))[0] };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${APP_URL}/auth/callback`,
      data: {
        full_name: parsed.data.fullName ?? null,
        locale: parsed.data.locale,
      },
    },
  });

  if (error) {
    return { ok: false, code: 'signup_failed', message: error.message };
  }

  if (!data.session) {
    return {
      ok: true,
      code: 'check_email',
      message: 'Check your inbox to confirm your email address.',
    };
  }

  redirect('/dashboard');
}

export async function oauthAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) redirect('/login?error=demo');
  const provider = formData.get('provider') === 'apple' ? 'apple' : 'google';

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });

  if (error || !data.url) redirect('/login?error=oauth');
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect('/');
}
