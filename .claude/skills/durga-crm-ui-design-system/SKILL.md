---
name: durga-crm-ui-design-system
description: Durga CRM's design system — colors, dark mode mechanism, layout shells, reusable components, and conventions. Load this before building or changing any UI in this repo (new pages, menus, cards, modals, charts, forms, tables) so new work matches the existing look and feel exactly instead of inventing a new style.
---

# Durga CRM UI/UX Design System

This repo is a React + TypeScript + Vite + Tailwind v4 + Supabase CRM with
two app shells — the tenant/committee app (`Sidebar.tsx` + `App.tsx`) and
Super Admin (`SuperAdminLayout.tsx` + `SuperAdminRoot.tsx`) — that share
one visual language. Read this whole file before adding or restyling any
UI; don't improvise new colors, spacing, or component patterns when an
existing one already does the job.

## Brand & color palette

- **Accent color: orange** (`orange-600` primary, `orange-50`/`orange-500/10`
  for light tints). Every primary action button, active nav state, focus
  ring, and brand accent uses this family. Don't introduce a second accent
  color for buttons/CTAs.
- **Category/chart palette** — `DONUT_COLORS` in `src/app/components/DashboardDonut.tsx`:
  ```
  ['#f97316' orange, '#3b82f6' blue, '#8b5cf6' purple, '#22c55e' green,
   '#eab308' yellow, '#ef4444' red, '#06b6d4' cyan, '#ec4899' pink]
  ```
  Used in order for: Membership(0), Collection/Chanda(1), Donation(2),
  Sponsorship/Ads(3), Expenses(4), Loan(5), Awards(6). **Every chart/widget that shows
  these categories (bar charts, line/area charts, donuts) must reuse this
  exact palette and index order** — see `DashboardCategoryBars.tsx` and
  `DashboardChart.tsx` for the pattern (`import { DONUT_COLORS } from
  './DashboardDonut'`). Never hand-pick a different hex for a category
  that already has a slot in this palette.
- **Status colors**: green = active/paid/converted/success, amber/orange =
  pending/warning, red = rejected/error/danger, blue = in-progress/info,
  gray = inactive/archived/neutral. Status pills: `px-2 py-0.5 rounded-full
  text-xs font-medium` with `bg-{color}-100 dark:bg-{color}-900/30
  text-{color}-700 dark:text-{color}-400`.

## Dark mode mechanism (important — don't fight it)

Dark mode is **not** done via Tailwind's semantic CSS variables
(`--background`, `--card`, etc. in `globals.css`'s `:root`/`.dark` blocks
from the original Figma export) — those exist but components don't use
them. Instead:

- Components use **literal Tailwind utility classes**: `bg-white
  dark:bg-gray-900`, `text-gray-800 dark:text-gray-200`, `border-gray-200
  dark:border-gray-700`, etc.
- `.dark` is toggled on `document.documentElement` (`<html>`) by
  `ThemeContext.tsx`.
- Dark mode's actual colors come from **overriding Tailwind's gray-*
  custom properties** inside `.dark { }` in `globals.css` (near-black
  Studio-Admin-style palette: `--color-gray-950: #09090b`, `-900:
  #131316`, `-800: #1c1c21`, `-700: #27272c`, `-600: #37373f`) — since
  every component already uses literal `dark:bg-gray-900` etc., overriding
  the token re-colors the whole app in dark mode from one place.
- Light mode's gray-50/gray-100 are **also overridden** in `:root` (not
  `.dark`) to a warm cream tint (`#fdf8f2`, `#f7ede0`) instead of
  Tailwind's default cool gray — this is intentional, matches the orange
  brand theme. Don't use raw Tailwind gray-50/100 assuming they're neutral
  gray; they're warm-tinted here.
- **Rule when adding any new background/gradient CSS class**: always
  write a `html:not(.dark) .your-class { }` rule for light mode and a
  separate `html.dark .your-class { }` rule for dark mode. A bug was
  introduced earlier by giving a class an unconditional `background-image`
  — `background-image` paints over `background-color` regardless of which
  `dark:bg-*` utility class is also present, so dark mode went blank until
  both rules were explicitly scoped. See `.outer-bg-gradient` and
  `.mesh-bg-light` in `globals.css` for the correct scoped pattern.
- Never add Tailwind's `dark:` variant to `LandingPage.tsx` specifically —
  that page intentionally manages its own light/dark via local `dark`
  state and a `c(light, darkCls)` helper, because `.dark *` would also
  match if the page were ever nested under a dark-toggled ancestor.

## Page shell backgrounds (current, as of this session)

