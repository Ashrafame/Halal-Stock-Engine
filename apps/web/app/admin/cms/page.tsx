import type { Metadata } from 'next';

import { Trash2 } from 'lucide-react';

import { formatDate, LOCALE_META } from '@hse/shared';

import {
  BroadcastForm,
  TranslationForm,
  VariableForm,
} from '@/components/admin/cms-forms';
import { PageHeader } from '@/components/dashboard/shell';
import { StatusBadge } from '@/components/ui/badge';
import { getAdminCmsData } from '@/lib/data';
import { getI18n } from '@/lib/i18n';
import { deleteVariableAction } from '@/app/actions/admin';

export const metadata: Metadata = { title: 'Admin content' };

export default async function AdminCmsPage() {
  const [{ t, locale }, data] = await Promise.all([getI18n(), getAdminCmsData()]);

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.admin')}
        title={t('admin.cms.title')}
        description={t('admin.cms.subtitle')}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <BroadcastForm
          labels={{
            title: t('admin.cms.broadcast'),
            titleLabel: t('admin.cms.broadcastTitle'),
            bodyLabel: t('admin.cms.broadcastBody'),
            audience: t('admin.cms.audience'),
            allOption: t('common.all'),
            send: t('admin.cms.send'),
            saved: t('admin.cms.saved'),
            error: t('errors.generic'),
            demo: t('admin.demoReadOnly'),
          }}
        />
        <TranslationForm
          dictionaryKeys={data.dictionaryKeys}
          labels={{
            title: t('admin.cms.translations'),
            locale: t('admin.cms.locale'),
            namespace: t('admin.cms.namespace'),
            key: t('admin.cms.key'),
            value: t('admin.cms.value'),
            publish: t('admin.cms.publish'),
            saved: t('admin.cms.saved'),
            error: t('errors.generic'),
            demo: t('admin.demoReadOnly'),
          }}
        />
      </div>

      <section className="mt-5 rounded-3xl border border-ink-200 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-950">{t('admin.cms.translations')}</h2>
          <span className="text-[10px] uppercase tracking-wide text-ink-400">
            {data.translations.length}
          </span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-sand-50/60 text-[9px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5 text-start font-semibold">{t('admin.cms.locale')}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t('admin.cms.key')}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t('admin.cms.value')}</th>
                <th className="px-4 py-2.5 text-end font-semibold">{t('common.updated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {data.translations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-xs text-ink-400">
                    {t('admin.cms.subtitle')}
                  </td>
                </tr>
              ) : (
                data.translations.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        value="info"
                        label={LOCALE_META[entry.locale as 'en' | 'ar' | 'es']?.nativeName ?? entry.locale}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-mono text-[10px] font-semibold text-ink-800">
                        {entry.namespace}.{entry.key}
                      </p>
                    </td>
                    <td className="max-w-md px-4 py-2.5">
                      <p
                        className="truncate text-[11px] text-ink-600"
                        dir={entry.locale === 'ar' ? 'rtl' : 'ltr'}
                      >
                        {entry.value}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-end text-[10px] text-ink-400">
                      {formatDate(entry.updated_at, locale, { dateStyle: 'short' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <VariableForm
          labels={{
            title: t('admin.cms.variables'),
            key: t('admin.cms.key'),
            value: t('admin.cms.value'),
            description: t('admin.cms.value'),
            category: t('admin.cms.namespace'),
            publicVar: t('admin.cms.publicVar'),
            publish: t('admin.cms.publish'),
            saved: t('admin.cms.saved'),
            error: t('errors.generic'),
            demo: t('admin.demoReadOnly'),
          }}
        />

        <div className="rounded-3xl border border-ink-200 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-950">{t('admin.cms.variables')}</h2>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">
              {data.variables.length}
            </span>
          </div>
          <ul className="divide-y divide-ink-100">
            {data.variables.map((variable) => (
              <li key={variable.key} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-mono text-[10px] font-semibold text-ink-900">
                      {variable.key}
                    </p>
                    <span className="rounded-full bg-sand-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-ink-500">
                      {variable.category}
                    </span>
                    {variable.is_public ? (
                      <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-brand-700">
                        {t('admin.cms.publicVar')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-ink-400">
                    {JSON.stringify(variable.value)}
                  </p>
                  {variable.description ? (
                    <p className="mt-0.5 truncate text-[9px] text-ink-300">{variable.description}</p>
                  ) : null}
                </div>
                <form action={deleteVariableAction}>
                  <input type="hidden" name="key" value={variable.key} />
                  <button
                    type="submit"
                    aria-label={`${t('common.delete')} ${variable.key}`}
                    className="grid size-7 place-items-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
