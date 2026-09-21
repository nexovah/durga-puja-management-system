-- ============================================================================
-- Super Admin's own profile — name, email, phone 1/2, address, logo —
-- mirrors committee_info's fields but for the platform admin's own account.
-- Kept behind SECURITY DEFINER functions (not raw table grants) so
-- password_hash on super_admins never becomes selectable via the API.
-- Run this once, AFTER 028_tenant_user_limit_and_admin_create.sql.
-- ============================================================================

alter table public.super_admins
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists phone2 text,
  add column if not exists address text,
  add column if not exists logo_url text;

create or replace function public.super_admin_get_self()
returns table (
  id uuid, name text, username text, email text, phone text, phone2 text, address text, logo_url text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin_id uuid;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;
  v_admin_id := nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;

  return query
    select a.id, a.name, a.username, a.email, a.phone, a.phone2, a.address, a.logo_url
    from public.super_admins a
    where a.id = v_admin_id;
end;
$$;
grant execute on function public.super_admin_get_self() to anon, authenticated;

create or replace function public.super_admin_update_self(
  p_name text,
  p_email text,
  p_phone text,
  p_phone2 text,
  p_address text,
  p_logo_url text
)
returns table (
  id uuid, name text, username text, email text, phone text, phone2 text, address text, logo_url text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin_id uuid;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;
  v_admin_id := nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;

  update public.super_admins
    set name = p_name, email = p_email, phone = p_phone, phone2 = p_phone2, address = p_address, logo_url = p_logo_url
    where id = v_admin_id;

  return query
    select a.id, a.name, a.username, a.email, a.phone, a.phone2, a.address, a.logo_url
    from public.super_admins a
    where a.id = v_admin_id;
end;
$$;
grant execute on function public.super_admin_update_self(text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
