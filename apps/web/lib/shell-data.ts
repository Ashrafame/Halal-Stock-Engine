import { PLAN_FEATURES, PLAN_LIMITS, demo } from '@hse/shared';

import { isDemoMode, isSupabaseConfigured } from './env';
import type { EntitlementRow } from './mappers';
import { createSupabaseServerClient } from './supabase/server';

export interface ShellData {
  unreadCount: number;
  entitlements: EntitlementRow;
}

export async function getShellData(userId: string): Promise<ShellData> {
  const demoEntitlement: EntitlementRow = {
    user_id: userId,
    role: 'user',
    status: 'active',
    locale: 'en',
    plan_id: 'pro',
    tier: 'pro',
    limits: PLAN_LIMITS.pro,
    features: PLAN_FEATURES.pro,
    subscription_status: 'active',
    billing_interval: 'month',
    current_period_end: demo.DEMO_SUBSCRIPTION.currentPeriodEnd,
    cancel_at_period_end: false,
    trial_end: null,
  };

  if (isDemoMode || !isSupabaseConfigured) {
    return {
      unreadCount: demo.DEMO_NOTIFICATIONS.filter((item) => !item.readAt).length,
      entitlements: demoEntitlement,
    };
  }

  const supabase = await createSupabaseServerClient();
  const [unread, entitlement] = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null),
    supabase
      .from('v_user_entitlements')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle<EntitlementRow>(),
  ]);

  return {
    unreadCount: unread.count ?? 0,
    entitlements: entitlement.data ?? demoEntitlement,
  };
}
