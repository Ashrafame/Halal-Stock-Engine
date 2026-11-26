import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { getSessionContext } from '@/lib/auth';
import { isDemoMode, isSupabaseConfigured } from '@/lib/env';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ t, locale }, session, params] = await Promise.all([
    getI18n(),
    getSessionContext(),
    searchParams,
  ]);

  if (session && !session.isDemo) redirect('/dashboard');

  const next =
    typeof params.next === 'string' && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/dashboard';

  return (
    <AuthShell locale={locale} t={t}>
      {params.error ? (
        <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {params.error === 'demo' ? t('auth.demoNotice') : t('auth.invalidCredentials')}
        </p>
      ) : null}
      <AuthForm
        mode="login"
        locale={locale}
        next={next}
        configured={isSupabaseConfigured}
        demo={isDemoMode}
        labels={{
          loginTitle: t('auth.loginTitle'),
          loginSubtitle: t('auth.loginSubtitle'),
          signupTitle: t('auth.signupTitle'),
          signupSubtitle: t('auth.signupSubtitle'),
          email: t('auth.email'),
          password: t('auth.password'),
          fullName: t('auth.fullName'),
          language: t('auth.language'),
          acceptTerms: t('auth.acceptTerms'),
          createAccount: t('auth.createAccount'),
          signIn: t('auth.signIn'),
          orContinue: t('auth.orContinue'),
          google: t('auth.google'),
          apple: t('auth.apple'),
          noAccount: t('auth.noAccount'),
          haveAccount: t('auth.haveAccount'),
          passwordHint: t('auth.passwordHint'),
          demoNotice: t('auth.demoNotice'),
          checkEmail: t('auth.checkEmail'),
          validation: t('errors.validation'),
          invalidCredentials: t('auth.invalidCredentials'),
          generic: t('errors.generic'),
        }}
      />
    </AuthShell>
  );
}
