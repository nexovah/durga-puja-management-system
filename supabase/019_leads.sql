-- Marketing landing page lead-capture table.
-- Committees requesting access via the public landing page at "/" get a row
-- here; no auth required to insert (public anon insert), no auth required to
-- read either yet since there's no Super Admin panel to view it from until
-- Phase 3 — RLS still follows this project's existing "client-side-trust"
-- model for now.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  committee_name text not null,
  contact_name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "leads_all" on public.leads
  for all
  using (true)
  with check (true);
