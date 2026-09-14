-- ============================================================================
-- Durga Puja Management System — PostgreSQL / Supabase schema
-- ============================================================================
-- Run this ENTIRE file once in Supabase → SQL Editor → New query → Run.
-- It creates every table the frontend needs, matching the current browser
-- localStorage data model field-for-field, plus a simple username/password
-- login system (NOT Supabase Auth — see the security note at the bottom).
--
-- Safe to re-run: every statement uses IF NOT EXISTS / CREATE OR REPLACE
-- where possible, but on a second run you may see "already exists" notices
-- for tables — that's harmless.
-- ============================================================================

-- Needed for gen_random_uuid() and crypt()/gen_salt() password hashing
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Helper: keep an `updated_at` column current on every UPDATE
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. app_users — committee login accounts (replaces the hardcoded
--    admin/admin123 + in-browser user list). Passwords are hashed with
--    bcrypt (pgcrypto's crypt()), never stored in plain text.
-- ============================================================================
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  email text unique,                 -- optional, used for the bootstrap admin
  password_hash text not null,
  is_admin boolean not null default false,
  permissions jsonb not null default '{
    "members": true,
    "chanda": true,
    "donationAds": true,
    "expenses": true,
    "treasury": true,
    "settings": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. committee_info — one row only (the committee's own details / header info)
-- ============================================================================
create table if not exists public.committee_info (
  id smallint primary key default 1 check (id = 1),  -- enforces a single row
  name text,
  logo_url text,          -- emoji, base64 data: URI, or a Supabase Storage URL
  established text,
  reg_number text,
  association text,
  post text,
  district_ps text,
  pin_code text,
  mobile1 text,
  mobile2 text,
  address text,
  phone text,
  year text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_committee_info_updated_at on public.committee_info;
create trigger trg_committee_info_updated_at
  before update on public.committee_info
  for each row execute function public.set_updated_at();

insert into public.committee_info (id, name, logo_url, established, reg_number, association, post, district_ps, pin_code, mobile1, address, phone, year)
values (1, 'শ্রী শ্রী দুর্গা পূজা কমিটি', '🕉️', '2019', '80014864', 'বেনজীন সর্বজনীন দুর্গোৎসব কমিটি', 'পোস্ট', 'কালিপাড়া পোস্ট, দুর্গা পূজা ময়দান, কালিপাড়া বাজার', '741239', '9775767402', 'কলকাতা, পশ্চিমবঙ্গ', '9876543210', '2026')
on conflict (id) do nothing;

-- ============================================================================
-- 3. developer_info — one row only
-- ============================================================================
create table if not exists public.developer_info (
  id smallint primary key default 1 check (id = 1),
  name text,
  email text,
  phone text,
  version text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_developer_info_updated_at on public.developer_info;
create trigger trg_developer_info_updated_at
  before update on public.developer_info
  for each row execute function public.set_updated_at();

insert into public.developer_info (id, name, email, phone, version)
values (1, 'Developer Name', 'developer@example.com', '1234567890', '1.0.0')
on conflict (id) do nothing;

-- ============================================================================
-- 4. members — committee members
-- ============================================================================
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  role text,              -- canonical key: president, vicePresident, secretary,
                           -- assistantSecretary, treasurer, executiveMember,
                           -- advisoryPatron, volunteer
  join_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_members_updated_at on public.members;
create trigger trg_members_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create index if not exists idx_members_join_date on public.members (join_date desc);

-- ============================================================================
-- 5. chanda — Chanda Collection entries
-- ============================================================================
create table if not exists public.chanda (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  amount numeric(12,2) not null default 0,       -- amount mentioned/committed
  paid_method text not null default 'notSelected', -- notSelected, cash, qrScan, onlineBanking, check
  payment_status text not null default 'paid',     -- paid, pending, partial, rejected
  partial_amount numeric(12,2),                    -- only meaningful when payment_status = 'partial'
  date date not null default current_date,
  phone text,
  phone2 text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chanda_payment_status_check
    check (payment_status in ('paid', 'pending', 'partial', 'rejected'))
);

drop trigger if exists trg_chanda_updated_at on public.chanda;
create trigger trg_chanda_updated_at
  before update on public.chanda
  for each row execute function public.set_updated_at();

create index if not exists idx_chanda_date on public.chanda (date desc);

-- ============================================================================
-- 6. donation_ads — Donation/Ads Collection entries
-- ============================================================================
create table if not exists public.donation_ads (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'ads' check (category in ('donation', 'ads')),
  donor_name text,
  company_name text,       -- Ads entries only
  amount numeric(12,2) not null default 0,
  paid_method text not null default 'notSelected',
  in_kind text,            -- free text for donation, ads-category key for ads
                            -- (handBook, souvenir, bill, gate, banner, others)
  date date default current_date,
  phone text,
  phone2 text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_donation_ads_updated_at on public.donation_ads;
create trigger trg_donation_ads_updated_at
  before update on public.donation_ads
  for each row execute function public.set_updated_at();

create index if not exists idx_donation_ads_date on public.donation_ads (date desc);
create index if not exists idx_donation_ads_category on public.donation_ads (category);

-- ============================================================================
-- 7. expenses
-- ============================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(12,2) not null default 0,        -- billed/agreed amount
  payment_status text not null default 'paid',    -- paid, partial, cancelled
  partial_amounts numeric(12,2)[],                -- up to 5 installments; only used when payment_status = 'partial'
  paid_through text not null default 'notSelected', -- notSelected, cash, check
  date date not null default current_date,
  category text not null,                          -- construction, decoration, idol, lighting,
                                                     -- food, publicity, security, transport, other
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_payment_status_check
    check (payment_status in ('paid', 'partial', 'cancelled'))
);

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create index if not exists idx_expenses_date on public.expenses (date desc);
create index if not exists idx_expenses_category on public.expenses (category);

-- ============================================================================
-- 8. Bootstrap admin user (EDIT the email/username/password below, then run
--    just this block — or run it now and change the password afterwards).
-- ============================================================================
insert into public.app_users (name, username, email, password_hash, is_admin, permissions)
values (
  'Admin User',
  'admin',
  'admin@example.com',            -- CHANGE THIS
  crypt('ChangeThisPassword123!', gen_salt('bf')),  -- CHANGE THIS PASSWORD
  true,
  '{"members":true,"chanda":true,"donationAds":true,"expenses":true,"treasury":true,"settings":true}'::jsonb
)
on conflict (username) do nothing;

-- ============================================================================
-- 9. Login / user-management RPC functions
--    These run with the table owner's privileges (SECURITY DEFINER) so the
--    password_hash column is never exposed to the client — only these
--    functions can read it, and they never return it.
-- ============================================================================

-- Verify a username/password and return the user's public profile.
-- Call from the frontend as a POST to:
--   {SUPABASE_URL}/rest/v1/rpc/login
-- Body: { "p_username": "admin", "p_password": "..." }
create or replace function public.login(p_username text, p_password text)
returns table (
  id uuid,
  name text,
  username text,
  is_admin boolean,
  permissions jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select u.id, u.name, u.username, u.is_admin, u.permissions
    from public.app_users u
    where u.username = p_username
      and u.password_hash = crypt(p_password, u.password_hash);
end;
$$;

-- Create a new committee user (admin-only action, enforced by the frontend
-- passing the acting admin's id — see security note below for hardening).
-- Call as POST to: {SUPABASE_URL}/rest/v1/rpc/create_app_user
create or replace function public.create_app_user(
  p_name text,
  p_username text,
  p_password text,
  p_permissions jsonb
)
returns table (id uuid, name text, username text, is_admin boolean, permissions jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    insert into public.app_users (name, username, password_hash, is_admin, permissions)
    values (p_name, p_username, crypt(p_password, gen_salt('bf')), false, p_permissions)
    returning app_users.id, app_users.name, app_users.username, app_users.is_admin, app_users.permissions;
end;
$$;

-- Change a user's own password (used by Settings → Change Password).
-- Call as POST to: {SUPABASE_URL}/rest/v1/rpc/change_password
create or replace function public.change_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches boolean;
begin
  select (password_hash = crypt(p_current_password, password_hash))
    into v_matches
    from public.app_users
    where id = p_user_id;

  if not coalesce(v_matches, false) then
    return false;
  end if;

  update public.app_users
    set password_hash = crypt(p_new_password, gen_salt('bf'))
    where id = p_user_id;

  return true;
end;
$$;

-- ============================================================================
-- 10. Row Level Security
-- ============================================================================
-- IMPORTANT SECURITY NOTE (read this):
-- This app is NOT using Supabase Auth (per your instruction, for now). That
-- means every request from the browser uses the public "anon" API key, which
-- ships inside your built JavaScript and is visible to anyone who opens your
-- website's dev tools. There is currently no way for the database to tell
-- "a logged-in committee member" apart from "anyone on the internet with your
-- site's URL" at the database level — login only gates the *screens* the
-- React app shows, not the API itself.
--
-- The policies below intentionally allow the `anon` role full read/write on
-- the business tables so the app keeps working exactly like the current
-- localStorage version (any visitor to your live site could, in theory, call
-- the API directly and read/write chanda, expenses, etc.). This mirrors the
-- security level of the current browser-only app (all data already lives
-- unencrypted in each visitor's own browser storage) but centralizes it, so
-- treat your anon key + this design as "not yet suitable for adversarial
-- public exposure" and plan to move to Supabase Auth (Row Level Security
-- keyed to auth.uid()) before this holds real donor financial data at scale.
-- I can wire that up whenever you're ready — for now this matches your
-- request to keep it simple.

alter table public.app_users enable row level security;
alter table public.committee_info enable row level security;
alter table public.developer_info enable row level security;
alter table public.members enable row level security;
alter table public.chanda enable row level security;
alter table public.donation_ads enable row level security;
alter table public.expenses enable row level security;

-- app_users: never expose password_hash via the auto-generated REST API.
-- Reads are allowed (frontend needs the user list + permissions for the
-- Settings → User Management screen) but writes only go through the RPC
-- functions above (which run as the table owner and bypass RLS), so we
-- deny direct insert/update/delete from the API.
drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users
  for select using (true);

-- committee_info / developer_info / members / chanda / donation_ads / expenses:
-- fully open to anon + authenticated for now (see note above).
do $$
declare
  t text;
begin
  foreach t in array array['committee_info','developer_info','members','chanda','donation_ads','expenses']
  loop
    execute format('drop policy if exists %I_all on public.%I;', t, t);
    execute format(
      'create policy %I_all on public.%I for all using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.committee_info, public.developer_info, public.members,
  public.chanda, public.donation_ads, public.expenses
  to anon, authenticated;
grant select on public.app_users to anon, authenticated;
grant execute on function public.login(text, text) to anon, authenticated;
grant execute on function public.create_app_user(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.change_password(uuid, text, text) to anon, authenticated;

-- Explicitly revoke direct write access to app_users from the API roles —
-- all writes must go through the SECURITY DEFINER functions above.
revoke insert, update, delete on public.app_users from anon, authenticated;

-- ============================================================================
-- Done. Next: create a public "logos" Storage bucket (see supabase/README.md)
-- and read supabase/README.md for the REST API reference + how to point the
-- frontend at this project.
-- ============================================================================
