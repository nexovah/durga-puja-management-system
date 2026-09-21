import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Create a .env file ' +
    '(see .env.example) with your Supabase project URL and anon key, then restart the dev server.'
  );
}

// After login, every request must carry the per-tenant JWT the login() RPC
// signs (see supabase/020_multi_tenant.sql) as "Authorization: Bearer
// <token>" so RLS's current_tenant_id() can read the tenant_id claim off
// it. supabase-js doesn't expose a way to change headers on an existing
// client, so we route every request through a custom fetch that injects the
// token when one is set, and falls back to the anon key (set by supabase-js
// itself) otherwise — e.g. for the login() call and the public landing
// page's leads insert, both of which run logged-out.
let tenantAccessToken: string | null = null;

export function setTenantAccessToken(token: string | null) {
  tenantAccessToken = token;
}

export function getTenantAccessToken(): string | null {
  return tenantAccessToken;
}

const tenantAwareFetch: typeof fetch = (input, init = {}) => {
  if (!tenantAccessToken) return fetch(input, init);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${tenantAccessToken}`);
  return fetch(input, { ...init, headers });
};

// Falls back to harmless placeholder strings so createClient() doesn't throw
// before the app has a chance to show the "not configured" screen.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { global: { fetch: tenantAwareFetch } }
);
