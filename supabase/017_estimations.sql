-- ============================================================================
-- Estimations — budgeting/projection tool, separate from the actual
-- Expenses module. Each estimation is a named projection (e.g. "Overall
-- Puja Expense Estimation") containing an unlimited list of line items
-- (title/date/amount), stored as a JSONB array since there's no existing
-- structured-array-of-objects column in this schema and a child table
-- would break the generic syncList() sync helper (one flat table per list).
-- Same permissive RLS trust model as every other business table.
-- Run this once in Supabase -> SQL Editor, AFTER 016_expenses_partial_dates.sql.
-- ============================================================================

create table if not exists public.estimations (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text
);

create index if not exists idx_estimations_created_at on public.estimations (created_at desc);

alter table public.estimations enable row level security;

drop policy if exists estimations_select on public.estimations;
create policy estimations_select on public.estimations for select using (true);

drop policy if exists estimations_insert on public.estimations;
create policy estimations_insert on public.estimations for insert with check (true);

drop policy if exists estimations_update on public.estimations;
create policy estimations_update on public.estimations for update using (true) with check (true);

drop policy if exists estimations_delete on public.estimations;
create policy estimations_delete on public.estimations for delete using (true);

grant select, insert, update, delete on public.estimations to anon, authenticated;

-- New "Estimation" menu gets its own permission key, defaulting to on for
-- existing users (same convention as every other business-data permission).
update public.app_users
  set permissions = permissions || '{"estimation": true}'::jsonb
  where not (permissions ? 'estimation');
