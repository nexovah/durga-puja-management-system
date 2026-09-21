-- ============================================================================
-- Estimations — per-estimation customizable table header labels (Serial No.,
-- Title, the custom free-text column that replaced the fixed Date column,
-- Amount). Stored as its own jsonb column since it's a small fixed-shape
-- object, separate from the unbounded line_items array.
-- Run this once in Supabase -> SQL Editor, AFTER 017_estimations.sql.
-- ============================================================================

alter table public.estimations
  add column if not exists column_labels jsonb not null default '{"serialNo":"S. No.","title":"Title","customField":"Custom Field","amount":"Amount"}'::jsonb;
