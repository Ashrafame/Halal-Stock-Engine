'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Apple, ArrowRight, Globe2, Loader2, Lock, Mail, UserRound } from 'lucide-react';

import { signInAction, signUpAction, oauthAction } from '@/app/actions/auth';
import { initialActionState } from '@/lib/action-state';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/form';
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@hse/shared';

export interface AuthLabels {
  loginTitle: string;
  loginSubtitle: string;
  signupTitle: string;
  signupSubtitle: string;
  email: string;
  password: string;
  fullName: string;
  language: string;
  acceptTerms: string;
  createAccount: string;
  signIn: string;
  orContinue: string;
  google: string;
  apple: string;
  noAccount: string;
  haveAccount: string;
  passwordHint: string;
  demoNotice: string;
  checkEmail: string;
  validation: string;
  invalidCredentials: string;
  generic: string;
}

function resolveMessage(code: string | undefined, labels: AuthLabels): string {
  switch (code) {
    case 'check_email':
      return labels.checkEmail;
    case 'validation':
      return labels.validation;
    case 'invalid_credentials':
      return labels.invalidCredentials;
    case 'demo':
      return labels.demoNotice;
    default:
      return labels.generic;
  }
}

export function AuthForm({
  mode,
  locale,
  next,
  labels,
  configured,
  demo,
}: {
  mode: 'login' | 'signup';
  locale: Locale;
  next: string;
  labels: AuthLabels;
  configured: boolean;
  demo: boolean;
}) {
  const action = mode === 'login' ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const isLogin = mode === 'login';
  const success = state.ok && state.code === 'check_email';

  if (success) {
    return (
      <div className="rounded-3xl border border-brand-200 bg-white p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <Mail className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink-950">{labels.checkEmail}</h1>
        <p className="mt-2 text-sm text-ink-500">{labels.signupSubtitle}</p>
        <Link
          href="/login"
          className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
        >
          {labels.signIn}
          <ArrowRight className="size-4 flip-x" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink-950">
        {isLogin ? labels.loginTitle : labels.signupTitle}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        {isLogin ? labels.loginSubtitle : labels.signupSubtitle}
      </p>

      {!configured || demo ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          {labels.demoNotice}
        </p>
      ) : null}

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        {!isLogin ? (
          <div>
            <Label htmlFor="fullName">{labels.fullName}</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-ink-400" aria-hidden />
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                maxLength={80}
                className="ps-10"
                placeholder="Amina Rahman"
              />
            </div>
          </div>
        ) : null}

        <div>
          <Label htmlFor="email">{labels.email}</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-ink-400" aria-hidden />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="ps-10"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">{labels.password}</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-ink-400" aria-hidden />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? 1 : 10}
              className="ps-10"
              placeholder="••••••••••"
            />
          </div>
          {!isLogin ? <p className="mt-1.5 text-[11px] text-ink-400">{labels.passwordHint}</p> : null}
        </div>

        {!isLogin ? (
          <>
            <div>
              <Label htmlFor="locale">{labels.language}</Label>
              <Select id="locale" name="locale" defaultValue={locale}>
                {SUPPORTED_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_META[code].nativeName}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-500">
              <input
                type="checkbox"
                name="acceptedTerms"
                required
                className="mt-0.5 size-4 rounded border-ink-300 text-brand-700"
              />
              <span>{labels.acceptTerms}</span>
            </label>
          </>
        ) : null}

        {state.message && !state.ok ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">
            {resolveMessage(state.code, labels)}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isLogin ? labels.signIn : labels.createAccount}
          {!pending ? <ArrowRight className="size-4 flip-x" aria-hidden /> : null}
        </Button>
      </form>

      {configured && !demo ? (
        <>
          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wide text-ink-400">
            <span className="h-px flex-1 bg-ink-200" />
            {labels.orContinue}
            <span className="h-px flex-1 bg-ink-200" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <form action={oauthAction}>
              <input type="hidden" name="provider" value="google" />
              <Button type="submit" variant="outline" className="w-full">
                <Globe2 className="size-4" aria-hidden />
                {labels.google}
              </Button>
            </form>
            <form action={oauthAction}>
              <input type="hidden" name="provider" value="apple" />
              <Button type="submit" variant="outline" className="w-full">
                <Apple className="size-4" aria-hidden />
                {labels.apple}
              </Button>
            </form>
          </div>
        </>
      ) : null}

      <p className="mt-6 text-center text-sm text-ink-500">
        {isLogin ? labels.noAccount : labels.haveAccount}{' '}
        <Link
          href={isLogin ? '/signup' : '/login'}
          className="font-semibold text-brand-700 hover:text-brand-800"
        >
          {isLogin ? labels.createAccount : labels.signIn}
        </Link>
      </p>
    </div>
  );
}