- **Sidebar + outer page corners + sticky top bar**: `.outer-bg-gradient`
  class (`globals.css`) — light mode is a diagonal amber/orange gradient
  (`#fef7d9 → #fff2e1 → #feeda9`) with a light top fade, `background-attachment:
  fixed` so the sidebar/topbar/outer-wrapper all read as one continuous
  gradient instead of three separate ones. Dark mode is the original flat
  `#09090b` base with a very subtle mesh texture (low-opacity white/black
  radial spots), not a flat fill, but still effectively near-black.
- **Main content panel** (the big rounded container everything renders
  inside, `rounded-2xl p-4 sm:p-6`): `.mesh-bg-light` class — light mode
  is a near-white (`#fffdfb`) mesh of soft radial gradients, deliberately
  lighter than the sidebar gradient so the two surfaces read as separate.
  Dark mode is the original flat `#0e0e12` base with the same subtle mesh
  texture treatment.
- Apply both classes bare (no `dark:bg-*` utility needed alongside — the
  class itself handles both modes via the `html:not(.dark)`/`html.dark`
  scoping described above).
- Nav item active/hover states in the (now gradient-colored) sidebar use
  `.nav-item-active` / `.nav-item-hover` (darker orange gradients,
  `#fdba74→#fb923c` active, `#fed7aa→#fdba74` hover) in light mode only —
  dark mode keeps the plain `dark:bg-orange-500/10 dark:text-orange-400`
  Tailwind utilities (still visible against the near-black dark sidebar,
  no gradient needed there).
- Sidebar/nav scroll containers use `.scrollbar-hide` (scrolls, no visible
  scrollbar track/thumb, cross-browser).

## Layout shell structure

Both `Sidebar.tsx` (tenant) and `SuperAdminLayout.tsx` (Super Admin)
follow the identical structure — copy this exact pattern for any new
top-level shell:
```
<div class="min-h-screen outer-bg-gradient flex">
  <aside class="hidden lg:block ... outer-bg-gradient">        <!-- desktop sidebar -->
    <nav class="flex-1 overflow-y-auto scrollbar-hide ...">     <!-- nav items -->
  </aside>
  {mobileOpen && <mobile drawer overlay>}                       <!-- bg-white/gray-900, no gradient -->
  <div class="flex-1 min-w-0 flex flex-col">
    <div class="sticky top-0 z-20 outer-bg-gradient">           <!-- top bar: collapse toggle, search, theme toggle, profile menu -->
    <main class="flex-1 px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
      <div class="mesh-bg-light rounded-2xl p-4 sm:p-6 min-h-[calc(100vh-5.5rem)]">
        {page content}
      </div>
    </main>
  </div>
</div>
```
- Sidebar collapse: `collapsed` state, `w-64` ↔ `w-[72px]`, persisted to
  localStorage, collapse-toggle icon (`PanelLeftClose`/`PanelLeftOpen`
  from lucide-react) always gets `strokeWidth={1.5}` to match the thinner
  weight of nav icons (lucide's default `strokeWidth={2}` looks
  noticeably chunkier next to them).
