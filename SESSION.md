# SESSION.md

Running log of updates made to this project. Newest entries on top.

---

## 2026-09-14 (13)
- Wired the frontend to Supabase — removed all `localStorage` data persistence.
- Added `supabase/002_user_management.sql` (`update_app_user`, `delete_app_user` RPCs for Settings → User Management).
- New `src/app/lib/supabaseClient.ts` (client from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) and `src/app/lib/db.ts` (camelCase↔snake_case mapping, `fetchAllData()`, generic diff-based `syncMembers`/`syncChanda`/`syncDonationAds`/`syncExpenses`, `updateCommitteeInfo`/`updateDeveloperInfo`, `uploadLogo()` to the `logos` Storage bucket, and `loginRequest`/`createUserRequest`/`updateUserRequest`/`deleteUserRequest`/`changeOwnPasswordRequest` RPC wrappers).
- `App.tsx`: fetches everything from Supabase on mount (loading spinner + "not configured" screen), list setters now diff-sync to the DB with rollback + error alert on failure, login is async via the `login` RPC.
- `LoginPage.tsx`: `onLogin`/`handleSubmit` now async, submit button shows "Logging in…" while pending; removed the hardcoded "Default login: admin/admin123" hint (credentials are DB-managed now).
- `Settings.tsx`: user management (create/edit/delete/password reset) now goes through the RPC functions instead of a local array — `password` field only required when creating a new user (optional "leave blank to keep unchanged" when editing); own-password change verified server-side via `change_password` RPC; committee logo upload now calls `uploadLogo()` (Supabase Storage) instead of embedding base64 in local state.
- `Members.tsx`/`ChandaCollection.tsx`/`DonationAdsCollection.tsx`/`Expenses.tsx`/`Settings.tsx`: changed new-record id generation from `Date.now().toString()` to `crypto.randomUUID()` (required for Postgres `uuid` primary keys) — no other changes, all page UI/CRUD logic untouched.
- Added `@supabase/supabase-js` dependency, `.env.example`.
- Updated `supabase/README.md`/`AGENTS.md`/`README.md`/`DEPLOYMENT.md` to reflect the frontend now being live-wired (not a future step).
- Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (12)
- Delivered the PostgreSQL/Supabase backend: `supabase/schema.sql` (all 6 tables — app_users, committee_info, developer_info, members, chanda, donation_ads, expenses — matching the localStorage data model field-for-field, RLS, triggers, and `login`/`create_app_user`/`change_password` RPC functions using bcrypt via pgcrypto, per explicit request to skip Supabase Auth for now), `supabase/storage.sql` (public `logos` bucket for the committee logo), `supabase/README.md` (setup steps + REST API reference with curl examples + field-name mapping + security note about the anon key having full table access without Supabase Auth).
- Added `DEPLOYMENT.md`: Hostinger static hosting (manual upload or GitHub Actions auto-deploy) + Supabase backend pointers.
- Frontend NOT yet wired to the new API — still on localStorage; that's a deliberate next step, not done in this pass since the user wanted to review the schema first.
- Updated README.md/AGENTS.md to reference the new supabase/ and DEPLOYMENT.md files. Pushed to `main`.

## 2026-09-14 (11)
- Expenses: added Payment Status (Paid/Partially Paid/Cancelled) after Amount, plus Paid Through (Not Selected/Cash/Check Payment). Partially Paid reveals 5 side-by-side "Partial Amount 1-5" fields (field 1 required); their sum is validated on submit against the billed amount (blocks save with an alert if exceeded). New `getExpenseCreditAmount()` helper drives every total: Paid→full, Partial→sum of installments, Cancelled→0. Applied consistently across Expenses total, category summary, Dashboard tile, Treasury totals/monthly report/expense categories. Table amount cell: cancelled = red+strikethrough, partial = yellow→green once fully covered. CSV export/import extended. Backward-compat defaults applied on load. Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (10)
- Donation/Ads Collection: Amount field no longer mandatory in add/edit form — lets a record be created early (category, donor, company, phone, etc.) with the amount filled in later when money is actually collected. Empty amount defaults to 0. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (9)
- Added "Paid Method" dropdown (Not Selected [default], Cash, QR Scan, Online Banking, Check Payment) right after Amount in Chanda Collection and both Donation/Ads Collection entry types. New `PaidMethod` type + `paidMethod` field on `Chanda`/`DonationAd`. Table columns and CSV export/import updated for both pages. Backward-compat: existing records default to "Not Selected". Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.
- Chanda table: amount cell now styled by payment status — red + strikethrough for Rejected, yellow for Partially Paid.

