import type { Metadata } from 'next';

import { AlertOctagon, ScrollText } from 'lucide-react';

import { formatDate } from '@hse/shared';

import { PageHeader } from '@/components/dashboard/shell';
import { getAdminErrors, getAdminLogs } from '@/lib/data';
import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Admin logs' };

export default async function AdminLogsPage() {
  const [{ t, locale }, logs, errors] = await Promise.all([
    getI18n(),
    getAdminLogs(),
    getAdminErrors(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.admin')}
        title={t('admin.logs.title')}
        description={t('admin.logs.subtitle')}
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="rounded-3xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
              <ScrollText className="size-4 text-brand-700" aria-hidden />
              {t('admin.logs.title')}
            </h2>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">{logs.length}</span>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-sand-50/60 text-[9px] uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2.5 text-start font-semibold">{t('admin.logs.action')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('admin.logs.entity')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('admin.logs.actor')}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{t('admin.logs.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-xs text-ink-400">
                      {t('admin.logs.empty')}
                    </td>
                  </tr>
                ) : (
                  logs.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2.5">
                        <span className="rounded-md bg-ink-950 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-lime">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-ink-600">
                        {entry.entity_type}
                        {entry.entity_id ? (
                          <span className="ms-1 font-mono text-[9px] text-ink-400">
                            {entry.entity_id.slice(0, 18)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-ink-500">
                        {entry.actor_email ?? 'system'}
                      </td>
                      <td className="px-4 py-2.5 text-end text-[10px] text-ink-400">
                        {formatDate(entry.created_at, locale, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
              <AlertOctagon className="size-4 text-amber-600" aria-hidden />
              {t('admin.metrics.errorRate')}
            </h2>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">{errors.length}</span>
          </div>
          <ul className="max-h-[640px] divide-y divide-ink-100 overflow-y-auto scrollbar-thin">
            {errors.length === 0 ? (
              <li className="px-5 py-10 text-center text-xs text-ink-400">
                {t('admin.logs.empty')}
              </li>
            ) : (
              errors.map((error) => (
                <li key={error.id} className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                        error.level === 'fatal' || error.level === 'error'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {error.level}
                    </span>
                    <span className="text-[9px] text-ink-400">
                      {formatDate(error.created_at, locale, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] font-medium text-ink-700">{error.message}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
