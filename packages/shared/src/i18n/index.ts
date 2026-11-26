import type { Locale } from '../types';
import ar from './locales/ar';
import en from './locales/en';
import es from './locales/es';
import type { Dictionary } from './types';

export type { Dictionary };
export { en, ar, es };

export const SUPPORTED_LOCALES = ['en', 'ar', 'es'] as const;
export const DEFAULT_LOCALE: Locale = 'en';
export const RTL_LOCALES: readonly Locale[] = ['ar'];

export interface LocaleMeta {
  code: Locale;
  /** Name in the language itself, for the switcher. */
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  intlTag: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', intlTag: 'en-US' },
  ar: { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', intlTag: 'ar-SA' },
  es: { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', intlTag: 'es-ES' },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ar, es };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Accepts `ar-SA`, `es_MX`, `EN` and returns a supported base locale. */
export function normalizeLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : fallback;
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

export function isRtl(locale: Locale): boolean {
  return getDirection(locale) === 'rtl';
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** Dot-path lookup; returns undefined instead of throwing on a bad key. */
export function lookup(dictionary: Dictionary, key: string): string | undefined {
  const segments = key.split('.');
  let current: unknown = dictionary;
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

export function interpolate(
  template: string,
  params: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

export type TranslationOverrides = Record<string, string>;

export type Translator = (key: string, params?: Record<string, string | number>) => string;

export interface TranslatorBundle {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Translator;
  dictionary: Dictionary;
}

/**
 * Builds a translator with optional CMS overrides (from the `translations`
 * table, flattened to `namespace.key`). Falls back to English, then the key.
 */
export function createTranslator(
  locale: Locale,
  overrides: TranslationOverrides = {},
): TranslatorBundle {
  const dictionary = getDictionary(locale);
  const fallback = DICTIONARIES[DEFAULT_LOCALE];

  const t: Translator = (key, params) => {
    const template = overrides[key] ?? lookup(dictionary, key) ?? lookup(fallback, key);
    if (template === undefined) {
      if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
        console.warn(`[i18n] Missing translation: ${locale}:${key}`);
      }
      return key;
    }
    return interpolate(template, params);
  };

  return { locale, dir: getDirection(locale), t, dictionary };
}

/** Convenience for one-off server-side translations. */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
  overrides?: TranslationOverrides,
): string {
  return createTranslator(locale, overrides).t(key, params);
}

/** Localized company name with graceful fallback to the primary name. */
export function localizedStockName(
  stock: { name: string; nameAr?: string | null; nameEs?: string | null },
  locale: Locale,
): string {
  if (locale === 'ar' && stock.nameAr) return stock.nameAr;
  if (locale === 'es' && stock.nameEs) return stock.nameEs;
  return stock.name;
}

function flattenInto(
  value: Record<string, unknown>,
  prefix: string,
  output: Array<{ key: string; value: string }>,
): void {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') {
      output.push({ key: path, value: entry });
    } else if (entry && typeof entry === 'object') {
      flattenInto(entry as Record<string, unknown>, path, output);
    }
  }
}

/** Flattens a nested dictionary into `a.b.c` keys (used to seed the CMS). */
export function flattenDictionary(
  dictionary: Dictionary,
  prefix = '',
): Array<{ key: string; value: string }> {
  const output: Array<{ key: string; value: string }> = [];
  flattenInto(dictionary as unknown as Record<string, unknown>, prefix, output);
  return output;
}

/** Structural equality check used by tests and the admin CMS. */
export function dictionaryKeyParity(
  a: Dictionary,
  b: Dictionary,
): { missingInB: string[]; missingInA: string[] } {
  const keysA = new Set(flattenDictionary(a).map((entry) => entry.key));
  const keysB = new Set(flattenDictionary(b).map((entry) => entry.key));
  return {
    missingInB: [...keysA].filter((key) => !keysB.has(key)).sort(),
    missingInA: [...keysB].filter((key) => !keysA.has(key)).sort(),
  };
}
