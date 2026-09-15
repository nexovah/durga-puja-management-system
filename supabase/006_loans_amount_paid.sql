-- ============================================================================
-- Loans: split into "Amount Received" (from the lender, credited to the
-- committee's balance) and "Amount Paid" (repaid back to the lender so far,
-- deducted from that credit). Net per loan = amount_received - amount_paid.
-- Run this once in Supabase -> SQL Editor, AFTER 005_vendor_loans.sql.
-- ============================================================================

alter table public.loans
  rename column amount to amount_received;

alter table public.loans
  add column if not exists amount_paid numeric(12,2) not null default 0;
