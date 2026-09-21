-- ============================================================================
-- developer_info moves from "any committee admin can edit" to "Super Admin
-- only edits it, every tenant sees it read-only" — it's platform/vendor
-- info, not committee data, so it never should have been editable per-tenant.
-- Run this once, AFTER 023_tenant_details_and_subscriptions.sql.
-- ============================================================================

revoke insert, update, delete on public.developer_info from anon, authenticated;
-- select stays granted — every tenant's Settings > Developer Info tab still
-- reads it, just can no longer write to it directly.

create or replace function public.super_admin_update_developer_info(
  p_name text,
  p_email text,
  p_phone text,
  p_version text
)
returns public.developer_info
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.developer_info;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  update public.developer_info
    set name = p_name, email = p_email, phone = p_phone, version = p_version
    where id = 1
    returning * into v_row;

  return v_row;
end;
$$;
grant execute on function public.super_admin_update_developer_info(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
