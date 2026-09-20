-- ============================================================================
-- Expenses: each of the up-to-5 partial payment installments can now carry
-- its own payment date, since each installment is typically paid on a
-- different date. Parallel array to expenses.partial_amounts.
-- Run this once in Supabase -> SQL Editor, AFTER 015_unique_bill_voucher_numbers.sql.
-- ============================================================================

alter table public.expenses
  add column if not exists partial_dates date[];
