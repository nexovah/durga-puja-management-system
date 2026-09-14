# SESSION.md

Running log of updates made to this project. Newest entries on top.

---

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
