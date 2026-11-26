import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Session, User } from '@supabase/supabase-js';
import { demo, type Locale, type Profile } from '@hse/shared';

import { isSupabaseConfigured, supabase } from './supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isDemo: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (input: {
    email: string;
    password: string;
    fullName?: string;
    locale: Locale;
  }) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function fallbackProfile(user: User): Profile {
  return {
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
}

async function loadProfile(user: User): Promise<Profile> {
  if (!supabase) return fallbackProfile(user);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return fallbackProfile(user);
  return {
    id: data.id as string,
    email: (data.email as string | null) ?? null,
    fullName: (data.full_name as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    locale: (data.locale as Locale) ?? 'en',
    role: data.role as Profile['role'],
    status: data.status as Profile['status'],
    timezone: (data.timezone as string) ?? 'UTC',
    stripeCustomerId: (data.stripe_customer_id as string | null) ?? null,
    notifyEmail: data.notify_email !== false,
    notifyPush: data.notify_push !== false,
    onboardingCompleted: Boolean(data.onboarding_completed),
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(
    isSupabaseConfigured ? null : demo.DEMO_PROFILE,
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    if (!current) {
      setProfile(null);
      return;
    }
    setProfile(await loadProfile(current));
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setProfile(data.session?.user ? await loadProfile(data.session.user) : null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        loadProfile(nextSession.user).then((nextProfile) => setProfile(nextProfile));
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'not_configured';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; fullName?: string; locale: Locale }) => {
      if (!supabase) return 'not_configured';
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { full_name: input.fullName ?? null, locale: input.locale },
        },
      });
      return error ? error.message : null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!supabase || !user) return 'not_configured';
      const { error } = await supabase
        .from('profiles')
        .update({
          ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
          ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
          ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
          ...(patch.notifyEmail !== undefined ? { notify_email: patch.notifyEmail } : {}),
          ...(patch.notifyPush !== undefined ? { notify_push: patch.notifyPush } : {}),
        })
        .eq('id', user.id);
      if (error) return error.message;
      await refreshProfile();
      return null;
    },
    [user, refreshProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      isDemo: !isSupabaseConfigured,
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [user, session, profile, loading, signIn, signUp, signOut, refreshProfile, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
