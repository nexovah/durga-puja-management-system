-- ============================================================================
-- Additional RPC functions for the Settings → User Management screen.
-- Run this once in Supabase → SQL Editor, AFTER schema.sql.
-- ============================================================================

-- Update a user's name/permissions, and optionally reset their password
-- (pass p_new_password as null to leave the password unchanged).
create or replace function public.update_app_user(
  p_user_id uuid,
  p_name text,
  p_permissions jsonb,
  p_new_password text default null
)
returns table (id uuid, name text, username text, is_admin boolean, permissions jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_users
    set name = p_name,
        permissions = p_permissions,
        password_hash = case
          when p_new_password is not null and p_new_password <> ''
          then crypt(p_new_password, gen_salt('bf'))
          else password_hash
        end
    where app_users.id = p_user_id;

  return query
    select u.id, u.name, u.username, u.is_admin, u.permissions
    from public.app_users u
    where u.id = p_user_id;
end;
$$;

-- Delete a user. Refuses to delete an admin account (mirrors the original
-- app's rule that the admin user can't be removed from the UI).
create or replace function public.delete_app_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.app_users where id = p_user_id;

  if v_is_admin then
    return false;
  end if;

  delete from public.app_users where id = p_user_id;
  return true;
end;
$$;

grant execute on function public.update_app_user(uuid, text, jsonb, text) to anon, authenticated;
grant execute on function public.delete_app_user(uuid) to anon, authenticated;
