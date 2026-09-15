# AGENTS.md

Project knowledge base for AI agents (Claude Code etc.) working on this repo. Update whenever features are added/changed and pushed to GitHub.

## What this project is
Durga Puja Management System (Community) — admin web app for running a community Durga Puja committee: members, treasury, chanda (donation) collection, expenses, dashboard overview. Originally scaffolded from Figma Make.

## Tech stack
- **Framework**: React 18.3.1 + TypeScript, Vite 6.3.5
- **Styling**: Tailwind CSS 4.1.12 (via `@tailwindcss/vite`)
- **UI primitives**: Radix UI (accordion, dialog, dropdown, select, tabs, etc.) + MUI (`@mui/material`, `@mui/icons-material`)
- **Components**: shadcn-style wrappers in `src/app/components/ui/`
- **Icons**: lucide-react
- **Charts**: recharts
- **Forms**: react-hook-form
- **Routing**: react-router 7
- **Other libs**: date-fns, embla-carousel, cmdk, sonner (toasts), vaul (drawers), motion (animation), canvas-confetti, react-dnd

## Architecture
```
src/
  main.tsx              # entry point
  app/
    App.tsx             # root component, page/section switching
    components/
      Dashboard.tsx
      Members.tsx
      ChandaCollection.tsx
      Treasury.tsx
      Expenses.tsx
      Settings.tsx
      LoginPage.tsx
      PageHeading.tsx
      figma/ImageWithFallback.tsx
      ui/                # shadcn/Radix-based primitive components (button, dialog, table, ...)
  styles/
    globals.css / index.css / default_theme.css
```
- Path alias `@` → `src/app` (see `vite.config.ts`).
- Custom Vite plugin `figma-asset-resolver` resolves `figma:asset/...` imports to `src/assets`.
- Do not remove the React/Tailwind Vite plugins even if Tailwind looks unused — required by Figma Make tooling.

## Features (update this list as features change)
- **Global Search**: search icon in the main nav (after Settings, right-aligned) opens a full-container-width dropdown searching Members/Chanda/Donation-Ads/Expenses at once (names, phones, amounts, status, etc). Purely client-side filter over data already in React state (`src/app/components/GlobalSearch.tsx`) — no DB query, no backend involvement. Respects per-page permissions.
- **Dashboard**: overview of puja committee stats.
  - **Chart row** (3:1 grid, `lg:grid-cols-4`): `DashboardChart.tsx` (3 cols) — recharts AreaChart, Income (Chanda credited + Donation/Ads + Loan net) vs Expenses (credited) over time, gradient fills + Income/Expenses/New Balance summary line. Range presets 7D/This Week/Last Week/30D/3M/6M, auto daily/weekly/monthly bucketing via `date-fns`. `DashboardCategoryBars.tsx` (1 col) — recharts BarChart, 5 pillars of **all-time** totals (not date-range filtered): Chanda (credited), Donation, Ads, Expenses (credited), Loan (net received), amount labelled above each bar. Both purely client-side, no DB query beyond what's already loaded.
  - **Key figures**: 7 bigger cards (Members, Chanda, Donation/Ads, Recent Chanda, **Pending/Due Chanda** [sum of pending chanda + unpaid remainder of partially-paid chanda; rejected excluded], Expenses total+count) capped at `grid-cols-2 sm:grid-cols-4` (4 per row) — deliberately kept to 4 columns max even on very wide screens so cards stay large/legible per explicit request, rather than growing to 6+ columns.
  - **Quick access**: smaller square icon-only shortcuts below at `grid-cols-3 sm:4 lg:5 xl:8`. Mixed widget sizes/densities (not one uniform grid) to keep total height low on laptop (1024/1366/1600) and mobile widths.
