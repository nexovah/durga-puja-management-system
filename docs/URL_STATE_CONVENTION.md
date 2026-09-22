# URL state convention

**Rule: every list/detail view and every settings tab carries its state in
the URL.** A page refresh, browser back/forward, or a shared link must land
the user back exactly where they were — not bounced to a list or the first
tab. This applies to both the tenant (committee) app and the Super Admin
app, and to anything added to either in the future.

This was written after a real bug: Super Admin's Tenants/Orders detail
pages and Settings tabs initially kept their "which one am I looking at"
state only in React `useState`, with no URL backing — a refresh always
reset to the list/first tab, silently discarding the user's position.

## The pattern

Each app already has its own tiny path-based router (no react-router; just
the History API), matching what's used for the committee app's pages
(`PAGE_SLUGS` in `src/app/App.tsx`) and the Super Admin app
(`SuperAdminRoot.tsx`). Every new routable view follows the same four
pieces:

1. **A path segment for the view.** Top-level pages get their own segment
   (`/super-admin/orders`), a selected item within a list gets an id
   appended (`/super-admin/orders/<source>/<id>`), a tab within a settings
   page gets its own segment (`/super-admin/settings/<tab>`).
2. **A `getXFromPath()` parser**, read once as the `useState` initializer,
   so the very first render already reflects the URL (see
   `getPageFromPath`/`getTenantIdFromPath` in `SuperAdminRoot.tsx`,
   `getTabFromPath` in `SuperAdminSettings.tsx`, `getSelectionFromPath` in
   `SuperAdminOrders.tsx`, `getEditingIdFromPath` in `SuperAdminPlans.tsx`
   for concrete examples).
3. **A setter wrapper that also calls `window.history.pushState`** —
   never call the raw `useState` setter directly from a click handler;
   always go through the wrapper (e.g. `setPage`, `openTenant`,
   `selectOrder`, `setActiveTab`) so the URL and the state can never drift
   apart.
4. **A `popstate` listener** that re-derives state from the URL, so
   browser back/forward works correctly, not just refresh.

If a detail view needs data fetched by id (e.g. opening a tenant by URL
on a cold refresh, with no in-memory list to pluck it from), fetch it in a
loading-gated effect on mount rather than assuming the parent already has
it — see `loadTenantFromUrl` in `SuperAdminRoot.tsx`.

## What's exempt

Ephemeral, in-progress form state (an unsaved draft in a create/edit form
that hasn't been submitted yet) does **not** need to survive a refresh —
that's normal behavior for any web form, not a routing bug. Deep-linking
applies to "which record/tab am I viewing," not to unsaved keystrokes.
