-- ============================================================================
-- Run this FIRST, before 020_multi_tenant.sql — takes a cheap in-database
-- snapshot of every table the migration touches, so you have a rollback
-- path even on Supabase's free tier (no dashboard backups on free tier).
-- Costs nothing, lives in your own project. Safe to re-run (drops + redoes
-- the backup schema each time, so it always reflects data right before your
-- next migration attempt).
-- ============================================================================

drop schema if exists backup_pre_multitenant cascade;
create schema backup_pre_multitenant;

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users', 'committee_info', 'developer_info', 'members', 'chanda',
    'donation_ads', 'expenses', 'loans', 'activity_log', 'tasks', 'estimations'
  ]
  loop
    execute format(
      'create table backup_pre_multitenant.%I as select * from public.%I;',
      t, t
    );
  end loop;
end $$;

-- Verify row counts match before proceeding — run this and compare against
-- the same query on the public. tables:
-- select 'app_users', count(*) from backup_pre_multitenant.app_users
-- union all select 'members', count(*) from backup_pre_multitenant.members
-- union all select 'chanda', count(*) from backup_pre_multitenant.chanda;

-- ============================================================================
-- ROLLBACK (only if 020_multi_tenant.sql goes wrong and you need to undo it):
--   1. Drop the columns/constraints 020 added — easiest is to restore each
--      table from its backup:
--        truncate public.members;
--        insert into public.members select * from backup_pre_multitenant.members;
--      (repeat per table — skip tables you didn't touch)
--   2. Or, if the tenant_id columns/RLS are the only problem, just re-run
--      the relevant DROP/ALTER statements from 020_multi_tenant.sql in
--      reverse (drop policy, drop column tenant_id, etc.) — the backup
--      schema is your safety net either way, not a required step if you'd
--      rather fix forward.
-- Once you're confident the migration is correct and tested, you can drop
-- this backup schema: drop schema backup_pre_multitenant cascade;
-- ============================================================================
