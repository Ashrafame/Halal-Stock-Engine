import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '../env';

/**
 * Request-scoped Supabase client bound to the user's auth cookies. All reads
 * and user mutations go through RLS — no service role here.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and anon key.');
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: middleware refreshes the session.
        }
      },
    },
  });
}
