import type { Locale } from '../types';

/** Explicit BCP-47 tags. Arabic keeps Latin digits for financial readability. */
export const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  ar: 'ar-SA-u-nu-latn',
  es: 'es-ES',
};

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: Locale,
  options: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {},
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(safeAmount);
}

/** Plans are stored in integer minor units to avoid floating-point drift. */
export function formatCents(
  cents: number,
  currency: string,
  locale: Locale,
  options: { maximumFractionDigits?: number } = {},
): string {
  return formatCurrency((Number.isFinite(cents) ? cents : 0) / 100, currency, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });
}

export function formatPercent(
  ratio: number,
  locale: Locale,
  fractionDigits = 2,
): string {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);
}

export function formatSignedPercent(
  ratio: number,
  locale: Locale,
  fractionDigits = 2,
): string {
  const formatted = formatPercent(Math.abs(ratio), locale, fractionDigits);
  if (!Number.isFinite(ratio) || ratio === 0) return formatted;
  return `${ratio > 0 ? '+' : '−'}${formatted}`;
}

export function formatCompactNumber(value: number, locale: Locale): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(safe);
}

export function formatCompactCurrency(
  amount: number,
  currency: string,
  locale: Locale,
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', {
    style: 'currency',
    currency: currency || 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(safe);
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(INTL_LOCALES[locale] ?? 'en-US', options).format(date);
}

export function formatRelativeTime(
  value: string | Date,
  locale: Locale,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALES[locale] ?? 'en-US', {
    numeric: 'auto',
  });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return formatter.format(seconds, 'second');
}

export function truncate(value: string, length = 120): string {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? email ?? '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  return `${(parts[0] as string).charAt(0)}${(parts[parts.length - 1] as string).charAt(0)}`.toUpperCase();
}
