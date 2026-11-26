'use server';

import { revalidatePath } from 'next/cache';

import {
  alertInputSchema,
  defaultAlertForStock,
  fieldErrors,
  oneClickAlertSchema,
} from '@hse/shared';

import { actionError, actionOk, mapDbError, type ActionState } from '@/lib/action-state';
import { requireSession } from '@/lib/auth';
import { isDemoMode } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEMO_MESSAGE = 'Demo mode is read-only. Connect Supabase to create alerts.';

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function createOneClickAlert(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (isDemoMode) return actionError('demo', DEMO_MESSAGE);

  const parsed = oneClickAlertSchema.safeParse({
    stockId: formData.get('stockId'),
    targetPrice: numberOrUndefined(formData.get('targetPrice')),
    operator: formData.get('operator') || 'above',
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  const supabase = await createSupabaseServerClient();

  const { data: stock, error: stockError } = await supabase
    .from('v_stock_overview')
    .select('id, symbol, compliance_status, price')
    .eq('id', parsed.data.stockId)
    .maybeSingle();

  if (stockError) return actionError('error', 'Could not load that stock.');
  if (!stock) return actionError('not_found', 'Stock not found.');
  if (stock.compliance_status !== 'halal') {
    return actionError('compliance_gate', 'Only halal stocks can receive price alerts.');
  }

  const price = typeof stock.price === 'number' ? stock.price : 0;
  const targetPrice = parsed.data.targetPrice ?? defaultAlertForStock(price).targetPrice;
  if (!(targetPrice > 0)) return actionError('invalid_price', 'Set a valid target price.');

  const { count } = await supabase
    .from('price_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('stock_id', parsed.data.stockId)
    .eq('status', 'active');

  if ((count ?? 0) > 0) {
    return actionError('exists', 'You already have an active alert for this stock.');
  }

  const { error } = await supabase.from('price_alerts').insert({
    user_id: session.userId,
    stock_id: parsed.data.stockId,
    alert_type: 'price',
    operator: parsed.data.operator,
    target_price: targetPrice,
    cooldown_minutes: 30,
  });

  if (error) {
    const mapped = mapDbError(error.message);
    return actionError(mapped.code, mapped.message);
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/alerts');
  return actionOk(`Alert created at ${targetPrice.toFixed(2)}.`);
}

export async function createAlertAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (isDemoMode) return actionError('demo', DEMO_MESSAGE);

  const parsed = alertInputSchema.safeParse({
    stockId: formData.get('stockId'),
    alertType: formData.get('alertType') || 'price',
    operator: formData.get('operator') || 'above',
    targetPrice: numberOrUndefined(formData.get('targetPrice')),
    indicator: formData.get('indicator') || undefined,
    threshold: numberOrUndefined(formData.get('threshold')),
    cooldownMinutes: numberOrUndefined(formData.get('cooldownMinutes')),
    notifyEmail: formData.get('notifyEmail') === 'on',
    notifyPush: formData.get('notifyPush') === 'on',
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('price_alerts').insert({
    user_id: session.userId,
    stock_id: parsed.data.stockId,
    alert_type: parsed.data.alertType,
    operator: parsed.data.operator,
    target_price: parsed.data.targetPrice ?? null,
    indicator: parsed.data.indicator ?? null,
    threshold: parsed.data.threshold ?? null,
    cooldown_minutes: parsed.data.cooldownMinutes ?? 30,
    notify_email: parsed.data.notifyEmail,
    notify_push: parsed.data.notifyPush,
    expires_at: parsed.data.expiresAt ?? null,
  });

  if (error) {
    const mapped = mapDbError(error.message);
    return actionError(mapped.code, mapped.message);
  }

  revalidatePath('/dashboard/alerts');
  return actionOk('Alert created.');
}

export async function toggleAlertAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (isDemoMode) return;

  const id = String(formData.get('id') ?? '');
  const next = formData.get('next') === 'active' ? 'active' : 'paused';
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from('price_alerts')
    .update({ status: next })
    .eq('id', id)
    .eq('user_id', session.userId);

  revalidatePath('/dashboard/alerts');
  revalidatePath('/dashboard');
}

export async function deleteAlertAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (isDemoMode) return;

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from('price_alerts').delete().eq('id', id).eq('user_id', session.userId);

  revalidatePath('/dashboard/alerts');
  revalidatePath('/dashboard');
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await requireSession();
  if (isDemoMode) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', session.userId)
    .is('read_at', null);

  revalidatePath('/dashboard');
}
