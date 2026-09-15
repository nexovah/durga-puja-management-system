-- ============================================================================
-- Tasks — a simple internal to-do list reached via the "⋮" more-menu (like
-- Google Tasks / Notion tasks). Title + description + priority, with the
-- created date/time captured automatically. Same permissive RLS trust model
-- as every other business table (members/chanda/expenses/...): the anon key
-- has full access, gated only by the app's own permission checks.
-- Run this once in Supabase -> SQL Editor, AFTER 010_member_membership_payment.sql.
-- ============================================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null check (priority in ('low', 'medium', 'high', 'note')) default 'medium',
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_created_at on public.tasks (created_at desc);

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (true);

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (true);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (true) with check (true);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete using (true);

grant select, insert, update, delete on public.tasks to anon, authenticated;

-- New "Tasks" menu gets its own permission key. Give existing users the
-- same access they already have to Settings so nobody unexpectedly gets
-- (or loses) the Tasks menu on upgrade — defaulting new users to "on" like
-- every other business-data permission.
update public.app_users
  set permissions = permissions || '{"tasks": true}'::jsonb
  where not (permissions ? 'tasks');
