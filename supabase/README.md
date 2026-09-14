# Supabase / PostgreSQL Backend

This folder is the complete database for the Durga Puja Management System: schema, security rules, and login functions. It mirrors the app's current browser-localStorage data model field-for-field, so nothing about the UI needs to change to use it.

**Status**: this gives you a working Postgres database + REST API on Supabase. The React frontend still reads/writes `localStorage` today — wiring the two together (swapping the `useState`/`localStorage` calls in `src/app/App.tsx` for calls to this API) is a separate, later step, once you've confirmed the schema looks right.

## What's here
- `schema.sql` — every table (`app_users`, `committee_info`, `developer_info`, `members`, `chanda`, `donation_ads`, `expenses`), triggers, RLS policies, and 3 login/user-management functions.
- `storage.sql` — a public `logos` file bucket for the committee logo upload (no separate file server needed — Supabase Storage serves it directly).

## 1. Create the Supabase project
1. Go to [supabase.com](https://supabase.com) → New project.
2. Pick a name/region, set a strong **database password** (save it — you'll want it if you ever need direct `psql` access), wait ~2 min for provisioning.

## 2. Run the schema
1. In your project, open **SQL Editor** → **New query**.
2. Open `schema.sql` from this folder, copy the whole file, paste it in, click **Run**.
3. Open a new query, paste `storage.sql`, click **Run**.
4. **Before or right after running schema.sql**, edit the bootstrap admin block near the bottom (search for `CHANGE THIS`) and re-run just that block with your real admin email/username/password — or run it once with the placeholder and immediately call `change_password` (see below) to set a real one.

That's it — no "upload table by table" needed. The whole database is created by running these two files once.

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

## 6. Once you're ready to wire the frontend
Two options when that day comes:
1. **Direct REST calls** (`fetch`) — works from any client, including a future mobile app, no extra dependency.
2. **`@supabase/supabase-js` client** — a thin wrapper around the same REST API with a nicer JS interface (`supabase.from('chanda').select()` etc.) and built-in retry/typing. Recommended for the React app; either way hits the exact same database.

I can do this wiring whenever you say go — it's a contained change to `src/app/App.tsx` and each page component's `handleSubmit`/`handleDelete` functions, no schema changes needed.

## 7. Security note (please read)
See the long comment block near the bottom of `schema.sql`. Short version: because there's no Supabase Auth yet, the API is reachable by anyone with your site's anon key (which ships in your public JS bundle) — login only gates the *app's screens*, not the database itself. This matches the trust level of today's browser-only app (nothing was ever truly private in localStorage either), but it's worth moving to real Supabase Auth + Row Level Security before this holds sensitive donor data at real scale. Say the word whenever you want that upgrade.
