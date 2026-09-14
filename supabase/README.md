# Supabase / PostgreSQL Backend

This folder is the complete database for the Durga Puja Management System: schema, security rules, and login functions. It mirrors the app's data model field-for-field, and the React frontend (`src/app/lib/db.ts`, `src/app/App.tsx`) is wired to read/write this database directly.

**Status**: the frontend is live-connected to Supabase — all pages (Members, Chanda, Donation/Ads, Expenses, Treasury, Settings, login) read and write here. It no longer uses `localStorage` for data. You just need to point your local/deployed build at your project (see "Connect the frontend" below).

## What's here
- `schema.sql` — every table (`app_users`, `committee_info`, `developer_info`, `members`, `chanda`, `donation_ads`, `expenses`), triggers, RLS policies, and the `login`/`create_app_user`/`change_password` functions.
- `002_user_management.sql` — two more functions the Settings → User Management screen needs: `update_app_user` (edit name/permissions/optionally reset password) and `delete_app_user`.
- `storage.sql` — a public `logos` file bucket for the committee logo upload (no separate file server needed — Supabase Storage serves it directly, and Settings → Committee Info uploads straight to it).

## 1. Create the Supabase project
1. Go to [supabase.com](https://supabase.com) → New project.
2. Pick a name/region, set a strong **database password** (save it — you'll want it if you ever need direct `psql` access), wait ~2 min for provisioning.

## 2. Run the schema
Run these 3 files, in order, in **SQL Editor → New query** (paste the whole file, click **Run**, repeat for the next file):
1. `schema.sql`
2. `002_user_management.sql`
3. `storage.sql`

**Before or right after running schema.sql**, edit the bootstrap admin block near the bottom of it (search for `CHANGE THIS`) and re-run just that block with your real admin email/username/password — or run it once with the placeholder and immediately call `change_password` (see below) to set a real one.

That's it — no "upload table by table" needed. The whole database is created by running these three files once.

## 2b. Connect the frontend
1. In the project root, copy `.env.example` to `.env`.
2. Fill in your `Project URL` and `anon` key (from Project Settings → API, see step 3 below):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run `npm i` (installs `@supabase/supabase-js`) then `npm run dev`. The app now loads its data from your Supabase project.
4. For a production build, the same two variables need to be present when you run `npm run build` (a local `.env` file for a manual build, or as build-step secrets/env vars for CI — see `DEPLOYMENT.md`), since Vite bakes them into the static output at build time.

## 3. Get your API keys
**Project Settings → API**:
- `Project URL` → this is `SUPABASE_URL`
- `anon` `public` key → this is `SUPABASE_ANON_KEY`

These two values are what the frontend will eventually be configured with (as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` environment variables, once wiring happens). They are safe to ship inside your public website's JavaScript — that's how Supabase's anon key is designed to work — but see the security note in `schema.sql` about what that means for this table setup.

## 4. The REST API (GET/POST/PATCH/DELETE)
Supabase auto-generates a full REST API (PostgREST) for every table — you don't write any backend code. Every table gets `GET`, `POST`, `PATCH`, `DELETE` at:

```
{SUPABASE_URL}/rest/v1/<table>
```

Every request needs these headers:
```
apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {SUPABASE_ANON_KEY}
Content-Type: application/json
```

### Examples

**List all chanda entries**
```bash
curl "{SUPABASE_URL}/rest/v1/chanda?select=*&order=date.desc" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}"
```

**Add a chanda entry**
```bash
curl -X POST "{SUPABASE_URL}/rest/v1/chanda" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "donor_name": "Amit Sharma",
    "amount": 5000,
    "payment_status": "paid",
    "paid_method": "cash",
    "date": "2026-01-15",
    "phone": "9876543212",
    "remarks": "First chanda"
  }'
```

**Update one (PATCH, filter by id)**
```bash
curl -X PATCH "{SUPABASE_URL}/rest/v1/chanda?id=eq.<uuid>" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "payment_status": "partial", "partial_amount": 2000 }'
```

**Delete one**
```bash
curl -X DELETE "{SUPABASE_URL}/rest/v1/chanda?id=eq.<uuid>" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}"
```

The same 4 verbs work identically for `members`, `donation_ads`, `expenses`, `committee_info` (single row, `id=eq.1`), `developer_info` (single row, `id=eq.1`).

### Login (POST to an RPC function)
```bash
curl -X POST "{SUPABASE_URL}/rest/v1/rpc/login" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "p_username": "admin", "p_password": "ChangeThisPassword123!" }'
```
Returns `[]` if the username/password don't match, or `[{ id, name, username, is_admin, permissions }]` on success. Never returns the password hash.

### Create a new committee user (admin action)
```bash
curl -X POST "{SUPABASE_URL}/rest/v1/rpc/create_app_user" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "p_name": "Sumon Das",
    "p_username": "sumon",
    "p_password": "TempPass123!",
    "p_permissions": {"members":true,"chanda":true,"donationAds":true,"expenses":true,"treasury":true,"settings":false}
  }'
