import type { Metadata } from 'next';

import { Search, Users } from 'lucide-react';

import { formatDate } from '@hse/shared';

import { UserActions } from '@/components/admin/user-actions';
import { PageHeader } from '@/components/dashboard/shell';
import { StockAvatar } from '@/components/dashboard/stock-avatar';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { getAdminPlans, getAdminUsers } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Admin users' };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const [{ t, locale }, params] = await Promise.all([getI18n(), searchParams]);
  const search = typeof params.search === 'string' ? params.search : '';
  const [users, plans] = await Promise.all([getAdminUsers(search), getAdminPlans()]);

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.admin')}
        title={t('admin.users.title')}
        description={t('admin.users.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600">
            <Users className="size-3.5 text-brand-700" aria-hidden />
            {users.length}
          </span>
        }
      />

      <form method="GET" className="mb-4 flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-ink-400"
            aria-hidden
          />
          <Input
            name="search"
            defaultValue={search}
            placeholder={t('admin.users.search')}
            className="ps-10"
            aria-label={t('admin.users.search')}
          />
        </div>
        <Button type="submit" variant="outline">
          {t('common.search')}
        </Button>
      </form>

      <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-sand-50/60 text-[9px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 text-start font-semibold">{t('admin.users.email')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.users.role')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.users.status')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.users.plan')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.users.created')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.users.lastActive')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-ink-400">
                    {t('admin.users.search')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <StockAvatar
                          symbol={(user.full_name ?? user.email ?? '?').slice(0, 2).toUpperCase()}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="max-w-48 truncate text-xs font-semibold text-ink-900">
                            {user.full_name ?? '—'}
                          </p>
                          <p className="max-w-48 truncate text-[10px] text-ink-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={user.role} label={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={user.status} label={user.status} />
                    </td>
                    <td className="px-4 py-3 text-[10px] text-ink-600">
                      <p className="font-semibold">{user.plan_id ?? t('common.free')}</p>
                      <p className="text-ink-400">{user.subscription_status ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-ink-500">
                      {formatDate(user.created_at, locale, { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-ink-500">
                      {user.last_seen_at
                        ? formatDate(user.last_seen_at, locale, { dateStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <UserActions
                        userId={user.id}
                        role={user.role}
                        status={user.status}
                        planId={user.plan_id}
                        plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))}
                        labels={{
                          save: t('common.save'),
                          saved: t('admin.users.updated'),
                          error: t('errors.generic'),
                          demo: t('admin.demoReadOnly'),
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
