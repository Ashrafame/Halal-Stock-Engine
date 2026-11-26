import { createClient } from '@supabase/supabase-js';

import { SUPABASE_URL, hasServiceRoleKey, isSupabaseConfigured } from '../env';

/**
 * Service-role client. Only import this from server-only modules that have
 * already verified the caller with `requireAdmin()`. The key is never exposed
 * to the browser because it has no NEXT_PUBLIC_ prefix.
 */
export function createAdminClient() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!hasServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations.');
  }

  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'halal-stock-engine-web-admin' } },
  });
}
