# Durga Puja Management System (Community)

Admin web app for running a community Durga Puja committee — members, treasury, chanda (donation) collection, expenses, and dashboard overview.

Originally scaffolded from Figma Make: https://www.figma.com/design/g8QH9KavooiXRY4O0sFE6Z/Durga-Puja-Management-System--Community-

## Tech stack
React 18 + TypeScript, Vite 6, Tailwind CSS 4, Radix UI + MUI components, react-router, recharts, react-hook-form.

See [AGENTS.md](./AGENTS.md) for full architecture/feature breakdown and [SESSION.md](./SESSION.md) for the change log.

## Getting started
```bash
npm i           # install dependencies
npm run dev     # start dev server → http://localhost:5173
npm run build   # production build
```

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

## Repository
- GitHub: https://github.com/nexovah/durga-puja-management-system (private)
- Branch: `main`

## Maintenance
This README is kept up to date as the project evolves. For deeper technical/architecture notes for AI agents, see [AGENTS.md](./AGENTS.md).
