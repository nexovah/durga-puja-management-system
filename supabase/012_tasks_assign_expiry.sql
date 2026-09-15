-- ============================================================================
-- Tasks: assign to one or more members, and an expiry date (defaults to
-- 15 days after creation, front-end sets the actual value — this column is
-- just storage, no default computed in SQL since "created" is a client
-- timestamp).
-- Run this once in Supabase -> SQL Editor, AFTER 011_tasks.sql.
-- ============================================================================

alter table public.tasks
  add column if not exists expiry_date date,
  add column if not exists assigned_member_ids uuid[] not null default '{}';

create index if not exists idx_tasks_assigned_member_ids on public.tasks using gin (assigned_member_ids);
