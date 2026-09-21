-- ============================================================================
-- Phase 3 — Super Admin panel.
-- Run this once in Supabase -> SQL Editor, AFTER 021_tenant_id_defaults.sql.
--
-- YOU MUST EDIT ONE VALUE BELOW: search for <PASTE_YOUR_JWT_SECRET_HERE>
-- and replace with the SAME JWT secret you already pasted into
-- 020_multi_tenant.sql's login() function (Settings -> API -> JWT Settings
-- -> Legacy JWT Secret).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. super_admins — completely separate from app_users. Not tenant-scoped,
--    not subject to any tenant's RLS. Own bcrypt login, same pattern as
--    app_users but its own table/function so platform-level access is never
--    conflated with any committee's data.
-- ----------------------------------------------------------------------------
create table if not exists public.super_admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Bootstrap super admin — EDIT the username/password below, then run just
-- this insert (or run it now and change the password afterwards via the
-- panel once that exists).
insert into public.super_admins (name, username, password_hash)
values ('Super Admin', 'nexovah', crypt('Passin@durgacrm26', gen_salt('bf')))
on conflict (username) do nothing;

-- ----------------------------------------------------------------------------
-- 2. is_super_admin_request() — reads a custom "is_super_admin" claim off
--    the caller's JWT. Super-admin tokens still carry role:"authenticated"
--    (so PostgREST accepts them with the same grants as a committee user —
--    "super_admin" isn't a real Postgres role) but are distinguished by
--    this claim, checked inside every management function below.
-- ----------------------------------------------------------------------------
create or replace function public.is_super_admin_request()
returns boolean
language sql
stable
as $$
  select coalesce((current_setting('request.jwt.claims', true)::json ->> 'is_super_admin')::boolean, false)
$$;

-- ----------------------------------------------------------------------------
-- 3. super_admin_login() — same shape as the committee login() in
--    020_multi_tenant.sql, signs a token (1-day expiry, shorter than the
--    7-day committee session — platform access should re-auth more often)
--    carrying is_super_admin: true instead of a tenant_id.
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_login(p_username text, p_password text)
returns table (id uuid, name text, username text, access_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin record;
  v_jwt_secret text := '/HFvwjK/AcCpecZxkLtk5xCMIuEaUhnepdJRAoXkTzGynyqIOK/9PBQLya0zc8uxazaOFCyy9J4Jzbzgk2wopQ==';
begin
  select a.id, a.name, a.username
    into v_admin
    from public.super_admins a
    where a.username = p_username
      and a.password_hash = crypt(p_password, a.password_hash);

  if v_admin.id is null then
    return;
  end if;

  return query select
    v_admin.id, v_admin.name, v_admin.username,
    public.jwt_sign(
      json_build_object(
        'role', 'authenticated',
        'sub', v_admin.id,
        'is_super_admin', true,
        'exp', extract(epoch from (now() + interval '1 day'))::integer
      )::jsonb,
      v_jwt_secret
    );
end;
$$;

grant execute on function public.super_admin_login(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Management functions — every one checks is_super_admin_request() first
--    and raises if it's not a valid super-admin token. These run as
--    SECURITY DEFINER (table owner), so they see across every tenant
--    regardless of RLS — the only place in the whole system that can.
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_list_tenants()
returns setof public.tenants
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;
  return query select * from public.tenants order by created_at desc;
end;
$$;
grant execute on function public.super_admin_list_tenants() to anon, authenticated;

create or replace function public.super_admin_create_tenant(p_name text, p_slug text)
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
  insert into public.tenants (name, slug, status)
  values (p_name, p_slug, 'active')
  returning * into v_tenant;
  return v_tenant;
end;
$$;
grant execute on function public.super_admin_create_tenant(text, text) to anon, authenticated;

create or replace function public.super_admin_set_tenant_status(p_tenant_id uuid, p_status text)
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
  if p_status not in ('active', 'disabled') then
    raise exception 'invalid status: %', p_status;
  end if;
  update public.tenants set status = p_status where id = p_tenant_id
  returning * into v_tenant;
  return v_tenant;
end;
$$;
grant execute on function public.super_admin_set_tenant_status(uuid, text) to anon, authenticated;

-- Hard delete: wipes every row for this tenant across every business table,
-- then the tenant itself. Runs as one function body — a single Postgres
-- statement/function execution is already atomic, so a failure partway
-- through rolls back the whole thing, no partial wipe.
create or replace function public.super_admin_delete_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t text;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  foreach t in array array[
    'app_users', 'committee_info', 'members', 'chanda', 'donation_ads',
    'expenses', 'loans', 'activity_log', 'tasks', 'estimations'
  ]
  loop
    execute format('delete from public.%I where tenant_id = $1;', t) using p_tenant_id;
  end loop;

  delete from public.tenants where id = p_tenant_id;
end;
$$;
grant execute on function public.super_admin_delete_tenant(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Committee login now also checks the tenant is still active — a
--    disabled/deleted tenant's users can no longer log in, even with the
--    right password.
-- ----------------------------------------------------------------------------
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
  is_active boolean,
  tenant_id uuid,
  access_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user record;
  v_tenant_status text;
  v_jwt_secret text := '<PASTE_YOUR_JWT_SECRET_HERE>';
begin
  select u.id, u.name, u.username, u.is_admin, u.permissions,
         u.can_edit, u.can_delete, u.can_bulk_import, u.is_active, u.tenant_id
    into v_user
    from public.app_users u
    where u.username = p_username
      and u.password_hash = crypt(p_password, u.password_hash)
      and u.is_active = true;

  if v_user.id is null then
    return;
  end if;

  select t.status into v_tenant_status from public.tenants t where t.id = v_user.tenant_id;
  if v_tenant_status is distinct from 'active' then
    return;
  end if;

  return query select
    v_user.id, v_user.name, v_user.username, v_user.is_admin, v_user.permissions,
    v_user.can_edit, v_user.can_delete, v_user.can_bulk_import, v_user.is_active,
    v_user.tenant_id,
    public.jwt_sign(
      json_build_object(
        'role', 'authenticated',
        'sub', v_user.id,
        'tenant_id', v_user.tenant_id,
        'exp', extract(epoch from (now() + interval '7 days'))::integer
      )::jsonb,
      v_jwt_secret
    );
end;
$$;

grant execute on function public.login(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Done. Frontend next: a dedicated /super-admin route (separate login +
-- panel, not part of the committee app's session), a "Delete" action gated
-- by the same PIN-confirm modal already used elsewhere in this app.
-- ============================================================================
