// Same tenant-scoped-JWT pattern as the web app's src/app/lib/supabaseClient.ts:
// after login() runs, every request must carry "Authorization: Bearer
// <tenant JWT>" so RLS's current_tenant_id() can read the tenant_id claim.
// supabase-js has no hook to change headers on an existing client, so every
// request is routed through a custom fetch that injects the token when set.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env.'
  );
}

let tenantAccessToken: string | null = null;

export function setTenantAccessToken(token: string | null) {
  tenantAccessToken = token;
}

const tenantAwareFetch: typeof fetch = (input, init = {}) => {
  if (!tenantAccessToken) return fetch(input, init);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${tenantAccessToken}`);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    global: { fetch: tenantAwareFetch },
    auth: { storage: AsyncStorage, persistSession: false, autoRefreshToken: false },
  }
);
