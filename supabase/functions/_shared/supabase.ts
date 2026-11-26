import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { HttpError, optionalEnv, requireEnv } from './http.ts';

let cachedAdmin: SupabaseClient | null = null;

/**
 * Service-role client. Never log or return rows that depend on it without an
 * explicit authorisation check. RLS is bypassed, so every handler must decide
 * *whose* data may be touched.
 */
export function adminClient(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  cachedAdmin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'halal-stock-engine-edge' } },
  });
  return cachedAdmin;
}

export function userClient(accessToken: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function getSystemFlag(key: string, fallback: boolean): Promise<boolean> {
  const { data } = await adminClient()
    .from('system_variables')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  const value = data?.value;
  return typeof value === 'boolean' ? value : fallback;
}

export async function getSystemNumber(key: string, fallback: number): Promise<number> {
  const { data } = await adminClient()
    .from('system_variables')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  const value = data?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function logApiUsage(input: {
  provider: string;
  endpoint: string;
  statusCode?: number;
  latencyMs?: number;
  costUnits?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await adminClient()
      .from('api_usage')
      .insert({
        provider: input.provider,
        endpoint: input.endpoint.slice(0, 200),
        status_code: input.statusCode ?? null,
        latency_ms: input.latencyMs ?? null,
        cost_units: input.costUnits ?? 0,
        metadata: input.metadata ?? {},
      });
  } catch (error) {
    console.error('[logApiUsage] failed', error);
  }
}

export async function logError(input: {
  level?: 'warn' | 'error' | 'fatal';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string | null;
}): Promise<void> {
  try {
    await adminClient()
      .from('app_errors')
      .insert({
        level: input.level ?? 'error',
        message: input.message.slice(0, 2000),
        stack: input.stack?.slice(0, 8000) ?? null,
        context: input.context ?? {},
        user_id: input.userId ?? null,
      });
  } catch (error) {
    console.error('[logError] failed', error);
  }
}

/** Append-only audit entry written by privileged server code. */
export async function writeAudit(input: {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { error } = await adminClient()
    .from('audit_logs')
    .insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
  if (error) throw new HttpError(500, 'audit_write_failed', error.message);
}

export function clientIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    null
  );
}

export async function enforceRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const client = adminClient();
  const since = new Date(Date.now() - input.windowSeconds * 1000).toISOString();
  const { count, error } = await client
    .from('api_usage')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'internal-rate-limit')
    .eq('endpoint', input.key)
    .gte('created_at', since);
  if (error) return; // fail open: availability over strictness on telemetry
  if ((count ?? 0) >= input.limit) throw new HttpError(429, 'rate_limited');
  await client
    .from('api_usage')
    .insert({ provider: 'internal-rate-limit', endpoint: input.key, cost_units: 0 });
}

export { optionalEnv };
