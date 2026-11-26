import { cache } from 'react';

import { headers, cookies } from 'next/headers';

import {
  createTranslator,
  normalizeLocale,
  type Dictionary,
  type Locale,
  type TranslationOverrides,
} from '@hse/shared';

import { isSupabaseConfigured } from './env';
import { createStaticClient } from './supabase/static';

export const LOCALE_COOKIE = 'hse-locale';

function fromAcceptLanguage(value: string | null): Locale {
  if (!value) return 'en';
  const preferred = value
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter(Boolean);
  for (const candidate of preferred) {
    if (!candidate) continue;
    const normalized = normalizeLocale(candidate, 'en');
    if (normalized !== 'en' || candidate.toLowerCase().startsWith('en')) return normalized;
  }
  return 'en';
}

export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (fromCookie) return normalizeLocale(fromCookie, 'en');
  const requestHeaders = await headers();
  return fromAcceptLanguage(requestHeaders.get('accept-language'));
});

/** CMS overrides from the translations table, keyed `namespace.key`. */
async function loadOverrides(locale: Locale): Promise<TranslationOverrides> {
  if (!isSupabaseConfigured) return {};
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('translations')
      .select('namespace, key, value')
      .eq('locale', locale)
      .limit(2_000);
    if (error || !data) return {};
    const overrides: TranslationOverrides = {};
    for (const row of data) {
      if (typeof row.namespace === 'string' && typeof row.key === 'string' && typeof row.value === 'string') {
        overrides[`${row.namespace}.${row.key}`] = row.value;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

export const getI18n = cache(async () => {
  const locale = await getLocale();
  const overrides = await loadOverrides(locale);
  const bundle = createTranslator(locale, overrides);
  return {
    ...bundle,
    dictionary: bundle.dictionary as Dictionary,
  };
});

export { normalizeLocale };
export type { Locale };
