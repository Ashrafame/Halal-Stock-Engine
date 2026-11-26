'use client';

import { useActionState } from 'react';

import { CreditCard, Loader2, Save } from 'lucide-react';

import { savePlanAction } from '@/app/actions/admin';
import { initialActionState } from '@/lib/action-state';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/form';
import type { PlanRow } from '@/lib/mappers';

export interface PlanFormLabels {
  save: string;
  saved: string;
  error: string;
  demo: string;
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  trial: string;
  active: string;
  sort: string;
  limits: string;
  features: string;
  syncStripe: string;
  stripeMissing: string;
  featuresLabels: Record<string, string>;
  limitsLabels: Record<string, string>;
}

export function PlanForm({ plan, labels }: { plan: PlanRow; labels: PlanFormLabels }) {
  const [state, formAction, pending] = useActionState(savePlanAction, initialActionState);

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-white p-5 sm:p-6">
      <input type="hidden" name="id" value={plan.id} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-ink-950 text-lime">
            <CreditCard className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-950">
              {plan.name}{' '}
              <span className="font-mono text-[10px] text-ink-400">/{plan.id}</span>
            </p>
            <p className="text-[10px] text-ink-400">
              {plan.stripe_product_id ?? labels.stripeMissing}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-ink-500">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={plan.is_active}
              className="size-3.5 rounded border-ink-300 text-brand-700"
            />
            {labels.active}
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              name="syncStripe"
              className="size-3.5 rounded border-ink-300 text-brand-700"
            />
            {labels.syncStripe}
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor={`name-${plan.id}`}>{labels.name}</Label>
          <Input
            id={`name-${plan.id}`}
            name="name"
            defaultValue={plan.name}
            required
            maxLength={60}
          />
        </div>
        <div>
          <Label htmlFor={`tier-${plan.id}`}>Tier</Label>
          <Select id={`tier-${plan.id}`} name="tier" defaultValue={plan.tier}>
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="enterprise">enterprise</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={`sort-${plan.id}`}>{labels.sort}</Label>
          <Input
            id={`sort-${plan.id}`}
            name="sortOrder"
            type="number"
            min="0"
            defaultValue={plan.sort_order}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor={`description-${plan.id}`}>{labels.description}</Label>
          <Textarea
            id={`description-${plan.id}`}
            name="description"
            defaultValue={plan.description}
            rows={2}
            maxLength={300}
          />
        </div>
        <div>
          <Label htmlFor={`monthly-${plan.id}`}>{labels.priceMonthly}</Label>
          <Input
            id={`monthly-${plan.id}`}
            name="priceMonthly"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(plan.price_monthly_cents / 100).toFixed(2)}
          />
        </div>
        <div>
          <Label htmlFor={`yearly-${plan.id}`}>{labels.priceYearly}</Label>
          <Input
            id={`yearly-${plan.id}`}
            name="priceYearly"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(plan.price_yearly_cents / 100).toFixed(2)}
          />
        </div>
        <div>
          <Label htmlFor={`currency-${plan.id}`}>USD</Label>
          <Input
            id={`currency-${plan.id}`}
            name="currency"
            defaultValue={plan.currency}
            maxLength={3}
          />
        </div>
        <div>
          <Label htmlFor={`trial-${plan.id}`}>{labels.trial}</Label>
          <Input
            id={`trial-${plan.id}`}
            name="trialDays"
            type="number"
            min="0"
            max="365"
            defaultValue={plan.trial_days}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            {labels.limits}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(plan.limits).map(([key, value]) => (
              <div key={key}>
                <Label htmlFor={`limits-${plan.id}-${key}`} className="text-[9px]">
                  {labels.limitsLabels[key] ?? key}
                </Label>
                <Input
                  id={`limits-${plan.id}-${key}`}
                  name={`limits.${key}`}
                  type="number"
                  defaultValue={value}
                  className="h-9 text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            {labels.features}
          </p>
          <div className="grid gap-1.5">
            {Object.entries(plan.features).map(([key, value]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-xl border border-ink-100 px-2.5 py-1.5 text-[10px] text-ink-600"
              >
                {labels.featuresLabels[key] ?? key}
                <input
                  type="checkbox"
                  name={`features.${key}`}
                  defaultChecked={Boolean(value)}
                  className="size-3.5 rounded border-ink-300 text-brand-700"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[9px] text-ink-400">
          Stripe: {plan.stripe_price_monthly_id ?? '—'} · {plan.stripe_price_yearly_id ?? '—'}
        </p>
        <div className="flex items-center gap-3">
          {state.message ? (
            <span
              role="status"
              className={`text-[10px] font-medium ${state.ok ? 'text-brand-700' : 'text-red-600'}`}
            >
              {state.ok
                ? labels.saved
                : state.code === 'demo'
                  ? labels.demo
                  : state.code === 'stripe_not_configured'
                    ? labels.stripeMissing
                    : labels.error}
            </span>
          ) : null}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="size-3.5" aria-hidden />
            )}
            {labels.save}
          </Button>
        </div>
      </div>
    </form>
  );
}
