-- ============================================================================
-- App version update details (changelog) — free-text, one line per point,
-- edited only from Super Admin, shown read-only to every tenant alongside
-- the version number. Run this once, AFTER
-- 026_super_admin_manage_tenant_admin.sql.
-- ============================================================================

alter table public.developer_info add column if not exists changelog text;

drop function if exists public.super_admin_update_developer_info(text, text, text, text);

create or replace function public.super_admin_update_developer_info(
  p_name text,
  p_email text,
  p_phone text,
  p_version text,
  p_changelog text default null
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
    set name = p_name, email = p_email, phone = p_phone, version = p_version, changelog = p_changelog
    where id = 1
    returning * into v_row;

  return v_row;
end;
$$;
grant execute on function public.super_admin_update_developer_info(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
