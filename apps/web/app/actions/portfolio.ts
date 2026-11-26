'use server';

import { revalidatePath } from 'next/cache';

import { fieldErrors, holdingInputSchema, portfolioInputSchema } from '@hse/shared';

import { actionError, actionOk, mapDbError, type ActionState } from '@/lib/action-state';
import { requireSession } from '@/lib/auth';
import { isDemoMode } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEMO_MESSAGE = 'Demo mode is read-only. Connect Supabase to manage a portfolio.';

export async function addHoldingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (isDemoMode) return actionError('demo', DEMO_MESSAGE);

  const parsed = holdingInputSchema.safeParse({
    portfolioId: formData.get('portfolioId'),
    stockId: formData.get('stockId'),
    shares: Number(formData.get('shares')),
    averageCost: Number(formData.get('averageCost')),
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('holdings').insert({
    portfolio_id: parsed.data.portfolioId,
    stock_id: parsed.data.stockId,
    shares: parsed.data.shares,
    average_cost: parsed.data.averageCost,
  });

  if (error) {
    if (error.code === '23505') {
      return actionError('exists', 'That stock is already in this portfolio.');
    }
    const mapped = mapDbError(error.message);
    return actionError(mapped.code, mapped.message);
  }

  revalidatePath('/dashboard/portfolio');
  revalidatePath('/dashboard');
  return actionOk('Holding added.');
}

export async function createPortfolioAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (isDemoMode) return actionError('demo', DEMO_MESSAGE);

  const parsed = portfolioInputSchema.safeParse({
    name: formData.get('name'),
    baseCurrency: formData.get('baseCurrency') || 'USD',
    isSimulated: true,
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('portfolios').insert({
    user_id: session.userId,
    name: parsed.data.name,
    base_currency: parsed.data.baseCurrency,
    is_simulated: true,
  });

  if (error) {
    if (error.code === '23505') {
      return actionError('exists', 'You already have a portfolio with that name.');
    }
    const mapped = mapDbError(error.message);
    return actionError(mapped.code, mapped.message);
  }

  revalidatePath('/dashboard/portfolio');
  return actionOk('Portfolio created.');
}
