-- ============================================================================
-- Enable / disable a user's login.
-- Run this once in Supabase -> SQL Editor, AFTER schema.sql,
-- 002_user_management.sql, and 003_view_only_access.sql.
--
-- Adds an is_active flag per user. A disabled user's login attempt fails
-- (same 'Invalid username or password' message as a wrong password, so a
-- disabled username isn't revealed to whoever is typing it).
-- ============================================================================

alter table public.app_users
  add column if not exists is_active boolean not null default true;

-- Recreate login() to also require is_active = true.
drop function if exists public.login(text, text);
create or replace function public.login(p_username text, p_password text)
returns table (
  id uuid,
  name text,
  username text,
  is_admin boolean,
  permissions jsonb,
  can_edit boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select u.id, u.name, u.username, u.is_admin, u.permissions, u.can_edit
    from public.app_users u
    where u.username = p_username
      and u.password_hash = crypt(p_password, u.password_hash)
      and u.is_active = true;
end;
$$;

grant execute on function public.login(text, text) to anon, authenticated;

-- Enable/disable a user's account. Refuses to disable an admin account
-- (mirrors the existing rule that the admin user can't be deleted either).
create or replace function public.set_app_user_active(p_user_id uuid, p_is_active boolean)
returns table (id uuid, name text, username text, is_admin boolean, permissions jsonb, can_edit boolean, is_active boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_is_admin boolean;
begin
  select app_users.is_admin into v_is_admin from public.app_users where app_users.id = p_user_id;

  if v_is_admin and not p_is_active then
    raise exception 'Cannot disable an admin account';
  end if;

  update public.app_users set is_active = p_is_active where app_users.id = p_user_id;

  return query
    select u.id, u.name, u.username, u.is_admin, u.permissions, u.can_edit, u.is_active
    from public.app_users u
    where u.id = p_user_id;
end;
$$;

grant execute on function public.set_app_user_active(uuid, boolean) to anon, authenticated;
