'use server';

import { revalidatePath } from 'next/cache';

import {
  adminPlanSchema,
  adminUserUpdateSchema,
  broadcastNotificationSchema,
  fieldErrors,
  stockComplianceOverrideSchema,
  systemVariableSchema,
  translationUpsertSchema,
} from '@hse/shared';

import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { callAdminApi } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/env';

const DEMO_MESSAGE = 'Demo mode is read-only. Connect Supabase and deploy the admin function.';

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function runAdminAction(
  body: Record<string, unknown>,
  successMessage: string,
): Promise<ActionState> {
  const session = await requireAdmin();
  if (isDemoMode) return actionError('demo', DEMO_MESSAGE);
  if (!session.accessToken) return actionError('unauthorized', 'Please sign in again.');

  try {
    await callAdminApi(session.accessToken, { body });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'admin_api_failed';
    return actionError(code, 'The admin service rejected this change.');
  }

  revalidatePath('/admin');
  revalidatePath('/admin/users');
  revalidatePath('/admin/plans');
  revalidatePath('/admin/compliance');
  revalidatePath('/admin/cms');
  revalidatePath('/admin/logs');
  return actionOk(successMessage);
}

export async function updateUserAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = adminUserUpdateSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role') || undefined,
    status: formData.get('status') || undefined,
    locale: formData.get('locale') || undefined,
    planId: formData.get('planId') || undefined,
    suspendReason: formData.get('suspendReason') || undefined,
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  return runAdminAction(
    {
      action: 'update_user',
      userId: parsed.data.userId,
      role: parsed.data.role,
      status: parsed.data.status,
      locale: parsed.data.locale,
      planId: parsed.data.planId,
      suspendReason: parsed.data.suspendReason,
    },
    'User updated.',
  );
}

export async function savePlanAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const features = {
    realtimeQuotes: formData.get('features.realtimeQuotes') === 'on',
    technicalAlerts: formData.get('features.technicalAlerts') === 'on',
    emailAlerts: formData.get('features.emailAlerts') === 'on',
    pushAlerts: formData.get('features.pushAlerts') === 'on',
    portfolioTracking: formData.get('features.portfolioTracking') === 'on',
    complianceReports: formData.get('features.complianceReports') === 'on',
    exportData: formData.get('features.exportData') === 'on',
    prioritySupport: formData.get('features.prioritySupport') === 'on',
  };

  const parsed = adminPlanSchema.safeParse({
    id: formData.get('id'),
    tier: formData.get('tier') || 'free',
    name: formData.get('name'),
    description: formData.get('description'),
    priceMonthlyCents: Math.round(Number(formData.get('priceMonthly')) * 100),
    priceYearlyCents: Math.round(Number(formData.get('priceYearly')) * 100),
    currency: formData.get('currency') || 'USD',
    trialDays: Number(formData.get('trialDays')),
    limits: {
      maxAlerts: Number(formData.get('limits.maxAlerts')),
      maxWatchlistItems: Number(formData.get('limits.maxWatchlistItems')),
      maxPortfolios: Number(formData.get('limits.maxPortfolios')),
      maxHoldingsPerPortfolio: Number(formData.get('limits.maxHoldingsPerPortfolio')),
      apiRequestsPerDay: Number(formData.get('limits.apiRequestsPerDay')),
      alertCooldownMinutes: Number(formData.get('limits.alertCooldownMinutes')),
    },
    features,
    isActive: formData.get('isActive') === 'on',
    sortOrder: Number(formData.get('sortOrder')),
    syncStripe: formData.get('syncStripe') === 'on',
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  return runAdminAction({ action: 'save_plan', plan: parsed.data }, 'Plan saved.');
}

export async function overrideComplianceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawExpiry = formData.get('expiresAt');
  const expiresAt =
    typeof rawExpiry === 'string' && rawExpiry
      ? new Date(`${rawExpiry}T23:59:59.000Z`).toISOString()
      : undefined;

  const parsed = stockComplianceOverrideSchema.safeParse({
    stockId: formData.get('stockId'),
    status: formData.get('status'),
    score: numberOrUndefined(formData.get('score')),
    reason: formData.get('reason'),
    expiresAt,
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }

  return runAdminAction({ action: 'set_stock_override', ...parsed.data }, 'Compliance updated.');
}

export async function clearComplianceOverrideAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (isDemoMode || !session.accessToken) return;
  const stockId = String(formData.get('stockId') ?? '');
  if (!stockId) return;
  await callAdminApi(session.accessToken, {
    body: { action: 'clear_stock_override', stockId },
  });
  revalidatePath('/admin/compliance');
}

export async function saveTranslationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = translationUpsertSchema.safeParse({
    locale: formData.get('locale'),
    namespace: formData.get('namespace'),
    key: formData.get('key'),
    value: formData.get('value'),
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }
  return runAdminAction(
    { action: 'upsert_translation', ...parsed.data },
    'Translation published.',
  );
}

export async function saveVariableAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = String(formData.get('value') ?? '');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = raw;
  }

  const parsed = systemVariableSchema.safeParse({
    key: formData.get('key'),
    value,
    description: formData.get('description') || '',
    category: formData.get('category') || 'general',
    isPublic: formData.get('isPublic') === 'on',
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }
  return runAdminAction({ action: 'upsert_variable', ...parsed.data }, 'Variable saved.');
}

export async function deleteVariableAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (isDemoMode || !session.accessToken) return;
  const key = String(formData.get('key') ?? '');
  if (!key) return;
  await callAdminApi(session.accessToken, {
    body: { action: 'delete_variable', key },
  });
  revalidatePath('/admin/cms');
}

export async function broadcastAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = broadcastNotificationSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    audience: formData.get('audience') || 'all',
  });
  if (!parsed.success) {
    return actionError('validation', Object.values(fieldErrors(parsed.error))[0]);
  }
  return runAdminAction(
    {
      action: 'broadcast',
      titleKey: parsed.data.title,
      body: parsed.data.body,
      audience: parsed.data.audience,
    },
    'Notification queued for delivery.',
  );
}
