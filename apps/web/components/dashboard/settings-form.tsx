'use client';

import { useActionState } from 'react';

import { Loader2, Save } from 'lucide-react';

import { updateProfileAction } from '@/app/actions/settings';
import { initialActionState } from '@/lib/action-state';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/form';
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@hse/shared';

export interface SettingsLabels {
  profile: string;
  fullName: string;
  email: string;
  language: string;
  timezone: string;
  notifications: string;
  push: string;
  emailAlerts: string;
  save: string;
  saved: string;
  demo: string;
  error: string;
}

const TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Karachi',
  'Asia/Kuala_Lumpur',
  'Asia/Jakarta',
  'Africa/Cairo',
  'Australia/Sydney',
];

export function SettingsForm({
  profile,
  labels,
}: {
  profile: {
    fullName: string | null;
    email: string | null;
    locale: Locale;
    timezone: string;
    notifyEmail: boolean;
    notifyPush: boolean;
  };
  labels: SettingsLabels;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialActionState);

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-white p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-ink-950">{labels.profile}</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fullName">{labels.fullName}</Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={profile.fullName ?? ''}
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div>
          <Label htmlFor="email">{labels.email}</Label>
          <Input id="email" value={profile.email ?? ''} disabled readOnly />
        </div>
        <div>
          <Label htmlFor="locale">{labels.language}</Label>
          <Select id="locale" name="locale" defaultValue={profile.locale}>
            {SUPPORTED_LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_META[code].nativeName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="timezone">{labels.timezone}</Label>
          <Select id="timezone" name="timezone" defaultValue={profile.timezone}>
            {Array.from(new Set([profile.timezone, ...TIMEZONES])).map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {labels.notifications}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-ink-200 px-4 py-3">
          <span className="text-sm text-ink-700">{labels.push}</span>
          <input
            type="checkbox"
            name="notifyPush"
            defaultChecked={profile.notifyPush}
            className="size-4 rounded border-ink-300 text-brand-700"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-ink-200 px-4 py-3">
          <span className="text-sm text-ink-700">{labels.emailAlerts}</span>
          <input
            type="checkbox"
            name="notifyEmail"
            defaultChecked={profile.notifyEmail}
            className="size-4 rounded border-ink-300 text-brand-700"
          />
        </label>
      </div>

      {state.message ? (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-xs font-medium ${
            state.ok ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700'
          }`}
          role="status"
        >
          {state.ok ? labels.saved : state.code === 'demo' ? labels.demo : labels.error}
        </p>
      ) : null}

      <Button type="submit" className="mt-5" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {labels.save}
      </Button>
    </form>
  );
}
