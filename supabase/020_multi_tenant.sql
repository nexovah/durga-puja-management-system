-- ============================================================================
-- Multi-tenant conversion — Phase 2.
-- Run this ENTIRE file once in Supabase -> SQL Editor, AFTER 019_leads.sql.
--
-- BEFORE RUNNING: take a backup (Supabase Dashboard -> Database -> Backups,
-- or pg_dump) — this migration changes RLS on every table and is the
-- highest-risk migration in this project so far.
--
-- YOU MUST EDIT ONE VALUE BELOW: search for <PASTE_YOUR_JWT_SECRET_HERE>
-- and replace it with your project's real JWT secret, found at
-- Supabase Dashboard -> Project Settings -> API -> JWT Settings -> JWT Secret.
-- This is required so the tokens this migration's login() function signs are
-- accepted by PostgREST (which verifies against that same secret). This
-- secret stays inside your database — it is never sent to the frontend or
-- committed to the repo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. jwt_sign() — small self-contained HS256 JWT signer using pgcrypto's
--    hmac() directly. (pgjwt's own sign() turned out to call an unqualified
--    hmac() that doesn't resolve on this project's search_path — this
--    avoids depending on it at all.)
-- ----------------------------------------------------------------------------
create or replace function public.jwt_sign(payload jsonb, secret text)
returns text
language plpgsql
stable
as $$
declare
  header text := '{"alg":"HS256","typ":"JWT"}';
  header_b64 text;
  payload_b64 text;
  signing_input text;
  signature_b64 text;
begin
  header_b64 := rtrim(translate(replace(encode(convert_to(header, 'utf8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
  payload_b64 := rtrim(translate(replace(encode(convert_to(payload::text, 'utf8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
  signing_input := header_b64 || '.' || payload_b64;
  signature_b64 := rtrim(translate(replace(encode(extensions.hmac(signing_input, secret, 'sha256'), 'base64'), E'\n', ''), '+/', '-_'), '=');
  return signing_input || '.' || signature_b64;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. tenants — one row per committee.
-- ----------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
  created_at timestamptz not null default now()
);

-- Tenant #1 — the existing live committee. Backfilled below.
insert into public.tenants (id, slug, name, status)
values ('00000000-0000-0000-0000-000000000001', 'paschim-pansila', 'Paschim Pansila Sarbojanin Saradatsav', 'active')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Add tenant_id to every business table + backfill as Tenant #1.
--    (developer_info stays a true global singleton — not tenant-scoped.)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users', 'committee_info', 'members', 'chanda', 'donation_ads',
    'expenses', 'loans', 'activity_log', 'tasks', 'estimations'
  ]
  loop
    execute format('alter table public.%I add column if not exists tenant_id uuid;', t);
    execute format(
      'update public.%I set tenant_id = %L where tenant_id is null;',
      t, '00000000-0000-0000-0000-000000000001'
    );
    execute format('alter table public.%I alter column tenant_id set not null;', t);
    execute format(
      'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id);',
      t, t || '_tenant_id_fkey'
    );
    execute format('create index if not exists %I on public.%I (tenant_id);', 'idx_' || t || '_tenant_id', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. committee_info: was a hard singleton (id=1). Becomes one row per tenant.
-- ----------------------------------------------------------------------------
alter table public.committee_info drop constraint if exists committee_info_pkey;
alter table public.committee_info drop constraint if exists committee_info_id_check;
alter table public.committee_info alter column id drop default;
alter table public.committee_info alter column id type uuid using gen_random_uuid();
alter table public.committee_info alter column id set default gen_random_uuid();
alter table public.committee_info add primary key (id);
alter table public.committee_info add constraint committee_info_tenant_id_unique unique (tenant_id);

-- ----------------------------------------------------------------------------
-- 4. app_users: username uniqueness moves from global to per-tenant.
-- ----------------------------------------------------------------------------
alter table public.app_users drop constraint if exists app_users_username_key;
alter table public.app_users add constraint app_users_tenant_username_unique unique (tenant_id, username);

-- ----------------------------------------------------------------------------
-- 5. current_tenant_id() — reads the tenant_id claim out of the verified JWT
--    PostgREST attaches to every authenticated request. Returns null for
--    anon (unauthenticated) requests, which makes every tenant-scoped policy
--    below deny access by default until a valid per-tenant token is sent.
-- ----------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'tenant_id', '')::uuid
$$;

-- ----------------------------------------------------------------------------
-- 6. Flip RLS: every tenant-scoped table now requires
--    tenant_id = current_tenant_id() instead of using(true).
--    app_users keeps its existing "select using(true)" -> tightened too,
--    since usernames/permissions of other tenants shouldn't be visible.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users', 'committee_info', 'members', 'chanda', 'donation_ads',
    'expenses', 'loans', 'tasks', 'estimations'
  ]
  loop
    -- Drop every pre-existing policy on the table, whatever it was named.
    execute (
      select coalesce(string_agg(format('drop policy if exists %I on public.%I;', policyname, t), ' '), '')
      from pg_policies where schemaname = 'public' and tablename = t
    );
    execute format(
      'create policy %I on public.%I for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());',
      t || '_tenant_isolation', t
    );
  end loop;
end $$;

-- activity_log: append-only (select + insert only, no update/delete), same
-- tenant-scoping.
drop policy if exists activity_log_select on public.activity_log;
drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_select on public.activity_log
  for select using (tenant_id = public.current_tenant_id());
create policy activity_log_insert on public.activity_log
  for insert with check (tenant_id = public.current_tenant_id());

-- ----------------------------------------------------------------------------
-- 7. login(): now resolves + returns tenant_id, and signs a short-lived JWT
--    (7 days, matching the frontend's existing session length) carrying
--    { role: authenticated, sub: user_id, tenant_id }. The frontend attaches
--    this token as "Authorization: Bearer <token>" on every request after
--    login — that's what current_tenant_id() above reads.
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

-- ----------------------------------------------------------------------------
-- 8. create_app_user / update_app_user: stamp new users with the *caller's*
--    tenant_id (read from the same JWT claim used by RLS above) so a
--    committee admin can never accidentally create a user in another tenant.
-- ----------------------------------------------------------------------------
drop function if exists public.create_app_user(text, text, text, jsonb, boolean, boolean, boolean);
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
begin
  return query
    insert into public.app_users (name, username, password_hash, is_admin, permissions, can_edit, can_delete, can_bulk_import, tenant_id)
    values (p_name, p_username, crypt(p_password, gen_salt('bf')), false, p_permissions, p_can_edit, p_can_delete, p_can_bulk_import, public.current_tenant_id())
    returning app_users.id, app_users.name, app_users.username, app_users.is_admin, app_users.permissions,
              app_users.can_edit, app_users.can_delete, app_users.can_bulk_import, app_users.is_active, app_users.tenant_id;
end;
$$;

grant execute on function public.create_app_user(text, text, text, jsonb, boolean, boolean, boolean) to anon, authenticated;

-- ============================================================================
-- Done. Next steps (handled in the frontend, not this SQL):
--   - LoginPage/loginRequest now receives + must store `access_token` and
--     `tenant_id` alongside the user, and attach the token as
--     "Authorization: Bearer <token>" on every subsequent Supabase call.
--   - A second tenant created later (Phase 3, Super Admin panel) will need
--     its own tenants row + at least one app_users row with that tenant_id
--     before anyone can log into it.
-- ============================================================================
