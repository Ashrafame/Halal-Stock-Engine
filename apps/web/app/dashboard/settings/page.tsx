import type { Metadata } from 'next';
import Link from 'next/link';

import { CreditCard, ShieldCheck, Sparkles } from 'lucide-react';

import { formatDate } from '@hse/shared';

import { SettingsForm } from '@/components/dashboard/settings-form';
import { PageHeader } from '@/components/dashboard/shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { signOutAction } from '@/app/actions/auth';
import { openBillingPortalAction } from '@/app/actions/settings';
import { requireSession } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { getShellData } from '@/lib/shell-data';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; billing?: string }>;
}) {
  const [session, { t, locale }, params] = await Promise.all([
    requireSession(),
    getI18n(),
    searchParams,
  ]);
  const shell = await getShellData(session.userId);
  const planName =
    shell.entitlements.plan_id.charAt(0).toUpperCase() + shell.entitlements.plan_id.slice(1);
  const isPaid = shell.entitlements.tier !== 'free';

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.settings')}
        title={t('settings.title')}
        description={t('settings.subtitle')}
      />

      {params.checkout === 'success' ? (
        <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs font-medium text-brand-800">
          {t('settings.checkoutSuccess')}
        </div>
      ) : null}
      {params.checkout && params.checkout !== 'success' ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {t('settings.checkoutError')}
        </div>
      ) : null}
      {params.billing ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          {params.billing === 'demo' ? t('settings.demoBilling') : t('settings.checkoutError')}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <SettingsForm
          profile={{
            fullName: session.profile.fullName,
            email: session.profile.email,
            locale: session.profile.locale,
            timezone: session.profile.timezone,
            notifyEmail: session.profile.notifyEmail,
            notifyPush: session.profile.notifyPush,
          }}
          labels={{
            profile: t('settings.profile'),
            fullName: t('auth.fullName'),
            email: t('settings.email'),
            language: t('settings.language'),
            timezone: t('settings.timezone'),
            notifications: t('settings.notifications'),
            push: t('settings.push'),
            emailAlerts: t('settings.emailAlerts'),
            save: t('settings.save'),
            saved: t('settings.saved'),
            demo: t('settings.demoBilling'),
            error: t('errors.generic'),
          }}
        />

        <div className="space-y-4">
          <section className="rounded-3xl border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-950">{t('settings.billing')}</h2>
            <div className="mt-4 rounded-2xl bg-ink-950 p-4 text-sand-50">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-lime">
                  <Sparkles className="size-3" aria-hidden />
                  {planName}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand-100/70">
                  {shell.entitlements.subscription_status ?? t('common.free')}
                </span>
              </div>
              <p className="mt-3 text-[11px] text-sand-100/55">
                {shell.entitlements.current_period_end
                  ? `${t('settings.plan')} · ${formatDate(
                      shell.entitlements.current_period_end,
                      locale,
                    )}`
                  : t('pricing.freeForever')}
              </p>
              <p className="mt-1 text-[11px] text-sand-100/40">
                {t('pricing.features.alerts', {
                  count:
                    shell.entitlements.limits.maxAlerts === -1
                      ? t('common.unlimited')
                      : shell.entitlements.limits.maxAlerts ?? 0,
                })}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {isPaid ? (
                <form action={openBillingPortalAction}>
                  <Button type="submit" variant="outline" className="w-full">
                    <CreditCard className="size-4" aria-hidden />
                    {t('settings.manageBilling')}
                  </Button>
                </form>
              ) : (
                <ButtonLink href="/#pricing" className="w-full">
                  <Sparkles className="size-4" aria-hidden />
                  {t('settings.upgrade')}
                </ButtonLink>
              )}
              <Link
                href="/#pricing"
                className="block text-center text-[10px] font-medium text-ink-400 hover:text-ink-700"
              >
                {t('pricing.monthly')} / {t('pricing.yearly')}
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-950">{t('settings.security')}</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
              {t('auth.passwordHint')}
            </p>
            <form action={signOutAction} className="mt-4">
              <Button type="submit" variant="outline" className="w-full">
                {t('settings.signOut')}
              </Button>
            </form>
          </section>

          <section className="rounded-3xl border border-red-200 bg-red-50/50 p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
              <ShieldCheck className="size-4" aria-hidden />
              {t('settings.dangerZone')}
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-red-700/80">
              {t('settings.deleteWarning')}
            </p>
            <button
              type="button"
              disabled
              className="mt-3 w-full rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-400"
            >
              {t('settings.deleteAccount')}
            </button>
          </section>

          {shell.entitlements.trial_end ? (
            <p className="text-center text-[10px] text-ink-400">
              {t('pricing.trial', { days: 14 })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
