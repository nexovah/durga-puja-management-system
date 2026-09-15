-- ============================================================================
-- Vendor tracking on Expenses + new Loans feature.
-- Run this once in Supabase -> SQL Editor, AFTER 004_user_enable_disable.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Expenses: Voucher Number + Vendor/Supplier Name + Contact
-- ----------------------------------------------------------------------------
alter table public.expenses
  add column if not exists voucher_number text,
  add column if not exists vendor_name text,
  add column if not exists vendor_contact text;

-- ----------------------------------------------------------------------------
-- 2. Loans table
-- ----------------------------------------------------------------------------
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  amount numeric(12,2) not null default 0,
  phone text,
  payment_method text not null default 'notSelected', -- notSelected, cash, qrScan, onlineBanking, check
  payment_status text not null default 'paid',          -- always 'paid' for loans
  date date not null default current_date,
  return_date date,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_loans_updated_at on public.loans;
create trigger trg_loans_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

create index if not exists idx_loans_date on public.loans (date desc);

alter table public.loans enable row level security;

drop policy if exists loans_all on public.loans;
create policy loans_all on public.loans for all using (true) with check (true);

grant select, insert, update, delete on public.loans to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Give every existing user access to the new Loans menu by default
--    (merges the key into their permissions jsonb without touching the rest;
--    admins can restrict this per-user afterwards in Settings -> User Management).
-- ----------------------------------------------------------------------------
update public.app_users
set permissions = permissions || '{"loans": true}'::jsonb
where not (permissions ? 'loans');