```

### Change password
```bash
curl -X POST "{SUPABASE_URL}/rest/v1/rpc/change_password" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "p_user_id": "<uuid>", "p_current_password": "old", "p_new_password": "new" }'
```
Returns `true`/`false`.

### Upload the logo (Storage)
```bash
curl -X POST "{SUPABASE_URL}/storage/v1/object/logos/committee-logo.png" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -H "Content-Type: image/png" \
  --data-binary @/path/to/logo.png
```
Then the public URL is:
```
{SUPABASE_URL}/storage/v1/object/public/logos/committee-logo.png
```
Save that URL into `committee_info.logo_url`.

## 5. Field name mapping (frontend ↔ database)
The frontend's JS objects use camelCase; the database uses snake_case (Postgres convention). Nothing else differs — types and meaning are identical.

| Frontend (App.tsx) | Database column |
|---|---|
| `donorName` | `donor_name` |
| `companyName` | `company_name` |
| `paidMethod` | `paid_method` |
| `paymentStatus` | `payment_status` |
| `partialAmount` | `partial_amount` |
| `partialAmounts` (array of 5) | `partial_amounts` (Postgres array) |
| `paidThrough` | `paid_through` |
| `inKind` | `in_kind` |
| `phone2` | `phone2` |
| `joinDate` | `join_date` |
| `regNumber` | `reg_number` |
| `districtPS` | `district_ps` |
| `pinCode` | `pin_code` |
| `logo` | `logo_url` |

## 6. How the frontend is wired (for reference)
- `src/app/lib/supabaseClient.ts` — creates the `@supabase/supabase-js` client from your env vars.
- `src/app/lib/db.ts` — every read/write and the camelCase↔snake_case field mapping. `fetchAllData()` loads everything once on app start; `syncMembers`/`syncChanda`/`syncDonationAds`/`syncExpenses` diff an old array against a new one and issue the minimal insert/update/delete calls, so Members/Chanda/Donation-Ads/Expenses pages keep calling `setX(wholeNewArray)` exactly like they did with localStorage — no page UI changed.
- User management (create/edit/delete/password) goes through the RPC functions, not direct table writes, since `app_users` writes are blocked for the API roles (see the RLS section below).
- A future mobile app can either use the same `@supabase/supabase-js` client, or call the REST endpoints in section 4 directly with any HTTP client — same database either way.

## 7. Security note (please read)
See the long comment block near the bottom of `schema.sql`. Short version: because there's no Supabase Auth yet, the API is reachable by anyone with your site's anon key (which ships in your public JS bundle) — login only gates the *app's screens*, not the database itself. This matches the trust level of today's browser-only app (nothing was ever truly private in localStorage either), but it's worth moving to real Supabase Auth + Row Level Security before this holds sensitive donor data at real scale. Say the word whenever you want that upgrade.
