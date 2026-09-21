-- ============================================================================
-- Super Admin: view/edit a tenant's admin login (name, username, reset
-- password) from the Tenant modal. Run this once, AFTER
-- 025_create_tenant_with_admin.sql.
-- ============================================================================

create or replace function public.super_admin_get_tenant_admin(p_tenant_id uuid)
returns table (id uuid, name text, username text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  return query
    select u.id, u.name, u.username
    from public.app_users u
    where u.tenant_id = p_tenant_id and u.is_admin = true
    order by u.created_at asc
    limit 1;
end;
$$;
grant execute on function public.super_admin_get_tenant_admin(uuid) to anon, authenticated;

create or replace function public.super_admin_update_tenant_admin(
  p_user_id uuid,
  p_name text,
  p_username text,
  p_new_password text default null
)
returns table (id uuid, name text, username text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  update public.app_users
    set name = p_name,
        username = p_username,
        password_hash = case
          when p_new_password is not null and p_new_password <> ''
          then crypt(p_new_password, gen_salt('bf'))
          else password_hash
        end
    where app_users.id = p_user_id;

  return query select u.id, u.name, u.username from public.app_users u where u.id = p_user_id;
end;
$$;
grant execute on function public.super_admin_update_tenant_admin(uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
