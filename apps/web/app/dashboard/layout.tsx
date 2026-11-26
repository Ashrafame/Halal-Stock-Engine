import { isAdminRole, requireSession } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { getShellData } from '@/lib/shell-data';

import { DashboardShell } from '@/components/dashboard/shell';
import type { NavItem } from '@/components/dashboard/nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, { t, locale }] = await Promise.all([requireSession(), getI18n()]);
  const shell = await getShellData(session.userId);

  const items: NavItem[] = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: 'overview' },
    { href: '/dashboard/screener', label: t('nav.screener'), icon: 'screener' },
    { href: '/dashboard/alerts', label: t('nav.alerts'), icon: 'alerts' },
    { href: '/dashboard/portfolio', label: t('nav.portfolio'), icon: 'portfolio' },
    { href: '/dashboard/settings', label: t('nav.settings'), icon: 'settings' },
  ];

  if (isAdminRole(session.profile.role) || session.isDemo) {
    items.push({ href: '/admin', label: t('nav.admin'), icon: 'admin' });
  }

  const planName =
    shell.entitlements.plan_id.charAt(0).toUpperCase() + shell.entitlements.plan_id.slice(1);

  return (
    <DashboardShell
      profile={session.profile}
      items={items}
      locale={locale}
      t={t}
      demo={session.isDemo}
      unreadCount={shell.unreadCount}
      planLabel={planName}
    >
      {children}
    </DashboardShell>
  );
}
