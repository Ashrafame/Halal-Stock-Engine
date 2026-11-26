import 'server-only';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Calls the admin Edge Function with the admin's own access token. The function
 * re-verifies RBAC, applies rate limits and writes the audit trail.
 */
export async function callAdminApi(
  accessToken: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    resource?: string;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  } = {},
): Promise<unknown> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/admin-api`);
  if (options.resource) url.searchParams.set('resource', options.resource);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof payload.error === 'string' ? payload.error : 'admin_api_failed';
    throw new Error(code);
  }
  return payload;
}
