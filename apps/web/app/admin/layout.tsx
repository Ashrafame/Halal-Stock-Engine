import Link from 'next/link';

import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { signOutAction } from '@/app/actions/auth';
import { AdminTabs, type AdminTab } from '@/components/admin/admin-tabs';
import { DemoBanner } from '@/components/demo-banner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { initials } from '@hse/shared';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, { t, locale }] = await Promise.all([requireAdmin(), getI18n()]);

  const tabs: AdminTab[] = [
    { href: '/admin', label: t('admin.nav.overview') },
    { href: '/admin/users', label: t('admin.nav.users') },
    { href: '/admin/plans', label: t('admin.nav.plans') },
    { href: '/admin/compliance', label: t('admin.nav.stocks') },
    { href: '/admin/cms', label: t('admin.nav.cms') },
    { href: '/admin/logs', label: t('admin.nav.logs') },
  ];

  return (
    <div className="min-h-dvh bg-sand-50">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950 text-sand-50">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo inverted />
            <Badge tone="brand" className="hidden bg-white/10 text-lime ring-white/15 sm:inline-flex">
              <ShieldCheck className="size-3" aria-hidden />
              {t('nav.admin')}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher locale={locale} label={t('common.language')} inverted />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-sand-100/80 transition hover:text-white"
            >
              <ArrowLeft className="size-3.5 flip-x" aria-hidden />
              <span className="hidden sm:inline">{t('nav.dashboard')}</span>
            </Link>
            <span className="grid size-8 place-items-center rounded-full bg-lime text-[10px] font-bold text-ink-950">
              {initials(session.profile.fullName, session.profile.email)}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full px-2 py-2 text-[11px] font-semibold text-sand-100/60 transition hover:text-white"
              >
                {t('nav.logout')}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {session.isDemo ? (
          <div className="mb-4">
            <DemoBanner message={t('admin.demoReadOnly')} />
          </div>
        ) : null}
        <AdminTabs tabs={tabs} />
        <main className="py-6">{children}</main>
      </div>
    </div>
  );
}
