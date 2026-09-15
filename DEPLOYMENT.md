# Deployment — Hostinger (frontend) + Supabase (backend)

## Backend: Supabase
See [supabase/README.md](supabase/README.md) — create the project, run `schema.sql` then `storage.sql`, note your `Project URL` and `anon` key.

## Frontend: Hostinger

The app is a static Vite/React build (`npm run build` → a `dist/` folder of plain HTML/CSS/JS). Any Hostinger plan that serves static files works — no Node.js server needed to run it.

**Client-side routing note**: the app uses clean URLs per page (e.g. `/chanda-collection`, `/settings` — no `#`). A hard refresh or direct link to one of these asks the server for that exact path, which doesn't exist as a real file — `public/.htaccess` handles this by rewriting any unknown path back to `index.html` so React can take over. It's part of the repo and gets copied into `dist/` automatically by `npm run build`; just make sure it's included when you upload (Option A) or that your FTP step doesn't skip dotfiles (Option B — most FTP actions include them by default, but double-check after the first deploy that `.htaccess` actually landed in the document root).

### Option A — Manual build & upload (simplest, works on every plan)
1. On your machine: `npm i && npm run build` → creates `dist/`.
2. Hostinger **hPanel** → your domain → **Websites** → pick the subdomain (or create one: **Domains → Subdomains**, e.g. `puja.yourdomain.com`).
3. **File Manager** → open that subdomain's document root (usually `public_html/puja` or similar, shown next to the subdomain in hPanel).
4. Delete the placeholder `index.html` if present, then upload **the contents of `dist/`** (not the `dist` folder itself — its contents) into that root. You can zip `dist/` locally, upload the zip, then use File Manager's "Extract" — faster than uploading files one by one.
5. Visit the subdomain — the app should load.
6. Repeat steps 1 and 4 whenever you ship a change.

### Option B — Auto-deploy from GitHub (recommended once it's working)
Hostinger's shared hosting doesn't run your build step itself, so GitHub Actions builds it and FTPs the result over on every push. The workflow already lives in this repo at `.github/workflows/deploy.yml` — it just needs its secrets set once:

1. hPanel → **Files → FTP Accounts** — note the FTP host, username, password (or create a dedicated FTP account scoped to `durgacrm.nexovah.in`'s document root).
2. In your GitHub repo → **Settings → Secrets and variables → Actions**, add:
   - `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same values as your local `.env` — the build step needs these too)
3. That's it — every push to `main` now triggers the workflow: Actions tab shows the build+upload running, site updates automatically a couple minutes later. Until these secrets are added, the workflow runs and fails at the FTP step (harmless — nothing gets uploaded, no partial/broken deploy).

### Required environment variables
The app needs two Supabase values present when you run `npm run build` (Vite bakes them into the static output — nothing to configure on the Hostinger side itself):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
- **Option A**: put them in a local `.env` file (copy `.env.example`) before running `npm run build`.
- **Option B**: add them as GitHub Actions secrets and pass them via `env:` on the build step, e.g.:
  ```yaml
  - run: npm run build
    env:
      VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  ```

### Notes
- The app uses client-side path routing (e.g. `/chanda-collection`) — see the routing note above and `public/.htaccess`, which handles the "refresh on a sub-page 404s" issue.
- HTTPS: Hostinger issues a free SSL certificate per subdomain automatically (hPanel → SSL) — enable it once the subdomain is live.
- Mobile responsiveness: the UI already uses responsive Tailwind classes throughout (nav, dashboard tiles, forms, tables scroll horizontally on narrow screens). If you spot a specific screen/element that doesn't look right on a phone once it's live, flag it and I'll fix that spot directly.
