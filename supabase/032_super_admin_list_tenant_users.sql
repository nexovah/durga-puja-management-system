-- ============================================================================
-- Super Admin: list every app_users row for a tenant (not just the single
-- "admin" one super_admin_get_tenant_admin returns) — shown as a read-only
-- table on the Tenant detail page. Run this once, AFTER
-- 031_billing_history_manual_grants.sql.
-- ============================================================================

create or replace function public.super_admin_list_tenant_users(p_tenant_id uuid)
returns table (
  id uuid, name text, username text, is_admin boolean, is_active boolean, created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  return query
    select u.id, u.name, u.username, u.is_admin, u.is_active, u.created_at
    from public.app_users u
    where u.tenant_id = p_tenant_id
    order by u.created_at asc;
end;
$$;
grant execute on function public.super_admin_list_tenant_users(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
