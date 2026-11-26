'use client';

import { useActionState, useState } from 'react';

import { BellPlus, Loader2, Lock } from 'lucide-react';

import { createAlertAction } from '@/app/actions/alerts';
import { initialActionState } from '@/lib/action-state';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/form';

export interface CreateAlertLabels {
  title: string;
  stock: string;
  type: string;
  condition: string;
  targetPrice: string;
  indicator: string;
  threshold: string;
  notifyEmail: string;
  notifyPush: string;
  submit: string;
  technicalLocked: string;
  types: { price: string; indicator: string; compliance: string };
  operators: { above: string; below: string; crosses_above: string; crosses_below: string };
  indicators: Record<string, string>;
  errors: Record<string, string>;
}

export function CreateAlertForm({
  stocks,
  labels,
  canTechnical,
}: {
  stocks: Array<{ id: string; symbol: string; name: string; price: number | null }>;
  labels: CreateAlertLabels;
  canTechnical: boolean;
}) {
  const [state, formAction, pending] = useActionState(createAlertAction, initialActionState);
  const [alertType, setAlertType] = useState<'price' | 'indicator' | 'compliance'>('price');

  const errorKey =
    state.code === 'alert_limit'
      ? 'limit'
      : state.code === 'demo'
        ? 'demo'
        : state.code === 'compliance_gate'
          ? 'compliance'
          : state.code === 'feature_disabled'
            ? 'feature'
            : 'generic';

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <BellPlus className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-ink-950">{labels.title}</h2>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="stockId">{labels.stock}</Label>
          <Select id="stockId" name="stockId" required>
            {stocks.map((stock) => (
              <option key={stock.id} value={stock.id}>
                {stock.symbol} — {stock.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="alertType">{labels.type}</Label>
          <Select
            id="alertType"
            name="alertType"
            value={alertType}
            onChange={(event) =>
              setAlertType(event.target.value as 'price' | 'indicator' | 'compliance')
            }
          >
            <option value="price">{labels.types.price}</option>
            <option value="indicator" disabled={!canTechnical}>
              {labels.types.indicator}
            </option>
            <option value="compliance">{labels.types.compliance}</option>
          </Select>
          {!canTechnical ? (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
              <Lock className="size-3" aria-hidden />
              {labels.technicalLocked}
            </p>
          ) : null}
        </div>

        {alertType !== 'compliance' ? (
          <div>
            <Label htmlFor="operator">{labels.condition}</Label>
            <Select id="operator" name="operator" defaultValue="above">
              <option value="above">{labels.operators.above}</option>
              <option value="below">{labels.operators.below}</option>
              <option value="crosses_above">{labels.operators.crosses_above}</option>
              <option value="crosses_below">{labels.operators.crosses_below}</option>
            </Select>
          </div>
        ) : (
          <input type="hidden" name="operator" value="above" />
        )}

        {alertType === 'price' ? (
          <div>
            <Label htmlFor="targetPrice">{labels.targetPrice}</Label>
            <Input
              id="targetPrice"
              name="targetPrice"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="250.00"
            />
          </div>
        ) : null}

        {alertType === 'indicator' ? (
          <>
            <div>
              <Label htmlFor="indicator">{labels.indicator}</Label>
              <Select id="indicator" name="indicator" defaultValue="rsi_14">
                <option value="rsi_14">{labels.indicators.rsi_14}</option>
                <option value="sma_20">{labels.indicators.sma_20}</option>
                <option value="sma_50">{labels.indicators.sma_50}</option>
                <option value="sma_200">{labels.indicators.sma_200}</option>
                <option value="macd">{labels.indicators.macd}</option>
                <option value="volume_spike">{labels.indicators.volume_spike}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="threshold">{labels.threshold}</Label>
              <Input
                id="threshold"
                name="threshold"
                type="number"
                step="0.01"
                min="0"
                placeholder="70"
              />
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              name="notifyPush"
              defaultChecked
              className="size-4 rounded border-ink-300 text-brand-700"
            />
            {labels.notifyPush}
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              name="notifyEmail"
              defaultChecked
              className="size-4 rounded border-ink-300 text-brand-700"
            />
            {labels.notifyEmail}
          </label>
        </div>

        {state.message ? (
          <p
            className={`rounded-xl px-3 py-2 text-[11px] font-medium ${
              state.ok ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700'
            }`}
            role="status"
          >
            {state.ok ? labels.errors.created : labels.errors[errorKey] ?? labels.errors.generic}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending || stocks.length === 0}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <BellPlus className="size-4" aria-hidden />
          )}
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
