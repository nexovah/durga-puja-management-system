-- ============================================================================
-- Tasks: "Completed" is added as a 5th priority value — marking a task
-- Completed is how it moves from the "All Tasks" tab to the "Completed" tab
-- on the Tasks page (a filter on priority, not a separate status column).
-- Run this once in Supabase -> SQL Editor, AFTER 012_tasks_assign_expiry.sql.
-- ============================================================================

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high', 'note', 'completed'));
