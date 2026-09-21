// Server-only Supabase client using the service-role key — bypasses RLS
// entirely. Never import this from src/ (browser code); it only runs here,
// inside Vercel Serverless Functions, where SUPABASE_SERVICE_ROLE_KEY is
// set as an environment variable (never exposed to the client bundle since
// it isn't prefixed with VITE_).
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
