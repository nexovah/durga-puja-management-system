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
- **Members**: manage committee/community members.
- **Chanda Collection**: track donation collection.
- **Donation/Ads Collection**: separate credit stream with a Category select (Donation Collection / Ads Collection, default Ads). Donation entries: donor's name*, amount*, donation in kinds (free text), date, phone, remarks. Ads entries: donor's name, company name, amount*, **Ads Category dropdown** (Hand Book, Souvenir, Bill, Gate, Banner, Others — replaces the free-text field), date, phone, remarks. Grand credit = Chanda + Donation/Ads; Treasury balance = grand credit − expenses.
- **Treasury**: fund tracking (Chanda + Donation/Ads combined).
- **CSV Import/Export**: Chanda Collection and Donation/Ads Collection both have Export (existing) and **Import** (grey `#383737` button, white text) — bulk-add records from a `.csv` file, matching the export column layout. Shared parser/serializer: `src/app/lib/csv.ts`. Donation/Ads import matches category and Ads Category values against labels in any of the 3 languages so a CSV exported in one language re-imports correctly.
- **Expenses**: expense tracking.
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
