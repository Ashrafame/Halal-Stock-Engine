import { constantTimeEqual, HttpError, optionalEnv, requireEnv } from './http.ts';
import { adminClient } from './supabase.ts';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  token: string;
}

function bearerToken(req: Request): string {
  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    throw new HttpError(401, 'missing_bearer_token');
  }
  const token = header.slice(7).trim();
  if (token.length < 20) throw new HttpError(401, 'invalid_token');
  return token;
}

/** Verifies the JWT with Supabase Auth — never trusts a client-supplied user id. */
export async function requireUser(req: Request): Promise<AuthenticatedUser> {
  const token = bearerToken(req);
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'invalid_token');
  return { id: data.user.id, email: data.user.email ?? null, token };
}

export interface AdminUser extends AuthenticatedUser {
  role: 'admin' | 'owner' | 'support' | 'user';
}

export async function requireAdmin(req: Request): Promise<AdminUser> {
  const user = await requireUser(req);
  const { data: profile, error } = await adminClient()
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new HttpError(500, 'profile_lookup_failed');
  if (!profile || profile.status !== 'active') throw new HttpError(403, 'forbidden');
  if (profile.role !== 'admin' && profile.role !== 'owner') {
    throw new HttpError(403, 'forbidden');
  }
  return { ...user, role: profile.role };
}

/**
 * Cron/service authentication. pg_cron passes `x-cron-secret`; a service-role
 * bearer token is also accepted for manual operations.
 */
export async function requireCron(req: Request): Promise<void> {
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  const expected = optionalEnv('CRON_SECRET');
  if (expected && headerSecret && constantTimeEqual(headerSecret, expected)) return;

  const auth = req.headers.get('authorization') ?? '';
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token === serviceKey) return;
  }
  throw new HttpError(401, 'cron_unauthorized');
}
