-- ============================================================================
-- Chanda Collection: Bill Number + optional Amount 01 / Amount 02 split.
-- Run this once in Supabase -> SQL Editor, AFTER 006_loans_amount_paid.sql.
--
-- Amount 01 / Amount 02 are just a breakdown of the main `amount` field
-- (entered freely in the UI; when either is filled the app sets amount =
-- amount1 + amount2). They're stored so the split is preserved on edit,
-- but `amount` remains the single source of truth for all totals/reports.
-- ============================================================================

alter table public.chanda
  add column if not exists bill_number text,
  add column if not exists amount1 numeric(12,2),
  add column if not exists amount2 numeric(12,2);
