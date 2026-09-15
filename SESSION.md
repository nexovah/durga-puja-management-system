# SESSION.md

Running log of updates made to this project. Newest entries on top.

---

## 2026-09-15 (10)
- Tasks: click a title (or new Eye icon) to open a read-only **view modal** with full details incl. who created it. **Only the task's creator or an admin can Edit/Delete/Mark Complete** it now — everyone else with the Tasks permission can still view every task. New migration `supabase/014_tasks_creator.sql` — **run in Supabase SQL Editor**.

## 2026-09-15 (9)
- Tasks: new **Completed** priority (green) + two tabs above the table — **All Tasks** / **Completed**, each with a live count. Marking a task Completed (via the Priority dropdown or a new one-click checkmark action) moves it to the Completed tab. New migration `supabase/013_tasks_completed_priority.sql` — **run in Supabase SQL Editor**.

## 2026-09-15 (8)
- Tasks gain **Assign To** (multi-select of saved Members, checkbox dropdown), **Task Created** (read-only, auto today), **Task Expiry** (defaults created+15 days, editable). Members page gets an always-visible "Assigned Tasks" column showing every task assigned to that member (colored-dot badge per priority). New migration `supabase/012_tasks_assign_expiry.sql` — **run in Supabase SQL Editor**.

## 2026-09-15 (7)
- New **Tasks** menu in the ⋮ more-menu (between Loans and Settings): simple internal to-do list — Title, Description, Priority (High/Medium/Low/Note, 4-color badges), auto-captured created date/time. Filterable by name/priority/date, paginated. New `tasks` permission (Settings checkbox, default on). Logs to Activity Log. New migration `supabase/011_tasks.sql` — **run in Supabase SQL Editor**.

