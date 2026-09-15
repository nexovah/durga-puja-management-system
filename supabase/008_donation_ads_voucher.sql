-- ============================================================================
-- Donation/Ads Collection: Voucher/Bill Number for Donation Collection entries.
-- Run this once in Supabase -> SQL Editor, AFTER 007_chanda_bill_subamounts.sql.
-- ============================================================================

alter table public.donation_ads
  add column if not exists voucher_number text;
