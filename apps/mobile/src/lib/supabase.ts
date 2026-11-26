import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

export const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3000';

const CHUNK_SIZE = 1_800;

/**
 * Expo SecureStore has a small per-value limit on Android. Supabase session
 * JSON can exceed it, so values are chunked and reassembled. Never use plain
 * AsyncStorage for refresh tokens.
 */
const chunkedStorage = {
  async getItem(key: string): Promise<string | null> {
    const meta = await SecureStore.getItemAsync(`${key}.meta`);
    if (!meta) return SecureStore.getItemAsync(key);
    const count = Number.parseInt(meta, 10);
    if (!Number.isFinite(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${index}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const total = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    for (let index = 0; index < total; index += 1) {
      await SecureStore.setItemAsync(
        `${key}.${index}`,
        value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(`${key}.meta`, String(total));
    await SecureStore.deleteItemAsync(key);
  },
  async removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(`${key}.meta`);
    const count = meta ? Number.parseInt(meta, 10) : 0;
    for (let index = 0; index < (Number.isFinite(count) ? count : 0); index += 1) {
      await SecureStore.deleteItemAsync(`${key}.${index}`);
    }
    await SecureStore.deleteItemAsync(`${key}.meta`);
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: chunkedStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: { headers: { 'X-Client-Info': 'halal-stock-engine-mobile' } },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('supabase_not_configured');
  }
  return supabase;
}

/** Locale preference is not a secret; SecureStore is still the only store used. */
export const LOCALE_STORAGE_KEY = 'hse.locale';
