# Logical Boost Hub

Multi-tenant marketing platform where an agency team builds and manages AI-powered campaign funnels for clients.

## Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **AI**: Anthropic Claude API (called from Supabase Edge Functions)
- **Hosting**: GitHub Pages (static export) + Supabase cloud
- **Deployment**: GitHub Actions auto-deploys to GitHub Pages on push to `master`

## Project Structure
```
src/
  app/                     — Next.js App Router pages
    avatars/page.tsx       — Avatar management (approve/deny AI-generated personas)
    business-overview/     — Client setup + AI business analysis
    competitor-ads/        — Competitor intel CRUD
    dashboard/page.tsx     — Main dashboard with getting started checklist
    funnel/page.tsx        — Campaign funnel builder (avatar + offer + angle)
    intake/page.tsx        — AI-generated intake questionnaire
    login/page.tsx         — Login page
    offers/page.tsx        — Offer management (approve/deny)
    stats/page.tsx         — Campaign stats overview
    layout.tsx             — Root layout (AppProvider + AppShell)
    globals.css            — All styles (dark theme, CSS custom properties)
  components/
    AppShell.tsx           — Layout shell (sidebar + header + content)
    Header.tsx             — Top bar with client name display
    Sidebar.tsx            — Navigation sidebar (8 nav items)
  lib/
    api.ts                 — Edge function caller (all AI workflow API calls)
    store.tsx              — React Context state management (AppProvider/useAppStore)
    supabase.ts            — Supabase client + auth helpers + role-based client access
    demo-toast.ts          — Toast notification utility
  types/
    database.ts            — All TypeScript interfaces + ANGLES constant
  hooks/
    useSupabase.ts         — Supabase hook
supabase/
  migrations/
    001_initial_schema.sql — 11 tables (clients, users, avatars, offers, etc.)
    002_rls_policies.sql   — Row Level Security policies per role
  functions/
    _shared/ai-client.ts   — Shared Claude API wrapper for all edge functions
    analyze-business/      — Workflow 1: Analyze business → generate avatars/offers
    generate-intake/       — Workflow 2: Generate intake questions
    refine-system/         — Workflow 3: Refine avatars/offers after intake answers
    generate-funnel/       — Workflow 4: Generate full campaign (copy components)
    generate-more/         — Workflow 5: Generate more items per section
    recommend-angles/      — Recommend marketing angles for avatar+offer combo
    suggest-offers/        — Suggest new offers for a client
```

## Access Levels / Roles

The database enforces four roles via RLS policies in `002_rls_policies.sql`:

| Role | Access |
|------|--------|
| `admin` | Full CRUD on all tables, all clients |
| `team_editor` | Full CRUD on assigned clients (via `client_assignments` table) |
| `team_viewer` | Read-only on assigned clients |
| `client` | Read own client data + can deny content (set status to 'denied') |

Key helper functions in the database:
- `get_user_role()` — Returns current user's app role from `users` table
- `has_client_access(client_id)` — Checks if current user can access a given client

The `users` table extends `auth.users` with: role, client_id, status.
The `client_assignments` table maps team members to clients (many-to-many).

**Current state**: Auth pages exist but the frontend does not yet enforce login or role-based routing. RLS is active on all tables, so queries will fail without an authenticated session.

## Client Management

The agency owner/client manager adds and manages clients through the platform:

- **Header dropdown** — Lists all clients in the system. Select to switch, or choose "+ Add New Client"
- **Business Overview** → "+ Add New Client" button opens the setup form even when viewing an existing client
- **Dashboard** → Shows "Add Your First Client" when no client is selected
- Clients are stored in the `clients` table and loaded on app init via `loadAllClients()`
- Switching clients loads all related data (avatars, offers, funnels, intake, competitors)

## AI Workflow Pipeline

The user flow for onboarding a new client:

1. **Business Overview** → Enter name, URL, call notes → `analyze-business` edge function
   - AI generates: business_summary, services, differentiators, trust_signals, tone, ad_copy_rules, competitors, avatars, offers
2. **Intake** → `generate-intake` → AI creates targeted questions → User answers → `refine-system`
   - AI refines avatars and offers based on intake answers
3. **Avatars / Offers** → Review and approve/deny AI-generated content
4. **Funnel** → Select avatar + offer + angle → `generate-funnel`
   - AI generates copy components: headlines, descriptions, CTAs, video hooks, etc.
   - Per-section "Generate More" calls `generate-more`

## Commands
- `npm run dev` — Start development server (port 3000)
- `npm run build` — Production build (static export)
- `npm run lint` — Run ESLint
- `npx supabase db push` — Push migrations to remote Supabase
- `npx supabase functions deploy` — Deploy all edge functions
- `npx supabase secrets set KEY=value` — Set edge function secrets

## Environment Variables

### Frontend (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public key

### Edge Functions (Supabase Secrets)
- `ANTHROPIC_API_KEY` — Claude API key for AI generation

## Deployment

### GitHub Pages (Frontend)
- Static export via `next.config.ts`: `output: 'export'`, `basePath: '/logical-boost-hub'`, `trailingSlash: true`
- Auto-deploys on push to `master` via GitHub Actions
- **Important**: Never manually add basePath in `<Link href>` or `router.replace()` — Next.js auto-prepends it
- `usePathname()` returns the full path INCLUDING basePath

### Supabase (Backend)
- Project ref: `nkeswemyzzkpsciwhlqc`
- Edge functions deployed with `--no-verify-jwt` (auth handled at application level)
- All edge functions share `_shared/ai-client.ts` which uses Claude claude-sonnet-4-6

## Styling
- Dark theme using CSS custom properties in `globals.css`
- No CSS framework — all custom styles
- Mobile responsive at 768px breakpoint
