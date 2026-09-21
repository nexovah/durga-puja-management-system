-- ============================================================================
-- Fix: the tenant-side Billing page's history only read billing_transactions
-- (Razorpay payments), never subscription_credits (Super Admin's manual
-- grants from Phase 3) — so a manually-activated month never showed up.
-- subscription_credits had no select policy at all for anon/authenticated
-- (Phase 3 deliberately locked it to Super-Admin-only functions). Adding a
-- tenant-scoped read policy, same pattern as billing_transactions.
-- Run this once, AFTER 030_billing.sql.
-- ============================================================================

drop policy if exists subscription_credits_select on public.subscription_credits;
create policy subscription_credits_select on public.subscription_credits
  for select using (tenant_id = public.current_tenant_id());

grant select on public.subscription_credits to anon, authenticated;

notify pgrst, 'reload schema';
