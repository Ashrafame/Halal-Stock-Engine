'use client';

import { useActionState } from 'react';

import { Loader2, Plus } from 'lucide-react';

import { addHoldingAction, createPortfolioAction } from '@/app/actions/portfolio';
import { initialActionState } from '@/lib/action-state';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/form';

export interface PortfolioFormLabels {
  addTitle: string;
  createTitle: string;
  portfolio: string;
  stock: string;
  shares: string;
  averageCost: string;
  name: string;
  currency: string;
  submitAdd: string;
  submitCreate: string;
  errors: Record<string, string>;
}

function resolve(code: string | undefined, labels: PortfolioFormLabels): string {
  switch (code) {
    case 'demo':
      return labels.errors.demo ?? '';
    case 'exists':
      return labels.errors.exists ?? '';
    case 'holding_limit':
      return labels.errors.limit ?? '';
    case 'portfolio_limit':
      return labels.errors.limit ?? '';
    case 'validation':
      return labels.errors.validation ?? '';
    default:
      return labels.errors.generic ?? '';
  }
}

export function AddHoldingForm({
  portfolios,
  stocks,
  labels,
}: {
  portfolios: Array<{ id: string; name: string }>;
  stocks: Array<{ id: string; symbol: string; name: string; price: number | null }>;
  labels: PortfolioFormLabels;
}) {
  const [state, formAction, pending] = useActionState(addHoldingAction, initialActionState);

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink-950">{labels.addTitle}</h2>
      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="portfolioId">{labels.portfolio}</Label>
          <Select id="portfolioId" name="portfolioId" required>
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </option>
            ))}
          </Select>
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="shares">{labels.shares}</Label>
            <Input id="shares" name="shares" type="number" step="0.0001" min="0.0001" required />
          </div>
          <div>
            <Label htmlFor="averageCost">{labels.averageCost}</Label>
            <Input
              id="averageCost"
              name="averageCost"
              type="number"
              step="0.01"
              min="0"
              required
            />
          </div>
        </div>

        {state.message ? (
          <p
            className={`rounded-xl px-3 py-2 text-[11px] font-medium ${
              state.ok ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700'
            }`}
            role="status"
          >
            {state.ok ? labels.errors.created : resolve(state.code, labels)}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {labels.submitAdd}
        </Button>
      </div>
    </form>
  );
}

export function CreatePortfolioForm({
  labels,
}: {
  labels: PortfolioFormLabels;
}) {
  const [state, formAction, pending] = useActionState(createPortfolioAction, initialActionState);

  return (
    <form action={formAction} className="rounded-3xl border border-ink-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink-950">{labels.createTitle}</h2>
      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="name">{labels.name}</Label>
          <Input id="name" name="name" required maxLength={60} placeholder="Long-term halal" />
        </div>
        <div>
          <Label htmlFor="baseCurrency">{labels.currency}</Label>
          <Select id="baseCurrency" name="baseCurrency" defaultValue="USD">
            {['USD', 'GBP', 'EUR', 'SAR', 'AED'].map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </div>

        {state.message ? (
          <p
            className={`rounded-xl px-3 py-2 text-[11px] font-medium ${
              state.ok ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700'
            }`}
            role="status"
          >
            {state.ok ? labels.errors.created : resolve(state.code, labels)}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {labels.submitCreate}
        </Button>
      </div>
    </form>
  );
}
