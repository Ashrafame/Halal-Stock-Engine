import { describe, expect, it } from 'vitest';

import { DEMO_STOCKS } from '../src/demo/data';
import {
  DICTIONARIES,
  LOCALE_META,
  SUPPORTED_LOCALES,
  createTranslator,
  dictionaryKeyParity,
  flattenDictionary,
  getDirection,
  isLocale,
  isRtl,
  localizedStockName,
  normalizeLocale,
  translate,
} from '../src/i18n';

describe('localization', () => {
  it('supports exactly English, Arabic and Spanish', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'ar', 'es']);
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });

  it('declares RTL only for Arabic', () => {
    expect(getDirection('ar')).toBe('rtl');
    expect(isRtl('ar')).toBe(true);
    expect(getDirection('en')).toBe('ltr');
    expect(getDirection('es')).toBe('ltr');
    expect(LOCALE_META.ar.dir).toBe('rtl');
  });

  it('normalizes regional and case variants', () => {
    expect(normalizeLocale('ar-SA')).toBe('ar');
    expect(normalizeLocale('es_MX')).toBe('es');
    expect(normalizeLocale('EN')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBe('en');
    expect(normalizeLocale(null, 'es')).toBe('es');
  });

  it('has complete key parity across all locales', () => {
    const english = flattenDictionary(DICTIONARIES.en);
    expect(english.length).toBeGreaterThan(200);

    for (const locale of ['ar', 'es'] as const) {
      const parity = dictionaryKeyParity(DICTIONARIES.en, DICTIONARIES[locale]);
      expect(parity.missingInB, `${locale} missing keys`).toEqual([]);
      expect(parity.missingInA, `${locale} extra keys`).toEqual([]);
    }
  });

  it('does not leave English placeholders in Arabic translations', () => {
    expect(DICTIONARIES.ar.landing.heroTitle).toMatch(/[\u0600-\u06FF]/);
    expect(DICTIONARIES.ar.alerts.title).not.toBe(DICTIONARIES.en.alerts.title);
    expect(DICTIONARIES.es.landing.heroTitle).toMatch(/acciones/);
  });

  it('interpolates named parameters and leaves unknown tokens intact', () => {
    const t = createTranslator('en').t;
    expect(
      t('alerts.limitReached', { limit: 3 }),
    ).toBe('Your plan allows 3 active alerts. Upgrade for more.');
    expect(t('common.missing_key')).toBe('common.missing_key');
  });

  it('applies CMS overrides over bundled strings', () => {
    const t = createTranslator('en', {
      'landing.ctaPrimary': 'Join free today',
    }).t;
    expect(t('landing.ctaPrimary')).toBe('Join free today');
  });

  it('falls back to English for keys absent from a locale', () => {
    expect(translate('ar', 'common.actions')).toBeDefined();
    expect(translate('ar', 'common.actions')).not.toBe('common.actions');
  });

  it('returns a direction bundle for layout', () => {
    expect(createTranslator('ar').dir).toBe('rtl');
    expect(createTranslator('es').dir).toBe('ltr');
  });

  it('localizes stock names with fallback', () => {
    const apple = DEMO_STOCKS[0]!;
    expect(localizedStockName(apple, 'ar')).toBe('شركة أبل');
    expect(localizedStockName(apple, 'es')).toBe('Apple Inc.');
    expect(localizedStockName({ name: 'Only English' }, 'ar')).toBe('Only English');
  });

  it('flattens nested dictionaries into namespaced keys', () => {
    const keys = flattenDictionary(DICTIONARIES.en).map((entry) => entry.key);
    expect(keys).toContain('landing.heroTitle');
    expect(keys).toContain('admin.plans.syncStripe');
    expect(new Set(keys).size).toBe(keys.length);
  });
});