- Collapsed-sidebar hover tooltips use `createPortal` to `document.body`
  (so they escape the sidebar's own clipping/z-index context), positioned
  via the hovered button's `getBoundingClientRect()`. The tooltip bubble
  is `bg-white dark:bg-gray-900`; its little arrow triangle
  (`border-r-[7px] border-r-white`) **must** also carry `dark:border-r-gray-900`
  — easy to forget since it's a border-color trick, not a background.

## Reusable page components (use these, don't rebuild)

- **`PageHeading`** (`PageHeading.tsx`) — every page's title bar.
  `<PageHeading action={<buttons>} total={<pill>}>Page Title</PageHeading>`.
  `total` renders as a dashed-border amber pill next to the title (e.g.
  showing a record count).
- **`SearchToggleButton` + `CollapsibleSearchPanel` + `TableSearchBar`**
  (`SearchToggleButton.tsx`, `CollapsibleSearchPanel.tsx`,
  `TableSearchBar.tsx`) — the standard search/filter UI for every data
  table. Pattern: `showSearch` state toggled by `SearchToggleButton`,
  wraps `TableSearchBar` in `CollapsibleSearchPanel`. `TableSearchBar`
  takes `query`/`onQueryChange` (free-text) plus a `filters`/`TableSearchFilters`
  object for structured filters (amount range, bill/voucher, paid method,
  phone, date range — toggle which ones a page needs via `showAmount`/
  `showBillVoucher`/`showPhone`/`showDateRange`/etc. boolean props).
  Free-text search matches against a page-specific array of fields (see
  any `filtered<Thing> = list.filter(...)` block for the pattern) — when
  adding a new searchable field to a table, add it to **both** the
  free-text match array **and** as a visible table column, per direct
  user instruction (a field that's only in the form/view-modal but not
  searchable/visible in the table is an incomplete feature).
- **`Pagination` / `usePagination`** — every data table paginates via this
  hook; don't hand-roll pagination.
- **`useTableColumns`** — column visibility/sort/reorder state for data
  tables (`ColumnDef[]` with `id`/`label`/`required`/`sortValue`), paired
  with `TableColumnManager.tsx` for the show/hide-columns UI. `tableCols.isColumnVisible(id)`
  gates both the `<SortableTh>` header cell and the body `<td>` for that
  column — always add both when adding a new column (see "Collected By"
  addition to `DonationAdsCollection.tsx` as the reference example: one
  line in `donationAdsColumns`, one `isColumnVisible` guard in `<thead>`,
  one matching guard in `<tbody>`'s row map).
- **Confirm modals** — two tiers, don't mix them up:
  - `DeleteConfirmModal` / `StatusChangeConfirmModal` (4-digit numeric
    PIN) — tenant-side destructive actions, lower stakes (one record in
    one committee's own data).
  - `SuperAdminConfirmModal` (8-char mixed-case code, 12 for the
    highest-stakes actions like switching the active festival/event) —
    Super Admin destructive actions, since those can affect an entire
    tenant's account. `danger` prop (default `true`) picks red vs amber
    theme — use `danger={false}` for a reversible/lighter action like
    "Archive" vs `danger={true}` for permanent "Delete".
- **Row actions are ALWAYS a 3-dot (`MoreVertical`) dropdown menu — never
  inline icon buttons sitting directly in the row.** This was a
  deliberate, explicit, app-wide conversion (every tenant data table:
  Chanda, Assets, Donation/Ads, Expenses, Loans, Members, Tasks,
  Estimation, Documents, Cash & Bank adjustments, Vendors, and Settings'
  User Management list) — do not reintroduce inline per-row Edit/Delete
  buttons on any new table; always put row actions behind one 3-dot
  button. Convention is a **hand-rolled click-outside dropdown** (an
  `openRowMenuId`/`rowMenuRef` pair + `useEffect` `mousedown` listener
  that closes on outside click, keyed per-row so only one row's menu is
  open at a time), not the installed-but-unused
  `src/app/components/ui/dropdown-menu.tsx` Radix wrapper — that file
  exists in the project but is not actually used anywhere; don't start
  using it without first checking whether that's changed. Copy the
  pattern from `ChandaCollection.tsx`'s row menu (or `SuperAdminLeads.tsx`'s,
  or `SuperAdminLayout.tsx`'s profile menu).
  - Include every action the row already had, not just Edit/Delete — if
    a row also has a View/Toggle-status/Mark-complete action, it goes in
    the same menu too (see `Tasks.tsx`: View, Mark Complete, Edit,
    Delete all in one menu).
  - **Critical gotcha**: the table wrapper div around a data table is
    typically `rounded-xl border ... overflow-hidden` (for rounded
    corners). `overflow-hidden` on that ancestor **clips any
    absolutely-positioned dropdown that extends past it, regardless of
    the dropdown's own z-index** — z-index can't escape a clipping
    ancestor. Any table/card with a row-level dropdown must NOT have
    `overflow-hidden` on its wrapper (drop it, accept slightly-less-rounded
    corners at the very top/bottom pixel — or, for a gradient header
    block that needs its own rounded corners like `Awards.tsx`'s prize
    cards, put `rounded-t-*`/`rounded-b-*` on that inner block instead of
    `overflow-hidden` on the outer card). This has already been fixed
    across every table listed above plus `Treasury.tsx`,
    `ReportModulePage.tsx`, `ReportEstimationPage.tsx`,
    `ReportBalanceSheetPage.tsx`, `SuperAdminLeads.tsx` — when adding a
    new table/card with a row dropdown, check its wrapper for
    `overflow-hidden` before shipping, every single time.
  - Dropdown menus use `z-30` by convention (Super Admin Leads was
    originally built with `z-10` and had to be bumped to match — always
    use `z-30` for a new one).

## Form conventions

- Checkboxes/radios (`<input type="checkbox">`/`type="radio"`) — **never**
  style these individually. A global rule in `globals.css`
  (`input[type='checkbox'], input[type='radio'] { accent-color: #ea580c;
  }`) already makes every native checkbox/radio in the app orange instead
  of the browser's default blue. Just use plain `<input type="checkbox">`;
  don't add per-component color overrides or reach for a custom
  checkbox/switch component unless the design genuinely calls for
  something accent-color can't do (e.g. a pill-style toggle switch, which
  already has its own pattern elsewhere — grep for existing toggle
  switches before building a new one).
- Standard text input: `w-full px-4 py-2 border border-gray-300
  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg
  focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none`
  (Settings.tsx-style) or the slightly more compact Super Admin variant
  `w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700
  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm
  focus:outline-none focus:ring-2 focus:ring-orange-500` — either is fine,
  match whichever the surrounding form already uses.
- Required field label suffix: a literal `*` after the label text (not a
  separate styled asterisk span), e.g. `<label>Email *</label>`. A field
  that's actually required at the DB/RPC level must also be `required` on
  the `<input>` AND guarded in the submit handler (don't rely on the
  browser's native validation alone — see the tenant-user-email and
  Super-Admin-create-tenant-email mandatory-field fixes for the pattern:
  label `*`, `required` attribute, explicit `if (!x.trim()) return/setMessage(...)`
  guard before the async call).
- Password/secret fields get a show/hide eye-icon toggle (`Eye`/`EyeOff`
  from lucide-react, absolute-positioned inside the input's right edge).
- Autocomplete/suggestion inputs (e.g. "Collected By" in
  `DonationAdsCollection.tsx`) — a `useMemo`'d pool of candidate strings,
  filtered live against the typed query, rendered in an absolute-positioned
  dropdown below the input with a `useRef` + click-outside-close `useEffect`.
  When suggestions can come from more than one data source (e.g. Members
  vs past Donors), tag each suggestion with its source type and render a
  small colored icon + text badge per item (see the Member/Donor badge
  pattern — orange person icon for Members, blue gift icon for Donors,
  `text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded`
  badge pill) rather than leaving suggestions unlabeled.
- New translation-dependent UI text: every user-facing string needs a key
  added to **all three** language blocks in `src/app/i18n/translations.ts`
  (`en`, `bn` Bengali, `hi` Hindi) — grep the file for a neighboring
  existing key (e.g. `'common.optional'`) and add the new key
  immediately next to it in all three places, never just English.

## Super Admin Settings tab pattern

Every Super Admin secrets/settings section (Payment Gateway, Email,
Bot Protection, …) follows one template — copy it exactly for a new one:
1. A single-row Postgres table (`id smallint primary key default 1 check
   (id=1)`), RLS enabled, **no select policy** if it holds secrets (API
   keys) — reads/writes only through two `SECURITY DEFINER` RPCs gated by
   `is_super_admin_request()`: `super_admin_get_<thing>_settings()` and
   `super_admin_update_<thing>_settings(...)`.
2. A TS interface + `fromXRow`/`get...Request`/`update...Request` trio in
   `superAdminDb.ts`, mirroring `PaymentGatewaySettings`/`EmailProviderSettings`/
   `BotProtectionSettings` exactly.
3. A new tab in `SuperAdminSettings.tsx`: add to the `Tab` type union,
   `NAV_ITEMS`, `VALID_TABS`, an `EMPTY_<THING>` constant, load/save
   state + handler, and a form block in the tab's JSX — same shape as the
   existing tabs (loading state, error/success message, Save button with
   `Save` icon).
4. If a value needs to be publicly readable (e.g. a Turnstile site key
   embedded in a public page) without needing Super Admin auth, add a
   **separate** ungated RPC just for that one value (see
   `get_turnstile_site_key()`) rather than loosening the secrets table's
   RLS.

## Email templates (Resend)

Transactional emails (`new_admin_account`, `password_reset`, `lead_alert`,
`authentication`) are Postgres rows in `email_templates`, editable from
Super Admin → Email Templates (not hardcoded in `.js`/`.tsx`). Trigger
code (`api/_lib/email.js`'s `renderTemplate(slug, variables)`) does
`{{variable}}` substitution — when wiring a new trigger, list the exact
variable names it passes in a code comment at the call site, since the
template content (written separately, often via a one-off SQL migration
like `095_welcome_email_content.sql`) must use matching `{{name}}` tokens.

## Before building new UI

1. Find the closest existing page/component doing something similar and
   copy its structure, don't design from scratch.
2. Check this file's palette/dark-mode/component sections above.
3. Run `npm run build` after any UI change — it's the only pre-commit
   validation in this repo (no full type-check, no test suite for UI).
4. If the browser preview is needed, start the dev server with
   `npm run dev` — note `/api/*` routes (billing, email sending, leads)
   only work against a deployed Vercel URL or `vercel dev`, not plain
   `vite` dev.
