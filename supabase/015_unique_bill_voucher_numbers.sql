-- ============================================================================
-- Enforce uniqueness of Bill/Voucher numbers at the database level too, as a
-- backstop behind the client-side checks (Add/Edit form validation + the
-- Import Preview modal). Case-insensitive, ignores blank values (the field
-- is optional) and leading/trailing whitespace.
-- Run this once in Supabase -> SQL Editor, AFTER 014_tasks_creator.sql.
-- ============================================================================

create unique index if not exists idx_chanda_bill_number_unique
  on public.chanda (lower(trim(bill_number)))
  where bill_number is not null and trim(bill_number) <> '';

create unique index if not exists idx_donation_ads_voucher_number_unique
  on public.donation_ads (lower(trim(voucher_number)))
  where voucher_number is not null and trim(voucher_number) <> '';

create unique index if not exists idx_expenses_voucher_number_unique
  on public.expenses (lower(trim(voucher_number)))
  where voucher_number is not null and trim(voucher_number) <> '';

-- Note: if this migration fails with a "could not create unique index"
-- error, it means duplicate bill/voucher numbers already exist in that
-- table from before this feature — find them first, e.g.:
--   select lower(trim(bill_number)), count(*) from public.chanda
--     where bill_number is not null and trim(bill_number) <> ''
--     group by 1 having count(*) > 1;
-- and fix/clear the duplicates, then re-run this file.
