import { cache } from 'react';

import { redirect } from 'next/navigation';

import { demo, type Profile } from '@hse/shared';

import { isDemoMode, isSupabaseConfigured } from './env';
import { mapProfile, type ProfileRow } from './mappers';
import { createSupabaseServerClient } from './supabase/server';

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
  isDemo: boolean;
  accessToken: string | null;
}

export function isAdminRole(role: Profile['role']): boolean {
  return role === 'admin' || role === 'owner';
}

export function isStaffRole(role: Profile['role']): boolean {
  return role === 'support' || role === 'admin' || role === 'owner';
}

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  if (isDemoMode) {
    return {
      userId: demo.DEMO_PROFILE.id,
      email: demo.DEMO_PROFILE.email,
      profile: demo.DEMO_PROFILE,
      isDemo: true,
      accessToken: null,
    };
  }

  if (!isSupabaseConfigured) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: row } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>();

    const profile: Profile = row
      ? mapProfile(row)
      : {
          id: user.id,
          email: user.email ?? null,
          fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
          avatarUrl: null,
          locale: 'en',
          role: 'user',
          status: 'active',
          timezone: 'UTC',
          stripeCustomerId: null,
          notifyEmail: true,
          notifyPush: true,
          onboardingCompleted: false,
          createdAt: user.created_at,
          updatedAt: user.updated_at ?? user.created_at,
        };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      userId: user.id,
      email: user.email ?? null,
      profile,
      isDemo: false,
      accessToken: session?.access_token ?? null,
    };
  } catch {
    return null;
  }
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  return session;
}

export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.isDemo) {
    return {
      ...session,
      userId: demo.DEMO_ADMIN_PROFILE.id,
      email: demo.DEMO_ADMIN_PROFILE.email,
      profile: demo.DEMO_ADMIN_PROFILE,
    };
  }
  if (!isAdminRole(session.profile.role)) {
    redirect('/dashboard?error=forbidden');
  }
  return session;
}
