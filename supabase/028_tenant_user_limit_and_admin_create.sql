-- ============================================================================
-- 1. Per-tenant user limit — Super Admin sets max_users (null = unlimited);
--    the tenant's own create_app_user() RPC enforces it.
-- 2. super_admin_create_admin_for_tenant() — fixes tenants that ended up
--    with zero app_users (created before 025 added the first-admin step),
--    without needing to delete/recreate the whole tenant.
-- Run this once, AFTER 027_developer_info_changelog.sql.
-- ============================================================================

alter table public.tenants add column if not exists max_users integer;

-- ----------------------------------------------------------------------------
-- Super Admin: create the missing first admin for a tenant that has none.
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_create_admin_for_tenant(
  p_tenant_id uuid,
  p_admin_name text,
  p_admin_username text,
  p_admin_password text
)
returns table (id uuid, name text, username text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  insert into public.app_users (name, username, password_hash, is_admin, tenant_id, permissions)
  values (
    p_admin_name, p_admin_username, crypt(p_admin_password, gen_salt('bf')), true, p_tenant_id,
    '{"members":true,"chanda":true,"donationAds":true,"expenses":true,"treasury":true,"settings":true,"loans":true,"vendors":true,"tasks":true,"estimation":true}'::jsonb
  )
  returning app_users.id into v_user_id;

  return query select u.id, u.name, u.username from public.app_users u where u.id = v_user_id;
end;
$$;
grant execute on function public.super_admin_create_admin_for_tenant(uuid, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Super Admin: update tenant details now also sets max_users.
-- ----------------------------------------------------------------------------
drop function if exists public.super_admin_update_tenant(uuid, text, text, text, text, text);

create or replace function public.super_admin_update_tenant(
  p_tenant_id uuid,
  p_name text,
  p_slug text,
  p_phone text,
  p_email text,
  p_address text,
  p_max_users integer default null
)
returns public.tenants
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant public.tenants;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  update public.tenants
    set name = p_name, slug = p_slug, phone = p_phone, email = p_email, address = p_address, max_users = p_max_users
    where id = p_tenant_id
    returning * into v_tenant;

  return v_tenant;
end;
$$;
grant execute on function public.super_admin_update_tenant(uuid, text, text, text, text, text, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Super Admin: list tenants now also returns each tenant's current user
-- count, so the Tenants table can show "3 / 10" style usage.
-- ----------------------------------------------------------------------------
drop function if exists public.super_admin_list_tenants();

create or replace function public.super_admin_list_tenants()
returns table (
  id uuid, slug text, name text, status text, phone text, email text, address text,
  subscription_expires_at timestamptz, max_users integer, user_count bigint, created_at timestamptz
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
    select t.id, t.slug, t.name, t.status, t.phone, t.email, t.address,
           t.subscription_expires_at, t.max_users,
           (select count(*) from public.app_users u where u.tenant_id = t.id) as user_count,
           t.created_at
    from public.tenants t
    order by t.created_at desc;
end;
$$;
grant execute on function public.super_admin_list_tenants() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Tenant-side create_app_user() now enforces the cap Super Admin set.
-- ----------------------------------------------------------------------------
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
  can_edit boolean, can_delete boolean, can_bulk_import boolean, is_active boolean, tenant_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
  v_max_users integer;
  v_current_count integer;
begin
  v_tenant_id := public.current_tenant_id();

  select t.max_users into v_max_users from public.tenants t where t.id = v_tenant_id;
  if v_max_users is not null then
    select count(*) into v_current_count from public.app_users u where u.tenant_id = v_tenant_id;
    if v_current_count >= v_max_users then
      raise exception 'User limit reached for this account (max %). Contact support to increase it.', v_max_users;
    end if;
  end if;

  return query
    insert into public.app_users (name, username, password_hash, is_admin, permissions, can_edit, can_delete, can_bulk_import, tenant_id)
    values (p_name, p_username, crypt(p_password, gen_salt('bf')), false, p_permissions, p_can_edit, p_can_delete, p_can_bulk_import, v_tenant_id)
    returning app_users.id, app_users.name, app_users.username, app_users.is_admin, app_users.permissions,
              app_users.can_edit, app_users.can_delete, app_users.can_bulk_import, app_users.is_active, app_users.tenant_id;
end;
$$;
grant execute on function public.create_app_user(text, text, text, jsonb, boolean, boolean, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
