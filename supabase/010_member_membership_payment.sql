-- ============================================================================
-- Member's own membership payment (donation to the committee) — optional
-- fields collected via the collapsible "Membership Payment" section on the
-- Add/Edit Member form. Same shape as Chanda so it reuses that vocabulary
-- (paid method / payment status / partial amount) and credit logic.
-- Run this once in Supabase -> SQL Editor, AFTER 009_activity_log_and_permissions.sql.
-- ============================================================================

alter table public.members
  add column if not exists membership_amount numeric,
  add column if not exists membership_paid_method text,
  add column if not exists membership_payment_status text,
  add column if not exists membership_partial_amount numeric,
  add column if not exists membership_date date,
  add column if not exists membership_bill_number text,
  add column if not exists membership_remarks text;
