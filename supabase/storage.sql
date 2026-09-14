-- ============================================================================
-- Storage bucket for the committee logo upload (Settings → Committee Info).
-- Run this AFTER schema.sql, once, in Supabase → SQL Editor.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Public read (so the logo displays on the login page / header for everyone)
drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

-- Anyone with the anon key can upload/replace/delete a logo — same security
-- note as schema.sql applies: gate this properly with Supabase Auth before
-- treating this as hardened. Fine for a small trusted committee tool.
drop policy if exists "logos_public_write" on storage.objects;
create policy "logos_public_write" on storage.objects
  for insert with check (bucket_id = 'logos');

drop policy if exists "logos_public_update" on storage.objects;
create policy "logos_public_update" on storage.objects
  for update using (bucket_id = 'logos');

drop policy if exists "logos_public_delete" on storage.objects;
create policy "logos_public_delete" on storage.objects
  for delete using (bucket_id = 'logos');