## 2026-09-15 (6)
- **Members**: new optional "Membership Payment" collapsible section (full-width dashed-border toggle, plus/chevron icon) below the Name/Phone/Address/Designation fields on Add/Edit Member — Amount, Paid Method, Payment Status, Partial Amount (when partial), Date, Bill Number, Remarks (reuses Chanda's vocabulary). `getMemberCreditAmount()` folds a member's paid/partial membership payment into every grand-total: Dashboard stat tiles, Dashboard chart income + summary, Dashboard category-totals bar chart (new 6th "Membership" pillar), Treasury totalCredit/balance. Members page header shows a "Total Membership Payments" pill next to the title — no separate widget card. New migration `supabase/010_member_membership_payment.sql` (7 nullable columns) — **run in Supabase SQL Editor**.

## 2026-09-15
- New **Activity Log** page in the ⋮ more-menu (after Settings): append-only `activity_log` table (RLS grants select+insert only — no update/delete, so entries can't be tampered with once written). Every create/edit/delete/bulk-import across Members, Chanda, Donation/Ads, Expenses, Loans and User Management logs one row (`ActivityLog.tsx`, `logActivity`/`fetchActivityLog` in `db.ts`, `onLog` prop threaded into all 5 CRUD pages via `App.tsx`'s `handleLog`). Filterable by module/action, refreshable, shows user/time/action/module/details.
- **Access Level** is now 3-tier instead of 2: View Only / Can Edit & Manage (no delete) / Can Edit, Manage & Delete. New `app_users.can_delete` column — edit rights no longer imply delete rights. Delete buttons in Members/Chanda/Donation-Ads/Expenses/Loans now gate on `canDelete` separately from `canEdit`.
- New per-user **Bulk Upload** toggle (`app_users.can_bulk_import`), shown under Access Level in the user form only when the user can edit. Gates the CSV Import button on Chanda/Donation-Ads/Expenses/Loans independently of edit/delete rights — lets an admin give someone add/edit access without risking a bulk-import wiping the database.
- Vendor menu now has its own `vendors` permission checkbox in Settings → User Management (previously piggy-backed on `expenses`); existing users are migrated to keep their current Vendor access.
- New migration `supabase/009_activity_log_and_permissions.sql` — adds `can_delete`/`can_bulk_import` columns, creates `activity_log`, recreates `login`/`create_app_user`/`update_app_user` RPCs to carry the new fields, and merges `vendors` permission for existing users. **User must run this in Supabase SQL Editor.**
- Verified `npm run build` passes. Pushed to `main`.

## 2026-09-15 (3)
- **Pagination** added to every table: Members, Chanda Collection, Donation/Ads Collection, Expenses, Loans, Vendors, Activity Log. Shared `Pagination.tsx` — `usePagination<T>()` hook + `<Pagination>` control (First/Back/5-number-window+ellipsis+Last/Next/Last, current page in theme orange, mobile responsive), "Results per page" selector (10/20/50/100, default 20), and an "X–Y of Z" count. No DB changes, client-side slice.

## 2026-09-15 (2)
- Dashboard chart: Income now includes Loans (net received) alongside Chanda + Donation/Ads; bottom-line label renamed "Net Balance" → "New Balance".
- Dashboard "Collections vs Expenses" row split 3:1: chart keeps 3 columns, new `DashboardCategoryBars.tsx` bar chart takes the 4th — 5 pillars (Chanda paid, Donation, Ads, Expenses, Loan received), each an all-time total (not tied to the chart's date-range selector), amount labelled above each bar. No DB changes — reuses data already loaded for the other pages.
- Verified `npm run build` passes. Pushed to `main`.

---

## 2026-09-15 (25)
- Header mobile fix: Logout is now icon-only on mobile (LogOut icon, text returns at sm+), same row as logo/name. Address/regd/phone detail line under the name was hidden below sm — now always visible, wraps on narrow screens.
- Donation/Ads Collection: new "Voucher/Bill Number" field, shown only when Category = Donation Collection, right after Date; resets when switching to Ads. Table view unchanged (avoids extra column); available via edit form and CSV.
- New `supabase/008_donation_ads_voucher.sql`: adds `donation_ads.voucher_number`.
- Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-15 (24)
- Nav: moved the "⋮" (more) menu to after the search icon (far right), and moved Settings into it alongside Vendor and Loans — fewer items in the main nav row.
- Chanda Collection: new "Bill Number" field (same row as Date, with Phone 1 + Phone 2 as their own row right after). New optional "Amount 01" / "Amount 02" fields below Amount — freely editable, and whenever either is non-blank the main Amount auto-updates to their sum; blank keeps Amount as a normal manual field. `amount1`/`amount2` stored for the breakdown, `amount` stays the single total used everywhere. Table gained a Bill Number column. CSV updated.
- New `supabase/007_chanda_bill_subamounts.sql`: adds `chanda.bill_number`, `amount1`, `amount2`.
- Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-15 (23)
- Loans: split single Amount field into "Amount Received" (credit from lender) and "Amount Paid" (repaid so far, default 0). New `getLoanNetAmount` = received - paid, the outstanding balance held from that lender.
- This net now feeds into the app's grand credit total everywhere Chanda/Donation-Ads already do: new Dashboard "Loans Outstanding" tile, new Treasury "Loans Outstanding" summary card, both included in totalCredit/balance. Not broken into Treasury's monthly/top-donor/category breakdowns (no repayment-date field to bucket `amountPaid` by).
- New `supabase/006_loans_amount_paid.sql`: renames `loans.amount` → `amount_received`, adds `amount_paid`.
- CSV export/import, form, and table updated to the two-field shape. Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-15 (22)
- Fixed the "⋮" (more) nav dropdown not opening — it was inside the scrollable nav-buttons row (`overflow-x-auto`), which clips vertical overflow too, hiding the panel. Moved it out next to the search icon.
- Vendors page redesigned: rows now merge by Name + Contact (case-insensitive) instead of one row per expense — shows Total Amount Received (summed credited amount across all matching expenses) and a transaction count. New "View details" panel per vendor shows the full payment history (every expense line: date, title, category, voucher, amount, remarks). CSV export matches the merged shape. Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-15 (21)
- Expenses: added Voucher Number, Vendor/Supplier Name, Contact fields after Category on the add/edit form (not shown in the table itself — avoids horizontal scroll).
- New "Vendor" page: read-only report auto-collecting every expense with a Vendor/Supplier Name filled in. No own data, no CRUD — just a filtered view of Expenses, with CSV export.
- New "Loans" page: full CRUD (add/edit/delete/import/export) like Chanda Collection. Fields: donor's name, amount, phone, Payment Method, date, Return Date, remarks. Payment status always "paid" (fixed, not user-editable).
- Both new pages tucked behind a "⋮" (more) dropdown after Settings in the nav (per follow-up request, not top-level nav buttons). Vendor gated by the existing `expenses` permission; Loans by a new `loans` permission (auto-appears as a checkbox in Settings → User Management).
- New `supabase/005_vendor_loans.sql`: adds the 3 expense columns, creates the `loans` table + RLS, and merges `loans: true` into every existing user's permissions so nobody loses access after the upgrade.
- Threaded `Loan` type, `loansList` state, and `syncLoans` through `App.tsx`/`db.ts`. Translated all new strings EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (20)
- Added enable/disable login toggle per user in Settings → User Management (Ban/CheckCircle icon button, "Disabled" badge, admin accounts can't be disabled). New `supabase/004_user_enable_disable.sql`: `app_users.is_active` column + `login()` recreated to require it + `set_app_user_active` RPC. A disabled account gets the same generic "Invalid username or password" message on login. Threaded `isActive` through User type/db.ts/App.tsx/Settings.tsx. Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (19)
- Added view-only "Access Level" for users (Settings → User Management → below Permissions): "Can Edit & Manage" (default) or "View Only". View-only users keep their per-page permissions but Add/Edit/Delete/Import and the Action column are hidden on Members/Chanda/Donation-Ads/Expenses; Committee Info and Developer Info forms become disabled; Export and Change Password remain available.
- New `supabase/003_view_only_access.sql`: `app_users.can_edit` column (default true) + recreated `login`/`create_app_user`/`update_app_user` RPCs to carry it. Enforced client-side only, per the standing no-Supabase-Auth trade-off — flagged in the migration file.
- Threaded `canEdit` through `User` type, `db.ts`, `App.tsx`, `Settings.tsx`, and the 4 data pages. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (18)
- Dashboard: key-figure widgets made bigger and capped at 4 per row (grid-cols-2 sm:grid-cols-4) per explicit request — 7 widgets now read as two clear rows (4+3) instead of many small columns.
- New `DashboardChart.tsx`: recharts AreaChart, Income (Chanda + Donation/Ads) vs Expenses over time, gradient-filled, with an Income/Expenses/Net Balance summary line and 7D/This Week/Last Week/30D/3M/6M range presets (daily/weekly/monthly bucketing via date-fns). Sits above the key-figure widgets. Client-side only.
- Translated new chart strings EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (17)
- Redesigned Dashboard: split the one uniform tile grid into compact horizontal "key figures" cards + smaller square "quick access" icon tiles, with column counts tuned per breakpoint (2/3/4/6 and 3/4/5/8) so the dashboard stays short and legible at 1024/1366/1600 laptop widths and on mobile, not just desktop-wide.
- Merged the separate committee-info header and orange user-info bar into one compact bar (logo + name + single truncating detail line, user name + logout) — roughly halves header height.
- Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (16)
- Header shortened to 3 lines (merged Pin into the Post/PS line) to reduce header height.
- Dashboard: Total Chanda tile icon changed from generic dollar sign to IndianRupee (₹). New "Pending / Due Chanda" widget beside Recent Chanda Collection (pending full amount + partial's unpaid remainder, rejected excluded). Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (15)
- Added a global search bar (search icon after Settings in the nav, right-aligned). Opens a full-container-width dropdown searching Members, Chanda Collection, Donation/Ads Collection, and Expenses at once — client-side only, no DB changes. Matches names, phones, amounts, remarks, and status/category/paid-method both by canonical key and current-language translation. Grouped results (8 per section) with "See all", permission-aware, closes on outside click/Escape/selection. Translated EN/BN/HI. Verified `npm run build` passes. Pushed to `main`.

## 2026-09-14 (14)
- Login session now persists across page refreshes for 1 week (localStorage `puja-session`, `{user, expiresAt}`). Restored on app load if not expired; expired/invalid sessions auto-clear; logout clears it immediately. Verified `npm run build` passes. Pushed to `main`.

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
