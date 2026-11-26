export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * When Supabase is not configured (or HSE_DEMO_MODE=true) the web app renders
 * clearly-labelled read-only demo data. Mutations are disabled. There is no
 * authentication bypass against a real project.
 */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

export const isDemoMode =
  !isSupabaseConfigured || process.env.HSE_DEMO_MODE === 'true';

export const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
