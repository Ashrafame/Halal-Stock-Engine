import { describe, expect, it } from 'vitest';

import {
  cn,
  formatCents,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
  initials,
  slugify,
  truncate,
} from '../src/utils/format';

const NOW = new Date('2026-11-25T12:00:00.000Z');

describe('formatting utilities', () => {
  it('formats currency per locale', () => {
    expect(formatCurrency(1234.5, 'USD', 'en')).toBe('$1,234.50');
    expect(formatCurrency(0, 'USD', 'es')).toContain('0,00');
    const arabic = formatCurrency(1234.5, 'USD', 'ar');
    expect(arabic).toContain('1,234.50');
  });

  it('formats integer minor units without float drift', () => {
    expect(formatCents(1200, 'USD', 'en')).toBe('$12');
    expect(formatCents(11500, 'USD', 'en')).toBe('$115');
    expect(formatCents(-100, 'USD', 'en')).toContain('1');
  });

  it('formats percentages and signed changes', () => {
    expect(formatPercent(0.1234, 'en')).toBe('12.34%');
    expect(formatPercent(0.1234, 'en', 1)).toBe('12.3%');
    expect(formatSignedPercent(0.05, 'en', 1)).toContain('+');
    expect(formatSignedPercent(-0.05, 'en', 1)).toContain('−');
    expect(formatSignedPercent(0, 'en', 1)).toBe('0.0%');
  });

  it('formats compact numbers', () => {
    expect(formatCompactNumber(1_500_000, 'en')).toMatch(/1\.5M/i);
    expect(formatCompactNumber(Number.NaN, 'en')).toBe('0');
  });

  it('formats dates defensively', () => {
    expect(formatDate('2026-11-25T00:00:00.000Z', 'en')).toContain('2026');
    expect(formatDate(null, 'en')).toBe('—');
    expect(formatDate('not-a-date', 'en')).toBe('—');
  });

  it('formats relative time', () => {
    expect(formatRelativeTime('2026-11-24T12:00:00.000Z', 'en', NOW)).toContain('yesterday');
    expect(formatRelativeTime('2026-11-25T11:58:00.000Z', 'en', NOW)).toContain('2');
  });

  it('truncates long strings with an ellipsis', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('this is a very long sentence', 10)).toBe('this is a…');
  });

  it('slugifies names for URLs and plan ids', () => {
    expect(slugify('Halal Stock Engine')).toBe('halal-stock-engine');
    expect(slugify('  Español & Français  ')).toBe('espanol-francais');
    expect(slugify('***')).toBe('');
  });

  it('derives initials for avatars', () => {
    expect(initials('Amina Rahman')).toBe('AR');
    expect(initials(null, 'investor@example.com')).toBe('IN');
    expect(initials('Cher')).toBe('CH');
    expect(initials('')).toBe('?');
  });

  it('joins class names', () => {
    expect(cn('a', false, null, 'b', undefined)).toBe('a b');
  });
});
