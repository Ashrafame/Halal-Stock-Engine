import Link from 'next/link';
import type { ReactNode } from 'react';

import { Bell, ChevronRight, Sparkles } from 'lucide-react';

import { signOutAction } from '@/app/actions/auth';
import { DemoBanner } from '@/components/demo-banner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LogoLink } from '@/components/logo';
import { MobileNav, SidebarNav, type NavItem } from '@/components/dashboard/nav';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { initials, type Locale, type Profile } from '@hse/shared';
import { cn } from '@hse/shared';

export function DashboardShell({
  profile,
  items,
  locale,
  t,
  demo,
  unreadCount,
  planLabel,
  children,
}: {
  profile: Profile;
  items: NavItem[];
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  demo: boolean;
  unreadCount: number;
  planLabel: string;
  children: ReactNode;
}) {
  const navItems: NavItem[] = items.map((item) =>
    item.icon === 'alerts' ? { ...item, badge: unreadCount } : item,
  );

  return (
    <div className="min-h-dvh bg-sand-50">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-white/10 bg-ink-950 p-5 lg:flex">
        <LogoLink inverted />

        <div className="mt-8 flex-1">
          <SidebarNav items={navItems} />
        </div>

        <div className="space-y-4">
          {profile.role === 'user' ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-lime">
                <Sparkles className="size-3" aria-hidden />
                {planLabel}
              </span>
              <p className="mt-1.5 text-[11px] leading-relaxed text-sand-100/50">
                {t('dashboard.upgradeBody')}
              </p>
              <Link
                href="/#pricing"
                className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-lime"
              >
                {t('settings.upgrade')}
                <ChevronRight className="size-3 flip-x" aria-hidden />
              </Link>
            </div>
          ) : null}

          <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime text-xs font-bold text-ink-950">
              {initials(profile.fullName, profile.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sand-50">
                {profile.fullName ?? profile.email}
              </p>
              <p className="truncate text-[10px] text-sand-100/40">{profile.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-sand-50/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <LogoLink />
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <Badge tone="neutral">{planLabel}</Badge>
              {profile.role !== 'user' ? <Badge tone="brand">{profile.role}</Badge> : null}
            </div>

            <div className="flex items-center gap-2">
              <LanguageSwitcher locale={locale} label={t('common.language')} />
              <Link
                href="/dashboard#notifications"
                className="relative grid size-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-500 transition hover:text-ink-900"
                aria-label={t('dashboard.notifications')}
              >
                <Bell className="size-4" aria-hidden />
                {unreadCount > 0 ? (
                  <span className="absolute -end-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </Link>
              <form action={signOutAction} className="hidden sm:block">
                <button
                  type="submit"
                  className="rounded-full border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 transition hover:text-ink-900"
                >
                  {t('nav.logout')}
                </button>
              </form>
              <span className="ms-1 grid size-9 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-lime lg:hidden">
                {initials(profile.fullName, profile.email)}
              </span>
            </div>
          </div>
        </header>

        {demo ? (
          <div className="px-4 pt-4 sm:px-6 lg:px-8">
            <DemoBanner message={t('dashboard.demoBanner')} />
          </div>
        ) : null}

        <main className={cn('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8', 'pb-28 lg:pb-10')}>
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <MobileNav items={navItems} />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink-950 sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function UpgradeCta({
  t,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-ink-950 p-6 text-sand-50 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-semibold">{t('dashboard.upgradeCta')}</p>
        <p className="mt-1 text-xs text-sand-100/55">{t('dashboard.upgradeBody')}</p>
      </div>
      <ButtonLink href="/#pricing" variant="lime" size="sm">
        {t('settings.upgrade')}
        <ChevronRight className="size-3.5 flip-x" aria-hidden />
      </ButtonLink>
    </div>
  );
}
