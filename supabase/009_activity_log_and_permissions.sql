-- ============================================================================
-- Activity Log + finer-grained user permissions:
--   - app_users.can_delete   : separate from can_edit — a user can be allowed
--                              to add/edit records but NOT delete them
--   - app_users.can_bulk_import : controls whether the CSV Import button
--                              shows on Chanda/Donation-Ads/Expenses/Loans
--   - activity_log table    : append-only audit trail of every create/
--                              update/delete/bulk_import across the app
-- Run this once in Supabase -> SQL Editor, AFTER 008_donation_ads_voucher.sql.
-- ============================================================================

alter table public.app_users
  add column if not exists can_delete boolean not null default true,
  add column if not exists can_bulk_import boolean not null default true;

-- New "Vendor" menu now has its own permission key (was piggy-backing on
-- "expenses"). Give existing users the same access they already have to
-- Expenses so nobody loses the Vendor menu on upgrade.
update public.app_users
  set permissions = permissions || jsonb_build_object('vendors', coalesce(permissions->'expenses', 'true'::jsonb))
  where not (permissions ? 'vendors');

-- ----------------------------------------------------------------------------
-- Activity log — append-only. RLS below grants select+insert only (no update/
-- delete policy), so once a row is written from the app it can't be edited or
-- removed through the API — an honest audit trail.
-- ----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,               -- not a hard FK: keeps the log meaningful even
  username text not null,     -- after the user account is later deleted
  user_name text not null,
  action text not null check (action in ('create', 'update', 'delete', 'bulk_import')),
  module text not null,       -- 'members', 'chanda', 'donation_ads', 'expenses', 'loans', 'users', 'settings'
  summary text not null,      -- human-readable one-liner, e.g. "Amit Sharma — ₹5,000"
  record_count integer not null default 1, -- >1 for bulk_import
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_created_at on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log for select using (true);

drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log for insert with check (true);

grant select, insert on public.activity_log to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Recreate login/create_app_user/update_app_user to carry can_delete /
-- can_bulk_import (adding params changes the signature, so drop first).
-- ----------------------------------------------------------------------------

drop function if exists public.login(text, text);
create or replace function public.login(p_username text, p_password text)
returns table (
  id uuid,
  name text,
  username text,
  is_admin boolean,
  permissions jsonb,
  can_edit boolean,
  can_delete boolean,
  can_bulk_import boolean,
  is_active boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select u.id, u.name, u.username, u.is_admin, u.permissions,
           u.can_edit, u.can_delete, u.can_bulk_import, u.is_active
    from public.app_users u
    where u.username = p_username
      and u.password_hash = crypt(p_password, u.password_hash)
      and u.is_active = true;
end;
$$;

drop function if exists public.create_app_user(text, text, text, jsonb, boolean);
create or replace function public.create_app_user(
  p_name text,
  p_username text,
  p_password text,
  p_permissions jsonb,
  p_can_edit boolean default true,
  p_can_delete boolean default true,
  p_can_bulk_import boolean default true
)
returns table (
  id uuid, name text, username text, is_admin boolean, permissions jsonb,
  can_edit boolean, can_delete boolean, can_bulk_import boolean, is_active boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    insert into public.app_users (name, username, password_hash, is_admin, permissions, can_edit, can_delete, can_bulk_import)
    values (p_name, p_username, crypt(p_password, gen_salt('bf')), false, p_permissions, p_can_edit, p_can_delete, p_can_bulk_import)
    returning app_users.id, app_users.name, app_users.username, app_users.is_admin, app_users.permissions,
              app_users.can_edit, app_users.can_delete, app_users.can_bulk_import, app_users.is_active;
end;
$$;

drop function if exists public.update_app_user(uuid, text, jsonb, text, boolean);
create or replace function public.update_app_user(
  p_user_id uuid,
  p_name text,
  p_permissions jsonb,
  p_new_password text default null,
  p_can_edit boolean default true,
  p_can_delete boolean default true,
  p_can_bulk_import boolean default true
)
returns table (
  id uuid, name text, username text, is_admin boolean, permissions jsonb,
  can_edit boolean, can_delete boolean, can_bulk_import boolean, is_active boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.app_users
    set name = p_name,
        permissions = p_permissions,
        can_edit = p_can_edit,
        can_delete = p_can_delete,
        can_bulk_import = p_can_bulk_import,
        password_hash = case
          when p_new_password is not null and p_new_password <> ''
          then crypt(p_new_password, gen_salt('bf'))
          else password_hash
        end
    where app_users.id = p_user_id;

  return query
    select u.id, u.name, u.username, u.is_admin, u.permissions,
           u.can_edit, u.can_delete, u.can_bulk_import, u.is_active
    from public.app_users u
    where u.id = p_user_id;
end;
$$;

grant execute on function public.login(text, text) to anon, authenticated;
grant execute on function public.create_app_user(text, text, text, jsonb, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.update_app_user(uuid, text, jsonb, text, boolean, boolean, boolean) to anon, authenticated;
