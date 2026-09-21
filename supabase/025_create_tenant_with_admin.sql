-- ============================================================================
-- Fix: super_admin_create_tenant (022) only created the tenants row — no one
-- could ever log into a tenant created from the panel since it had zero
-- app_users. Replacing it with a version that creates the tenant AND its
-- first admin user (name/username/password) in one atomic function call.
-- Run this once, AFTER 024_developer_info_super_admin_only.sql.
-- ============================================================================

drop function if exists public.super_admin_create_tenant(text, text);

create or replace function public.super_admin_create_tenant(
  p_name text,
  p_slug text,
  p_admin_name text,
  p_admin_username text,
  p_admin_password text
)
returns table (
  id uuid, slug text, name text, status text, phone text, email text,
  address text, subscription_expires_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;

  insert into public.tenants (name, slug, status)
  values (p_name, p_slug, 'active')
  returning tenants.id into v_tenant_id;

  insert into public.app_users (name, username, password_hash, is_admin, tenant_id, permissions)
  values (
    p_admin_name, p_admin_username, crypt(p_admin_password, gen_salt('bf')), true, v_tenant_id,
    '{"members":true,"chanda":true,"donationAds":true,"expenses":true,"treasury":true,"settings":true,"loans":true,"vendors":true,"tasks":true,"estimation":true}'::jsonb
  );

  insert into public.committee_info (tenant_id, name)
  values (v_tenant_id, p_name);

  return query select t.id, t.slug, t.name, t.status, t.phone, t.email, t.address, t.subscription_expires_at, t.created_at
    from public.tenants t where t.id = v_tenant_id;
end;
$$;

grant execute on function public.super_admin_create_tenant(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
