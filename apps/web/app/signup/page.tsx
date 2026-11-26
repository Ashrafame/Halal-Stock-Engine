import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { getSessionContext } from '@/lib/auth';
import { isDemoMode, isSupabaseConfigured } from '@/lib/env';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage() {
  const [{ t, locale }, session] = await Promise.all([getI18n(), getSessionContext()]);

  if (session && !session.isDemo) redirect('/dashboard');

  return (
    <AuthShell locale={locale} t={t}>
      <AuthForm
        mode="signup"
        locale={locale}
        next="/dashboard"
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
