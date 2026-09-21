-- ============================================================================
-- Phase 4 — Billing + Razorpay.
-- Run this once, AFTER 029_super_admin_profile.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. subscription_plans — the real source of pricing (was hardcoded as
--    PLAN_AMOUNT_PAISE in the frontend during Phase 3's manual-grant flow;
--    that constant should be deleted once this ships and the Billing page
--    reads from here instead).
-- ----------------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  period text not null unique check (period in ('monthly', 'yearly')),
  amount_paise integer not null,
  currency text not null default 'INR',
  is_active boolean not null default true
);

insert into public.subscription_plans (period, amount_paise, currency)
values ('monthly', 49900, 'INR'), ('yearly', 499900, 'INR')
on conflict (period) do nothing;

alter table public.subscription_plans enable row level security;
drop policy if exists subscription_plans_select on public.subscription_plans;
create policy subscription_plans_select on public.subscription_plans for select using (true);
grant select on public.subscription_plans to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. billing_transactions — one row per Razorpay order, the tenant's own
--    billing-history table renders these. Only ever written by the
--    Vercel serverless routes using the Supabase *service-role* key (which
--    bypasses RLS entirely) — never directly from the browser, so no
--    insert/update policy exists for anon/authenticated at all, only select.
-- ----------------------------------------------------------------------------
create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  plan_id uuid not null references public.subscription_plans(id),
  period text not null,
  amount_paise integer not null,
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  razorpay_order_id text not null unique,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_billing_transactions_tenant_id on public.billing_transactions (tenant_id);

alter table public.billing_transactions enable row level security;
drop policy if exists billing_transactions_select on public.billing_transactions;
create policy billing_transactions_select on public.billing_transactions
  for select using (tenant_id = public.current_tenant_id());
-- No insert/update/delete policy for anon/authenticated — the service role
-- (used only by /api/billing/* on the server) bypasses RLS and is the only
-- writer.

notify pgrst, 'reload schema';

-- ============================================================================
-- Also required, NOT run by this file (server-side secrets, set in your
-- Vercel project's Environment Variables once you deploy, and in a local
-- .env for `vercel dev` testing — see supabase/README.md / .env.example):
--   RAZORPAY_KEY_ID           — safe to expose to the browser (Checkout needs it)
--   RAZORPAY_KEY_SECRET       — server-only, signs/verifies payments
--   RAZORPAY_WEBHOOK_SECRET   — server-only, verifies webhook payloads
--   SUPABASE_SERVICE_ROLE_KEY — server-only, bypasses RLS for these writes
-- ============================================================================
