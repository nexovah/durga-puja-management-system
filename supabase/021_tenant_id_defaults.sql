-- ============================================================================
-- Phase 2 follow-up fix: inserts from the app don't (and shouldn't need to)
-- send tenant_id explicitly — every table's tenant_id now defaults to the
-- caller's own tenant, read straight from their JWT via current_tenant_id()
-- (see supabase/020_multi_tenant.sql). Run this once, after 020.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users', 'committee_info', 'members', 'chanda', 'donation_ads',
    'expenses', 'loans', 'activity_log', 'tasks', 'estimations'
  ]
  loop
    execute format(
      'alter table public.%I alter column tenant_id set default public.current_tenant_id();',
      t
    );
  end loop;
end $$;
