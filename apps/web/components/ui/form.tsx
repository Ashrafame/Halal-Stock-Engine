import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@hse/shared';

const fieldStyles =
  'h-11 w-full rounded-2xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15 disabled:bg-ink-50';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldStyles, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(fieldStyles, 'pe-9', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(fieldStyles, 'h-auto min-h-24 py-3 leading-relaxed', className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500', className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-ink-400">{hint}</p> : null}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  name,
  label,
}: {
  checked: boolean;
  onChange?: (value: boolean) => void;
  name: string;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-ink-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-ink-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/30">
        <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}
