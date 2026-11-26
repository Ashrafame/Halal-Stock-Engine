import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';

import {
  createTranslator,
  getDirection,
  getDictionary,
  normalizeLocale,
  type Locale,
  type Translator,
} from '@hse/shared';

import { LOCALE_STORAGE_KEY } from './supabase';

interface I18nContextValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  t: Translator;
  setLocale: (locale: Locale) => Promise<void>;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function deviceLocale(): Locale {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return normalizeLocale(code, 'en');
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (mounted && stored) setLocaleState(normalizeLocale(stored, deviceLocale()));
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, next);
    // Native RTL is applied by the platform on the next reload; our own styles
    // already react to `dir` immediately.
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(next === 'ar');
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const bundle = createTranslator(locale);
    return {
      locale,
      dir: getDirection(locale),
      isRtl: getDirection(locale) === 'rtl',
      t: bundle.t,
      setLocale,
      ready,
    };
  }, [locale, setLocale, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}

/** Mirrors dictionaries for offline checks and the language picker. */
export const DICTIONARY = getDictionary('en');

export function localeName(locale: Locale): string {
  return { en: 'English', ar: 'العربية', es: 'Español' }[locale];
}
