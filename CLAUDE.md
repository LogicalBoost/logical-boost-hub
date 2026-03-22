# logical-boost-hub

## Stack
- Next.js (App Router)
- Supabase (Auth, Database, Realtime)
- TypeScript

## Project Structure
```
src/
  app/              — Next.js App Router pages and layouts
    api/            — API routes
    (auth)/         — Auth pages (login, signup)
    (dashboard)/    — Protected dashboard pages
  components/       — React components
    ui/             — Reusable UI primitives
  lib/              — Supabase client, shared logic
  hooks/            — Custom React hooks
  types/            — TypeScript type definitions
  utils/            — Utility functions
public/             — Static assets
supabase/
  migrations/       — SQL migration files
```

## Commands
- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npx supabase start` — Start local Supabase
- `npx supabase db push` — Push migrations to remote

## Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
