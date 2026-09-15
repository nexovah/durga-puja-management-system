-- ============================================================================
-- Tasks: track who created each task, so only the creator (or an admin) can
-- edit/delete it — everyone else with the Tasks permission can still view
-- it (and see it if they're assigned). Enforced client-side, same trust
-- model as the rest of the app (see supabase/README.md).
-- Run this once in Supabase -> SQL Editor, AFTER 013_tasks_completed_priority.sql.
-- ============================================================================

alter table public.tasks
  add column if not exists created_by uuid,               -- not a hard FK: task stays
  add column if not exists created_by_name text;           -- meaningful after the creator's account is deleted
