-- ============================================================================
-- View-only user access level.
-- Run this once in Supabase -> SQL Editor, AFTER schema.sql and
-- 002_user_management.sql.
--
-- Adds a "Can Edit & Manage" / "View Only" toggle per user, alongside the
-- existing per-page (members/chanda/...) permissions. A view-only user still
-- only sees the pages their permissions allow, but on those pages they can
-- read records without any Add/Edit/Delete/Import controls being shown.
--
-- IMPORTANT: like the rest of this schema (see the security note in
-- schema.sql), this is enforced in the React app's UI, not by the database
-- itself -- there is no Supabase Auth session tied to the request, so the
-- database has no way to know which app_user is making a given API call.
-- A view-only account cannot write through the app's UI, but the underlying
-- REST API/table access is unchanged (still governed by the existing RLS
-- policies, which allow full read/write to anyone with the anon key, same
-- as before). If you need this enforced at the database level too (so it
-- holds even against someone calling the API directly, not just through the
-- app), that requires moving to real Supabase Auth + per-row RLS -- say the
-- word whenever you want that upgrade.
-- ============================================================================

alter table public.app_users
  add column if not exists can_edit boolean not null default true;

-- Recreate login/create_app_user/update_app_user to return/accept can_edit.
-- Dropped first because adding a parameter changes the function signature.

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
      and u.password_hash = crypt(p_password, u.password_hash);
end;
$$;

drop function if exists public.create_app_user(text, text, text, jsonb);
create or replace function public.create_app_user(
  p_name text,
  p_username text,
  p_password text,
  p_permissions jsonb,
  p_can_edit boolean default true
)
returns table (id uuid, name text, username text, is_admin boolean, permissions jsonb, can_edit boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    insert into public.app_users (name, username, password_hash, is_admin, permissions, can_edit)
    values (p_name, p_username, crypt(p_password, gen_salt('bf')), false, p_permissions, p_can_edit)
    returning app_users.id, app_users.name, app_users.username, app_users.is_admin, app_users.permissions, app_users.can_edit;
end;
$$;

drop function if exists public.update_app_user(uuid, text, jsonb, text);
create or replace function public.update_app_user(
  p_user_id uuid,
  p_name text,
  p_permissions jsonb,
  p_new_password text default null,
  p_can_edit boolean default true
)
returns table (id uuid, name text, username text, is_admin boolean, permissions jsonb, can_edit boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.app_users
    set name = p_name,
        permissions = p_permissions,
        can_edit = p_can_edit,
        password_hash = case
          when p_new_password is not null and p_new_password <> ''
          then crypt(p_new_password, gen_salt('bf'))
          else password_hash
        end
    where app_users.id = p_user_id;

  return query
    select u.id, u.name, u.username, u.is_admin, u.permissions, u.can_edit
    from public.app_users u
    where u.id = p_user_id;
end;
$$;

grant execute on function public.login(text, text) to anon, authenticated;
grant execute on function public.create_app_user(text, text, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.update_app_user(uuid, text, jsonb, text, boolean) to anon, authenticated;
