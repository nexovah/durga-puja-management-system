-- ============================================================================
-- Phase 3b — richer tenant profile + manual subscription/credit assignment.
-- Run this once, AFTER 022_super_admin.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tenants: contact details + subscription expiry.
-- ----------------------------------------------------------------------------
alter table public.tenants
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists subscription_expires_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. subscription_credits — an append-only log every time a Super Admin
--    manually grants a period of access. Doubles as the billing-history
--    rows a tenant's future Billing page (Phase 4) will render. Amounts are
--    the SAME plan pricing shown on the marketing landing page, recorded
--    here as a negative "spend" (see amount_paise: negative = debit against
--    the tenant's account, matching how the SaaS Billing page should read
--    it once built) — this is manual/no Razorpay yet; Razorpay integration
--    (Phase 4) will insert rows here the same shape once wired up.
-- ----------------------------------------------------------------------------
create table if not exists public.subscription_credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  period text not null check (period in ('monthly', 'yearly')),
  amount_paise integer not null,        -- negative = debit, e.g. -49900 for a ₹499 month
  note text,
  granted_by uuid references public.super_admins(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_credits_tenant_id on public.subscription_credits (tenant_id);

alter table public.subscription_credits enable row level security;
-- No anon/authenticated RLS policy at all — only reachable via the
-- SECURITY DEFINER functions below (super admin) or the tenant's own
-- Billing page function (added in Phase 4). Deny-by-default is correct here.

-- ----------------------------------------------------------------------------
-- 2b. super_admin_delete_tenant (022) predates subscription_credits, so it
--     doesn't clear it before deleting the tenant row — would fail on the
--     new foreign key. Redefining it here to include that table too.
-- ----------------------------------------------------------------------------
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
    'expenses', 'loans', 'activity_log', 'tasks', 'estimations',
    'subscription_credits'
  ]
  loop
    execute format('delete from public.%I where tenant_id = $1;', t) using p_tenant_id;
  end loop;

  delete from public.tenants where id = p_tenant_id;
end;
$$;
grant execute on function public.super_admin_delete_tenant(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Super Admin: update tenant details.
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_update_tenant(
  p_tenant_id uuid,
  p_name text,
  p_slug text,
  p_phone text,
  p_email text,
  p_address text
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
    set name = p_name, slug = p_slug, phone = p_phone, email = p_email, address = p_address
    where id = p_tenant_id
    returning * into v_tenant;

  return v_tenant;
end;
$$;
grant execute on function public.super_admin_update_tenant(uuid, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Super Admin: grant a subscription period. Extends from the tenant's
--    current expiry if it's still in the future, otherwise from now — so
--    granting a month to an already-active tenant adds to their remaining
--    time instead of shortening it.
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_grant_subscription(
  p_tenant_id uuid,
  p_period text,
  p_amount_paise integer,
  p_note text default null
)
returns public.tenants
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant public.tenants;
  v_base timestamptz;
  v_admin_id uuid;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;
  if p_period not in ('monthly', 'yearly') then
    raise exception 'invalid period: %', p_period;
  end if;

  v_admin_id := nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;

  select t.subscription_expires_at into v_base from public.tenants t where t.id = p_tenant_id;
  if v_base is null or v_base < now() then
    v_base := now();
  end if;

  update public.tenants
    set subscription_expires_at = v_base + (case when p_period = 'monthly' then interval '1 month' else interval '1 year' end)
    where id = p_tenant_id
    returning * into v_tenant;

  insert into public.subscription_credits (tenant_id, period, amount_paise, note, granted_by)
  values (p_tenant_id, p_period, -abs(p_amount_paise), p_note, v_admin_id);

  return v_tenant;
end;
$$;
grant execute on function public.super_admin_grant_subscription(uuid, text, integer, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Super Admin: list a tenant's subscription/credit history.
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_list_subscription_credits(p_tenant_id uuid)
returns setof public.subscription_credits
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;
  return query select * from public.subscription_credits where tenant_id = p_tenant_id order by created_at desc;
end;
$$;
grant execute on function public.super_admin_list_subscription_credits(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Committee login now also returns subscription_expires_at, so the
--    frontend can lock the app into a read-only "out of subscription"
--    state once it's passed, without a separate round trip.
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
  access_token text,
  subscription_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user record;
  v_tenant record;
  v_jwt_secret text := '/HFvwjK/AcCpecZxkLtk5xCMIuEaUhnepdJRAoXkTzGynyqIOK/9PBQLya0zc8uxazaOFCyy9J4Jzbzgk2wopQ==';
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

  select t.status, t.subscription_expires_at into v_tenant from public.tenants t where t.id = v_user.tenant_id;
  if v_tenant.status is distinct from 'active' then
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
    ),
    v_tenant.subscription_expires_at;
end;
$$;

grant execute on function public.login(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Super Admin: change own password.
-- ----------------------------------------------------------------------------
create or replace function public.super_admin_change_password(p_current_password text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin_id uuid;
  v_matches boolean;
begin
  if not public.is_super_admin_request() then
    raise exception 'not authorized';
  end if;
  v_admin_id := nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;

  select (password_hash = crypt(p_current_password, password_hash))
    into v_matches
    from public.super_admins
    where id = v_admin_id;

  if not coalesce(v_matches, false) then
    return false;
  end if;

  update public.super_admins
    set password_hash = crypt(p_new_password, gen_salt('bf'))
    where id = v_admin_id;

  return true;
end;
$$;
grant execute on function public.super_admin_change_password(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Done. Marketing-page content management (item from the same request) is
-- deliberately a separate follow-up migration — it's an unrelated concern
-- (editable landing-page copy, not tenant/billing data) and doesn't need to
-- block this one.
-- ============================================================================
