'use client';

import { useActionState } from 'react';

import { Languages, Loader2, Megaphone, Save, Variable } from 'lucide-react';

import {
  broadcastAction,
  saveTranslationAction,
  saveVariableAction,
} from '@/app/actions/admin';
import { initialActionState } from '@/lib/action-state';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/form';
import { LOCALE_META, SUPPORTED_LOCALES } from '@hse/shared';

interface CommonLabels {
  saved: string;
  error: string;
  demo: string;
}

function StateMessage({
  state,
  labels,
}: {
  state: { ok: boolean; code?: string; message?: string };
  labels: CommonLabels;
}) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`text-[10px] font-medium ${state.ok ? 'text-brand-700' : 'text-red-600'}`}
    >
      {state.ok ? labels.saved : state.code === 'demo' ? labels.demo : labels.error}
    </p>
  );
}

export function TranslationForm({
  dictionaryKeys,
  labels,
}: {
  dictionaryKeys: Array<{ key: string; value: string }>;
  labels: CommonLabels & {
    title: string;
    locale: string;
    namespace: string;
    key: string;
    value: string;
    publish: string;
  };
}) {
  const [state, formAction, pending] = useActionState(saveTranslationAction, initialActionState);

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-white p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
        <Languages className="size-4 text-brand-700" aria-hidden />
        {labels.title}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="translation-locale">{labels.locale}</Label>
          <Select id="translation-locale" name="locale" defaultValue="ar">
            {SUPPORTED_LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_META[code].nativeName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="translation-namespace">{labels.namespace}</Label>
          <Input id="translation-namespace" name="namespace" defaultValue="landing" required />
        </div>
        <div>
          <Label htmlFor="translation-key">{labels.key}</Label>
          <Input
            id="translation-key"
            name="key"
            list="translation-keys"
            placeholder="heroTitle"
            required
          />
          <datalist id="translation-keys">
            {dictionaryKeys.slice(0, 500).map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.value.slice(0, 60)}
              </option>
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="translation-value">{labels.value}</Label>
          <Textarea id="translation-value" name="value" rows={3} required />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <StateMessage state={state} labels={labels} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
          {labels.publish}
        </Button>
      </div>
    </form>
  );
}

export function VariableForm({
  labels,
}: {
  labels: CommonLabels & {
    title: string;
    key: string;
    value: string;
    description: string;
    category: string;
    publicVar: string;
    publish: string;
  };
}) {
  const [state, formAction, pending] = useActionState(saveVariableAction, initialActionState);

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-white p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
        <Variable className="size-4 text-brand-700" aria-hidden />
        {labels.title}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="variable-key">{labels.key}</Label>
          <Input id="variable-key" name="key" placeholder="FEATURE_FLAG" required />
        </div>
        <div>
          <Label htmlFor="variable-category">{labels.category}</Label>
          <Input id="variable-category" name="category" defaultValue="general" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="variable-value">{labels.value} (JSON)</Label>
          <Textarea id="variable-value" name="value" rows={2} defaultValue="true" required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="variable-description">{labels.description}</Label>
          <Input id="variable-description" name="description" maxLength={500} />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-ink-600 sm:col-span-2">
          <input
            type="checkbox"
            name="isPublic"
            className="size-3.5 rounded border-ink-300 text-brand-700"
          />
          {labels.publicVar}
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <StateMessage state={state} labels={labels} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
          {labels.publish}
        </Button>
      </div>
    </form>
  );
}

export function BroadcastForm({
  labels,
}: {
  labels: CommonLabels & {
    title: string;
    titleLabel: string;
    bodyLabel: string;
    audience: string;
    allOption: string;
    send: string;
  };
}) {
  const [state, formAction, pending] = useActionState(broadcastAction, initialActionState);

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-ink-950 p-5 text-sand-50">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Megaphone className="size-4 text-lime" aria-hidden />
        {labels.title}
      </h2>
      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="broadcast-title" className="text-sand-100/50">
            {labels.titleLabel}
          </Label>
          <Input id="broadcast-title" name="title" required maxLength={120} placeholder="settings.billing" />
        </div>
        <div>
          <Label htmlFor="broadcast-body" className="text-sand-100/50">
            {labels.bodyLabel}
          </Label>
          <Textarea id="broadcast-body" name="body" rows={2} required maxLength={1000} />
        </div>
        <div>
          <Label htmlFor="broadcast-audience" className="text-sand-100/50">
            {labels.audience}
          </Label>
          <Select id="broadcast-audience" name="audience" defaultValue="all">
            <option value="all">{labels.allOption}</option>
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="enterprise">enterprise</option>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <StateMessage state={state} labels={labels} />
          <Button type="submit" variant="lime" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Megaphone className="size-3.5" aria-hidden />}
            {labels.send}
          </Button>
        </div>
      </div>
    </form>
  );
}
