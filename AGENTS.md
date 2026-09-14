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
- **Dashboard**: overview of puja committee stats.
- **Members**: manage committee/community members. Designation is a fixed dropdown: President, Vice President, Secretary, Assistant Secretary, Treasurer, Executive/General Members, Advisory Committee/Patrons, Volunteer — stored as a canonical key (`members.role.*`), displayed via translation.
- **Chanda Collection**: track donation collection. Fields: donor's name*, amount*, **Paid Method** (Not Selected [default] / Cash / QR Scan / Online Banking / Check Payment), **Payment Status*** (Paid / Pending / Partially Paid / Rejected — Partially Paid reveals a "Paid Amount (Partial)" field), date, Phone Number 1, Phone Number 2 (optional), remarks.
  - **Credit logic** (`getChandaCreditAmount` in `src/app/App.tsx`, the single source of truth): Paid → full `amount` counts; Partially Paid → only `partialAmount` counts; Pending / Rejected → 0 counts. Every total (Chanda page total, Dashboard tile, Treasury totals/monthly report/top donors) sums this credited amount, never the raw `amount` field. Records saved before this feature default to `paid` on load.
- **Donation/Ads Collection**: separate credit stream with a Category select (Donation Collection / Ads Collection, default Ads). Both Donation and Ads entries also have **Paid Method** (Not Selected [default] / Cash / QR Scan / Online Banking / Check Payment) right after Amount. Donation entries: donor's name*, amount (optional — record now, fill amount in when actually collected), paid method, donation in kinds (free text), date, Phone Number 1, Phone Number 2 (optional), remarks. Ads entries: donor's name, company name, amount (optional), paid method, **Ads Category dropdown** (Hand Book, Souvenir, Bill, Gate, Banner, Others — replaces the free-text field), date, Phone Number 1, Phone Number 2 (optional), remarks. Table view shows Category after Amount/Paid Method (form/CSV keep Category first). Grand credit = Chanda (credited) + Donation/Ads; Treasury balance = grand credit − expenses.
- **Treasury**: fund tracking (Chanda + Donation/Ads combined).
- **CSV Import/Export**: Chanda Collection and Donation/Ads Collection both have Export (existing) and **Import** (grey `#383737` button, white text) — bulk-add records from a `.csv` file, matching the export column layout. Shared parser/serializer: `src/app/lib/csv.ts`. Donation/Ads import matches category and Ads Category values against labels in any of the 3 languages so a CSV exported in one language re-imports correctly.
- **Expenses**: expense tracking. Fields: title*, amount* (billed), **Payment Status*** (Paid / Partially Paid / Cancelled), **Paid Through** (Not Selected [default] / Cash / Check Payment), date, category*, remarks. Partially Paid reveals 5 "Partial Amount" fields in one row (only field 1 required); their sum is validated against the billed amount on submit.
  - **Credit logic** (`getExpenseCreditAmount` in `src/app/App.tsx`): Paid → full `amount` counts; Partially Paid → sum of entered `partialAmounts` counts; Cancelled → 0 counts. Every total (Expenses page total, category summary, Dashboard tile, Treasury totals/monthly report/expense categories) sums this credited amount, never the raw `amount`. Table amount cell: Cancelled = red + strikethrough, Partially Paid = yellow until the partial sum reaches the billed amount (then green), Paid = red (unchanged). Records saved before this feature default to `paid` / `notSelected` on load.
- **Settings**: app configuration, incl. **Language** tab.
- **Login**: auth entry page.
- **Multilingual UI**: English (default), Bengali, Hindi — switchable from Settings → Language. See `src/app/i18n/`.

## i18n
- `src/app/i18n/translations.ts` — flat key→string dictionaries for `en`/`bn`/`hi`, plus `LANGUAGES` and `LOCALE_MAP`.
- `src/app/i18n/LanguageContext.tsx` — `LanguageProvider` + `useLanguage()` hook (`{ language, setLanguage, t, locale }`). Persists to `localStorage['puja-language']`. Default: `en`.
- All UI chrome (nav, buttons, labels, messages, table headers, placeholders) uses `t('key')`. User-entered data (member names, committee info, donor names) is never translated.
- Expense categories are stored as canonical English keys (`construction`, `decoration`, ...) and displayed via `expenses.category.<key>` translation lookup, not as raw language text.
- Dates use `toLocaleDateString(locale)` where `locale` comes from `useLanguage()`.
- When adding new UI text: add the key to all three language blocks in `translations.ts`, never hardcode strings in components.

## Backend (database)
- The app currently persists all data (members, chanda, donation/ads, expenses, users, committee/developer info) to browser `localStorage` only, under keys prefixed `puja-*` — this is being migrated to a real Postgres database on **Supabase**.
- `supabase/schema.sql` — full DDL: `app_users` (custom username/password login, bcrypt-hashed via pgcrypto — **not** Supabase Auth, by explicit request), `committee_info` / `developer_info` (singleton rows), `members`, `chanda`, `donation_ads`, `expenses`. Includes RLS policies, `updated_at` triggers, and 3 RPC functions (`login`, `create_app_user`, `change_password`).
- `supabase/storage.sql` — a public `logos` Storage bucket for the committee logo upload (no separate file server needed).
- `supabase/README.md` — setup steps, REST API reference (GET/POST/PATCH/DELETE per table via PostgREST), field-name mapping (camelCase frontend ↔ snake_case DB), and a security note (no Supabase Auth yet ⇒ anon key has full table access, same trust level as the current browser-only app).
- `DEPLOYMENT.md` — Hostinger static hosting steps (manual upload or GitHub Actions auto-deploy) for the frontend once built.
- **As of this writing the React frontend has not been rewired to call this API** — it still reads/writes `localStorage`. That wiring (swapping `useState`/`localStorage` in `App.tsx` and each page's handlers for API calls) is a deliberately separate, not-yet-done step — do it when asked, not proactively, since the user wanted to review the schema first.

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