- **Members**: manage committee/community members. Designation is a fixed dropdown: President, Vice President, Secretary, Assistant Secretary, Treasurer, Executive/General Members, Advisory Committee/Patrons, Volunteer — stored as a canonical key (`members.role.*`), displayed via translation.
  - **Membership Payment** (optional, collapsible): a member's own donation to the committee — Amount, Paid Method, Payment Status (Paid/Pending/Partial/Rejected), Partial Amount, Date, Bill Number, Remarks; reuses Chanda's `PaidMethod`/`PaymentStatus` vocabulary. Toggled open via a full-width dashed-border button below the 4 core fields (plus icon closed, chevron open). `getMemberCreditAmount()` in `App.tsx` (paid → full amount, partial → partial amount, pending/rejected/unset → 0) is summed into every grand-total alongside Chanda + Donation/Ads + Loan — Dashboard stat tiles, `DashboardChart.tsx` income series/summary, `DashboardCategoryBars.tsx` (6th pillar), `Treasury.tsx` totalCredit/balance. Members page header shows a "Total Membership Payments" pill (via `PageHeading`'s `total` prop) — deliberately no separate widget card.
- **Chanda Collection**: track donation collection. Fields: donor's name*, amount* (plus optional **Amount 01 / Amount 02** breakdown right below it — freely editable; whenever either is non-blank the main `amount` auto-updates to their sum, leaving both blank keeps `amount` a normal manually-typed field), **Paid Method** (Not Selected [default] / Cash / QR Scan / Online Banking / Check Payment), **Payment Status*** (Paid / Pending / Partially Paid / Rejected — Partially Paid reveals a "Paid Amount (Partial)" field), date, **Bill Number** (same row as date), Phone Number 1, Phone Number 2 (same row as each other), remarks. `amount1`/`amount2` are stored for the breakdown but `amount` remains the single source of truth for every total/report.
  - **Credit logic** (`getChandaCreditAmount` in `src/app/App.tsx`, the single source of truth): Paid → full `amount` counts; Partially Paid → only `partialAmount` counts; Pending / Rejected → 0 counts. Every total (Chanda page total, Dashboard tile, Treasury totals/monthly report/top donors) sums this credited amount, never the raw `amount` field. Records saved before this feature default to `paid` on load.
- **Donation/Ads Collection**: separate credit stream with a Category select (Donation Collection / Ads Collection, default Ads). Both Donation and Ads entries also have **Paid Method** (Not Selected [default] / Cash / QR Scan / Online Banking / Check Payment) right after Amount. Donation entries: donor's name*, amount (optional — record now, fill amount in when actually collected), paid method, donation in kinds (free text), date, **Voucher/Bill Number** (Donation-only field, right after date, resets on category switch), Phone Number 1, Phone Number 2 (optional), remarks. Ads entries: donor's name, company name, amount (optional), paid method, **Ads Category dropdown** (Hand Book, Souvenir, Bill, Gate, Banner, Others — replaces the free-text field), date, Phone Number 1, Phone Number 2 (optional), remarks. Table view shows Category after Amount/Paid Method (form/CSV keep Category first). Grand credit = Chanda (credited) + Donation/Ads; Treasury balance = grand credit − expenses.
- **Treasury**: fund tracking (Chanda + Donation/Ads combined).
- **Pagination**: every table (Members, Chanda, Donation/Ads, Expenses, Loans, Vendors, Activity Log) uses `src/app/components/Pagination.tsx` — `usePagination<T>(items, defaultPageSize=20)` hook slices the already-sorted/filtered array client-side and clamps the page when the list shrinks; `<Pagination>` renders First/Back/5-number-window+ellipsis+Last/Next/Last controls (current page = theme orange bg, white text) plus a "Results per page" selector (10/20/50/100) and an "X–Y of Z" count below. No DB paging — all data is already loaded client-side.
- **CSV Import/Export**: Chanda Collection and Donation/Ads Collection both have Export (existing) and **Import** (grey `#383737` button, white text) — bulk-add records from a `.csv` file, matching the export column layout. Shared parser/serializer: `src/app/lib/csv.ts`. Donation/Ads import matches category and Ads Category values against labels in any of the 3 languages so a CSV exported in one language re-imports correctly.
- **Expenses**: expense tracking. Fields: title*, amount* (billed), **Payment Status*** (Paid / Partially Paid / Cancelled), **Paid Through** (Not Selected [default] / Cash / Check Payment), date, category*, remarks. Partially Paid reveals 5 "Partial Amount" fields in one row (only field 1 required); their sum is validated against the billed amount on submit.
  - **Credit logic** (`getExpenseCreditAmount` in `src/app/App.tsx`): Paid → full `amount` counts; Partially Paid → sum of entered `partialAmounts` counts; Cancelled → 0 counts. Every total (Expenses page total, category summary, Dashboard tile, Treasury totals/monthly report/expense categories) sums this credited amount, never the raw `amount`. Table amount cell: Cancelled = red + strikethrough, Partially Paid = yellow until the partial sum reaches the billed amount (then green), Paid = red (unchanged). Records saved before this feature default to `paid` / `notSelected` on load.
  - Also carries **Voucher Number**, **Vendor/Supplier Name**, **Contact** (all optional, entered after Category on the add/edit form) — not shown in the Expenses table itself (avoids horizontal scroll), visible via the edit form and the **Vendor** page.
- **Vendor** (`Vendors.tsx`): read-only report, not its own data — derived from every Expense with a Vendor/Supplier Name filled in, **merged into one row per unique Name + Contact** (case-insensitive) with the summed credited amount (`getExpenseCreditAmount`) as Total Amount Received and a transaction count — a vendor paid across multiple expenses/dates shows as one totalled row. "View details" (eye icon) opens an inline panel with the vendor's full payment history (every matching expense: date, title, category, voucher number, amount, remarks). CSV export uses the same merged-row shape. Gated by its own dedicated `vendors` permission (was piggy-backing on `expenses`, split out in migration 009). Reached via the "⋮" (more) menu after Settings in the nav.
- **Loans** (`Loans.tsx`): full add/edit/delete/import/export page, same pattern as Chanda Collection. Fields: donor's name*, **Amount Received*** (green — credited from the lender), **Amount Paid** (red — repaid back so far, default 0), phone, **Payment Method** (Not Selected default / Cash / QR Scan / Online Banking / Check Payment), date*, **Return Date**, remarks. `paymentStatus` is always `'paid'` — not a user-facing field.
  - **Net logic** (`getLoanNetAmount` in `src/app/App.tsx`): `amountReceived - amountPaid` — what's still held from the lender; fully repaid nets to zero. This net sums into the app's grand credit total alongside Chanda + Donation/Ads (Dashboard "Loans Outstanding" tile, Treasury "Loans Outstanding" card) — a loan received is a credit like chanda/donations, repaying it deducts from that same credit. Not broken into Treasury's monthly report/top-donors/expense-category breakdowns (no repayment-date field exists to place `amountPaid` on a timeline).
  - Gated by a dedicated `loans` permission. Reached via the "⋮" (more) menu after Settings.
- **Activity Log** (`ActivityLog.tsx`): read-only audit trail page reached via the "⋮" (more) menu after Settings. Lists every create/edit/delete/bulk-import across Members, Chanda, Donation/Ads, Expenses, Loans, Tasks and User Management — who (name + username), when, what action, which module, and a one-line summary; filterable by module/action, manual refresh (not part of `fetchAllData()`'s initial load). Backed by the append-only `activity_log` table (`supabase/009_activity_log_and_permissions.sql`) — RLS grants only `select`+`insert`, so entries can't be edited or deleted through the client API once written. Every page's create/update/delete/bulk_import handler calls `App.tsx`'s `handleLog(action, module, summary, count?)`, which writes via `logActivity()` in `db.ts`. Gated by the `settings` permission (same audience as User Management).
- **Tasks** (`Tasks.tsx`): simple internal to-do list (Google Tasks/Notion-style) reached via the "⋮" more-menu, between Loans and Settings. Fields: Title*, Description, Priority* (High/Medium/Low/Note/**Completed** — 5-color badges: red/amber/blue/purple/green, each with a matching dot), `createdAt` captured automatically (read-only, always today on creation), **Assign To** (multi-select checkbox dropdown of saved Members — `Task.assignedMemberIds: string[]`), **Expiry Date** (defaults to `createdAt` + 15 days via `addDaysISO`, adjustable date picker; shown in red in the table once past today). Two tabs above the table: **All Tasks** (priority ≠ completed) and **Completed** (priority === completed), each with a live count — a task switches tabs the instant its priority becomes `completed`, settable from the same Priority dropdown or a one-click "Mark as Completed" row action. Filterable by task name (search), priority, and created date; paginated like every table (`Pagination.tsx`). Gated by its own dedicated `tasks` permission (Settings → User Management checkbox, defaults on). Full add/edit/delete, logs to Activity Log under the `tasks` module.
  - Every task assigned to a member shows up on **Members** page's "Assigned Tasks" column — always visible (not a toggle), small colored-dot badges (priority color) per task, description as a native tooltip. Purely derived (`tasksList.filter(t => t.assignedMemberIds.includes(member.id))`), no denormalized data on the member row.
- **Settings**: app configuration, incl. **Language** tab. User Management: per-page permissions (members/chanda/donationAds/expenses/treasury/loans/vendors/settings), a 3-tier **Access Level** — **Can Edit, Manage & Delete** / **Can Edit & Manage** (no delete) / **View Only** — view-only users see the pages their permissions allow but with no Add/Edit/Delete/Import controls (read-only tables, Export still works); "Can Edit & Manage" grants add/edit but not delete; delete is a separate, more-privileged tier. A per-user **Bulk Upload** toggle (shown only when the user can edit) independently controls whether the CSV Import button appears on Chanda/Donation-Ads/Expenses/Loans — lets an admin grant edit access without risking an accidental bulk-import corrupting the database. Plus a per-user **enable/disable login toggle** (Ban/CheckCircle icon; admin accounts can't be disabled). Backed by `app_users.can_edit` / `can_delete` / `can_bulk_import` / `is_active`; enforced client-side only (see security notes in `supabase/003_view_only_access.sql` / `004_user_enable_disable.sql` / `009_activity_log_and_permissions.sql`).
- **Login**: auth entry page.
- **Multilingual UI**: English (default), Bengali, Hindi — switchable from Settings → Language. See `src/app/i18n/`.

## i18n
- `src/app/i18n/translations.ts` — flat key→string dictionaries for `en`/`bn`/`hi`, plus `LANGUAGES` and `LOCALE_MAP`.
- `src/app/i18n/LanguageContext.tsx` — `LanguageProvider` + `useLanguage()` hook (`{ language, setLanguage, t, locale }`). Persists to `localStorage['puja-language']`. Default: `en`.
- All UI chrome (nav, buttons, labels, messages, table headers, placeholders) uses `t('key')`. User-entered data (member names, committee info, donor names) is never translated.
- Expense categories are stored as canonical English keys (`construction`, `decoration`, ...) and displayed via `expenses.category.<key>` translation lookup, not as raw language text.
- Dates use `toLocaleDateString(locale)` where `locale` comes from `useLanguage()`.
- When adding new UI text: add the key to all three language blocks in `translations.ts`, never hardcode strings in components.

## Backend (database) — Supabase / PostgreSQL
The app is backed by a real Postgres database on **Supabase**; there is no other server. Every page reads/writes Supabase directly from the browser via `@supabase/supabase-js`.
- `supabase/schema.sql` — full DDL: `app_users` (custom username/password login, bcrypt-hashed via pgcrypto — **not** Supabase Auth, by explicit request), `committee_info` / `developer_info` (singleton rows), `members`, `chanda`, `donation_ads`, `expenses`. Includes RLS policies, `updated_at` triggers, and the `login`/`create_app_user`/`change_password` RPC functions.
- `supabase/002_user_management.sql` — `update_app_user` (edit name/permissions/optionally reset password) and `delete_app_user` RPC functions, for the Settings → User Management screen.
- `supabase/003_view_only_access.sql` — adds `app_users.can_edit` (default `true`), and recreates `login`/`create_app_user`/`update_app_user` to return/accept it. Backs the "View Only" access level (see Settings feature entry below).
- `supabase/004_user_enable_disable.sql` — adds `app_users.is_active` (default `true`), recreates `login` to require it, new `set_app_user_active` RPC (refuses to disable an admin). Backs the per-user enable/disable toggle in Settings.
- `supabase/005_vendor_loans.sql` — adds `expenses.voucher_number`/`vendor_name`/`vendor_contact`, creates the `loans` table (RLS matching the rest of the schema), and merges `"loans": true` into every existing user's `permissions` jsonb so nobody loses the new menu after upgrading.
- `supabase/006_loans_amount_paid.sql` — renames `loans.amount` to `amount_received`, adds `amount_paid` (default `0`). Backs the Amount Received/Amount Paid split (see Loans feature entry below).
- `supabase/007_chanda_bill_subamounts.sql` — adds `chanda.bill_number`, `amount1`, `amount2`.
- `supabase/008_donation_ads_voucher.sql` — adds `donation_ads.voucher_number` (Donation Collection entries only).
- `supabase/009_activity_log_and_permissions.sql` — adds `app_users.can_delete` (edit rights no longer imply delete — backs the 3-tier Access Level: View Only / Can Edit & Manage / Can Edit, Manage & Delete) and `app_users.can_bulk_import` (per-user toggle for the CSV Import button, independent of edit/delete); creates the append-only `activity_log` table (RLS: select+insert only, no update/delete — an audit trail that can't be altered once written) backing the Activity Log page in the ⋮ menu; recreates `login`/`create_app_user`/`update_app_user` to carry the two new fields; merges `"vendors": true` into existing users' `permissions` (Vendor menu now has its own permission key instead of reusing `expenses`).
- `supabase/010_member_membership_payment.sql` — adds 7 nullable columns to `members` (`membership_amount`, `membership_paid_method`, `membership_payment_status`, `membership_partial_amount`, `membership_date`, `membership_bill_number`, `membership_remarks`) backing the optional Membership Payment section on the Add/Edit Member form.
- `supabase/011_tasks.sql` — creates the `tasks` table (RLS: select/insert/update/delete, same permissive trust model as every other business table) backing the Tasks page; merges `"tasks": true` into existing users' `permissions` so nobody loses the new menu on upgrade.
- `supabase/012_tasks_assign_expiry.sql` — adds `tasks.expiry_date` and `tasks.assigned_member_ids` (`uuid[]`, GIN-indexed) backing the Assign To / Task Expiry fields.
- `supabase/013_tasks_completed_priority.sql` — widens `tasks.priority`'s check constraint to allow `'completed'`, backing the All Tasks/Completed tabs.
- `supabase/storage.sql` — a public `logos` Storage bucket for the committee logo upload (Settings → Committee Info uploads straight to it via `uploadLogo()` in `db.ts`; no separate file server).
- `supabase/README.md` — setup steps, REST API reference (GET/POST/PATCH/DELETE per table via PostgREST), field-name mapping (camelCase frontend ↔ snake_case DB), and a security note (no Supabase Auth yet ⇒ anon key has full table access — acceptable trust level per explicit product decision, flagged for future hardening).
- `DEPLOYMENT.md` — Hostinger static hosting steps (manual upload or GitHub Actions auto-deploy) for the frontend once built.

### Frontend data layer
- `src/app/lib/supabaseClient.ts` — creates the Supabase client from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (set in a local `.env`, see `.env.example`). If unset, `App.tsx` shows a "Supabase is not configured" screen instead of crashing.
- `src/app/lib/db.ts` — the only place that talks to Supabase. Maps camelCase (frontend) ↔ snake_case (DB) per entity, and exposes:
  - `fetchAllData()` — loads members/chanda/donationAds/expenses/committeeInfo/developerInfo/users once on app start.
  - `syncMembers`/`syncChanda`/`syncDonationAds`/`syncExpenses` — generic **diff-based sync**: given an old array and a new array (both keyed by `id`), computes the minimal insert/update/delete and applies it. This is what lets `App.tsx` keep passing `setMembers`/`setChandaList`/`setDonationAdsList`/`setExpenses` down to pages with the exact same `(wholeNewArray) => void` signature they had under localStorage — **no page component (Members/ChandaCollection/DonationAdsCollection/Expenses) needed its CRUD logic rewritten**, only their `id: Date.now().toString()` generators were changed to `crypto.randomUUID()` (Postgres `uuid` primary keys need real UUIDs).
  - `updateCommitteeInfo`/`updateDeveloperInfo` — singleton row updates.
  - `uploadLogo(file)` — uploads to the `logos` Storage bucket, returns the public URL.
  - `loginRequest`/`createUserRequest`/`updateUserRequest`/`deleteUserRequest`/`changeOwnPasswordRequest` — call the RPC functions; **`Settings.tsx` was rewired** to use these instead of a local `setUsers(array)`, since `app_users` writes are blocked at the DB for direct table access (must go through the SECURITY DEFINER functions, which hash passwords server-side and never return `password_hash`).
- `App.tsx`: on mount, calls `fetchAllData()` (shows a loading spinner meanwhile); wraps each list setter to call the matching `sync*` function and roll back local state + show `common.saveError` on failure; login is now `async` (`loginRequest` via the `login` RPC) — `LoginPage.tsx`'s `onLogin` prop and `handleSubmit` were updated to `async`/`await` accordingly, with a disabled/"Logging in…" state on the submit button.
- The `User` type still carries a `password` field for shape-compatibility with existing code, but it is **always `''`** client-side — the database never sends a password or its hash to the browser.

## Dev commands
```bash
npm i           # install deps
npm run dev     # start dev server (default http://localhost:5173)
npm run build   # production build (vite build)
```

## Repo
- GitHub: https://github.com/nexovah/durga-puja-management-system (private)
- Default branch: `main`

## Update policy
Whenever a feature is added, removed, or changed and pushed to GitHub, update the **Features** section above and note the change in `SESSION.md`.