## 2026-09-14 (8)
- Chanda Collection: added Payment Status field (Paid/Pending/Partially Paid/Rejected) after Amount. Partially Paid reveals a "Paid Amount (Partial)" input. New `getChandaCreditAmount()` helper in App.tsx is the sole logic for how much of a record counts toward totals — used consistently across Chanda page total, Dashboard tile, Treasury totals/monthly report/top donors. Backward-compat: old records default to 'paid'. CSV export/import updated. Translated EN/BN/HI.
- Donation/Ads Collection: table view only — moved Category column from first to right after Amount (form and CSV export/import left unchanged, per explicit request).
- Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (7)
- Chanda Collection and Donation/Ads Collection: existing Phone field relabeled "Phone Number 1", new optional "Phone Number 2" field added to both. Data models (`Chanda.phone2`, `DonationAd.phone2`), forms, table columns, CSV export/import all updated. Translated (EN/BN/HI). Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (6)
- Members: Designation changed from free text to a dropdown (President, Vice President, Secretary, Assistant Secretary, Treasurer, Executive/General Members, Advisory Committee/Patrons, Volunteer). Stored as canonical key, displayed translated. Seed data updated. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (5)
- Added CSV Import for Chanda Collection and Donation/Ads Collection, alongside existing Export.
- New `src/app/lib/csv.ts`: shared RFC4180-style CSV parse/serialize helpers (handles quoted fields with commas).
- Import button styled grey `#383737` / white text, placed left of Export in both pages' header actions.
- Donation/Ads import resolves category and Ads Category values against labels in any of EN/BN/HI (or canonical keys), so re-importing an export works regardless of the language it was exported in.
- Added `common.import` / `common.importResult` translations. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (4)
- Donation/Ads Collection: for Ads Collection entries, replaced the "Donation in Kinds" free-text field with an "Ads Category" dropdown (Hand Book, Souvenir, Bill, Gate, Banner, Others). Donation Collection entries unchanged (still free-text "Donation in Kinds").
- Form, table column, and CSV export adapt per entry's category (`inKindDisplay` resolves the stored value to a translated label for Ads, raw text for Donation).
- Translated new keys (EN/BN/HI). Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (3)
- Added "Donation/Ads Collection" page/nav tab (`DonationAdsCollection.tsx`), separate from Chanda Collection.
- Add-New form has a Category select first (Donation Collection / Ads Collection, default Ads); fields switch dynamically — Donation: donor's name*, amount*, donation in kinds, date, phone, remarks. Ads: donor's name, company name, amount*, donation in kinds, date, phone, remarks.
- New `DonationAd` model + `puja-donation-ads` localStorage key; new `donationAds` permission (nav gating + Settings checkbox), with backward-compat migration for existing saved users.
- Dashboard: new tile for Donation/Ads Collection total.
- Treasury: Chanda + Donation/Ads now combine into grand credit; balance = grand credit − expenses. Monthly report and top donors updated to include both sources.
- Fully translated (EN/BN/HI).
- Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (2)
- Added multilingual support: English, Bengali, Hindi.
- New `src/app/i18n/` module: `translations.ts` (dictionaries) + `LanguageContext.tsx` (provider/hook). Default language English; persisted to `localStorage`.
- New "Language" tab in Settings to switch language.
- Translated all UI chrome across App.tsx, LoginPage, Dashboard, Members, ChandaCollection, Expenses, Treasury, Settings (nav, buttons, labels, form placeholders, table headers, confirm dialogs, CSV export headers, expense categories).
- Expense categories now stored as canonical keys (e.g. `construction`) instead of raw Bengali text, displayed via translation lookup.
- Dates now localize per selected language (`bn-IN`/`hi-IN`/`en-IN`).
- Fixed pre-existing bug: `ExpensesProps` type was referenced but never defined in Expenses.tsx.
- Verified `npm run build` passes.
- Pushed to `main`.

## 2026-09-14
- Created private GitHub repo `nexovah/durga-puja-management-system`, pushed initial codebase (`main` branch).
- Added `.gitignore` (node_modules, dist, .env, logs, .DS_Store).
- Added `AGENTS.md` — project knowledge base (stack, architecture, features) for AI agents.
- Added `SESSION.md` (this file) — change log.
- Updated `README.md` with structured overview, dev commands, links to AGENTS.md/SESSION.md.
- Verified dev server runs at http://localhost:5173.
