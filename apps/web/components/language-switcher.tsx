'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ChangeEvent } from 'react';

import { LOCALE_META, SUPPORTED_LOCALES } from '@hse/shared';

export function LanguageSwitcher({
  locale,
  label,
  inverted = false,
}: {
  locale: string;
  label: string;
  inverted?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    document.cookie = `hse-locale=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <span aria-hidden className="text-xs">
        {inverted ? '🌐' : '🌐'}
      </span>
      <select
        value={locale}
        onChange={handleChange}
        disabled={pending}
        aria-label={label}
        className={
          inverted
            ? 'rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-sand-100 outline-none backdrop-blur-sm'
            : 'rounded-full border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 outline-none'
        }
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
