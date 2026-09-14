# Durga Puja Management System (Community)

Admin web app for running a community Durga Puja committee — members, treasury, chanda (donation) collection, expenses, and dashboard overview.

Originally scaffolded from Figma Make: https://www.figma.com/design/g8QH9KavooiXRY4O0sFE6Z/Durga-Puja-Management-System--Community-

## Tech stack
React 18 + TypeScript, Vite 6, Tailwind CSS 4, Radix UI + MUI components, react-router, recharts, react-hook-form.

See [AGENTS.md](./AGENTS.md) for full architecture/feature breakdown and [SESSION.md](./SESSION.md) for the change log.

## Getting started
1. `npm i` — installs dependencies (including `@supabase/supabase-js`).
2. Copy `.env.example` to `.env` and fill in your Supabase project's URL + anon key (see [supabase/README.md](./supabase/README.md) if you haven't created the project/database yet).
3. `npm run dev` — start dev server → http://localhost:5173
4. `npm run build` — production build (needs the same `.env` values present at build time)

The app requires a configured Supabase backend to run — without it, it shows a "Supabase is not configured" screen instead of data.

## Project structure
```
src/
  main.tsx
  app/
    App.tsx
    components/       # feature pages (Dashboard, Members, Treasury, ...)
    components/ui/     # shared UI primitives
  styles/
```

## Backend / Database
PostgreSQL schema for Supabase lives in [supabase/](./supabase/) — see [supabase/README.md](./supabase/README.md) for setup + REST API reference. The frontend is fully wired to it (`src/app/lib/db.ts`) — no `localStorage` data storage remains.

## Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting the frontend on Hostinger and the backend on Supabase.

## Repository
- GitHub: https://github.com/nexovah/durga-puja-management-system (private)
- Branch: `main`

## Maintenance
This README is kept up to date as the project evolves. For deeper technical/architecture notes for AI agents, see [AGENTS.md](./AGENTS.md).
