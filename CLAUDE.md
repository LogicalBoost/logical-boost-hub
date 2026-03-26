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
    competitive-intel/     — Competitor intel CRUD + AI discovery
    competitor-ads/        — Competitor ads analysis
    dashboard/page.tsx     — Main dashboard with getting started checklist
    funnel/page.tsx        — Campaign funnel builder (avatar + offer + copy generator + video ads)
    intake/page.tsx        — AI-generated intake questionnaire
    landing-pages/page.tsx — Landing page pipeline (brand kit → competitive → playbook → concepts → builder + deploy)
    login/page.tsx         — Login page
    offers/page.tsx        — Offer management (approve/deny)
    settings/page.tsx      — Settings and user management
    stats/page.tsx         — Campaign stats overview
    layout.tsx             — Root layout (AppProvider + AppShell)
    globals.css            — All styles (dark theme, CSS custom properties, 3 responsive breakpoints)
  components/
    AppShell.tsx           — Layout shell (sidebar + header + content)
    Header.tsx             — Top bar with client switcher dropdown
    Sidebar.tsx            — Navigation sidebar (9 nav items)
    LogoUpload.tsx         — Logo upload component for brand kit
  lib/
    api.ts                 — Edge function caller (all AI workflow API calls)
    store.tsx              — React Context state management (AppProvider/useAppStore)
    supabase.ts            — Supabase client + auth helpers + role-based client access
    demo-toast.ts          — Toast notification utility
  types/
    database.ts            — All TypeScript interfaces + ANGLES constant + ANGLE_COLORS
  hooks/
    useSupabase.ts         — Supabase hook
supabase/
  migrations/
    001_initial_schema.sql — 11 tables (clients, users, avatars, offers, etc.)
    002_rls_policies.sql   — Row Level Security policies per role
    003-009                — Phase 1 schema extensions, brand kit, storage, RLS fixes
    010_landing_page_playbook.sql — landing_page_playbook + landing_page_concepts on clients
    011_landing_page_builder.sql — template_id, page_html, section_data, brand_kit_snapshot, deploy_status columns
    012_storage_html_support.sql — Add text/html MIME type to client-assets bucket for LP deployment
  functions/
    _shared/
      ai-client.ts         — Shared Claude API wrapper (callClaude, parseJsonResponse, CORS helpers)
      copywriter-prompts.ts — Comprehensive copywriting agent prompts (quality rules, batch configs, section guidance)
      template-renderer.ts — Landing page HTML renderer (3,300+ lines, 4 premium templates with glassmorphism/gradients)
    analyze-business/      — Workflow 1: Analyze business → generate avatars/offers
    analyze-brand-kit/     — Workflow 9: Extract brand colors, fonts, visual identity from website
    analyze-competitor-pages/ — Workflow 11: Analyze competitor landing pages
    discover-competitors/  — Workflow 10: AI-powered competitor discovery
    generate-avatars/      — Generate additional avatars via AI prompter
    generate-funnel/       — Workflow 4: Generate full campaign (3 parallel batches: ads, persuasion, video)
    generate-intake/       — Workflow 2: Generate intake questions
    generate-more/         — Workflow 5: Generate more items per section with AI prompter
    generate-landing-page/ — Workflow 13: Generate full landing page (AI content + HTML render) per avatar/offer/template
    generate-playbook/     — Workflow 12: Generate landing page industry playbook
    edit-landing-page-section/ — Workflow 14: AI-powered section or full-page editing with user prompts
    recommend-angles/      — Recommend marketing angles for avatar+offer combo
    refine-system/         — Workflow 3: Refine avatars/offers after intake answers
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
   - Avatars have `priority` field (1=highest) for ranking in funnel selector
4. **Funnel** → Select avatar + offer → `generate-funnel`
   - 3 parallel AI batches: Ad Copy (BATCH_1_ADS), Persuasion (BATCH_2_PERSUASION), Video (BATCH_3_VIDEO)
   - Generates ~130-180 copy components across 21 types
   - Per-section "Generate More" with AI prompter calls `generate-more`
   - Video Ad Generator with hooks, short scripts, long scripts, CTAs
   - Bulk select & deny for bad copy
5. **Landing Pages** → 5-stage pipeline:
   - Brand Kit → `analyze-brand-kit` extracts colors, fonts, visual identity
   - Competitive Analysis → `analyze-competitor-pages` analyzes competitor landing pages
   - Industry Playbook → `generate-playbook` synthesizes patterns, gaps, concept briefs
   - Concept Pages → Shows 4 strategic landing page concepts from playbook
   - Page Builder → Select avatar + offer + template → `generate-landing-page` → AI edit → deploy to live URL

## Landing Page Builder

The Page Builder (stage 5 of the Landing Pages pipeline) generates, edits, and deploys full landing pages.

### Architecture
- **AI generates structured JSON** (section_data) → **deterministic renderer produces self-contained HTML** (page_html)
- This separation ensures consistent, well-formed HTML while AI controls content and renderer controls design
- HTML is fully self-contained: inline CSS, Google Fonts, minimal JS (scroll animations, mobile nav)

### 4 Premium Templates
| Template | ID | Sections | Style |
|----------|---|----------|-------|
| Clean Authority | `clean_authority` | hero, problem, solution, benefits, proof, faq, final_cta | Professional, trust-focused |
| Bold Conversion | `bold_conversion` | hero, urgency_bar, trust_strip, problem, solution, benefits, proof, faq, final_cta | Urgency-driven, high-conversion |
| Gap Play | `gap_play` | hero, problem, process_steps, benefits, proof, faq, final_cta | Before/after gap positioning |
| Aggressive DR | `aggressive_dr` | hero, urgency_bar, trust_strip, benefits, proof, problem, process_steps, proof, faq, final_cta | Direct response, proof-heavy |

### Template Design (template-renderer.ts)
- Dark-mode-first with gradient mesh backgrounds and animated floating orbs
- Glassmorphism: frosted glass nav, cards with `backdrop-filter: blur`
- Gradient text headlines (`-webkit-background-clip: text`)
- Scroll-triggered animations via IntersectionObserver
- Noise texture overlays, custom scrollbars, pill-shaped buttons with glow
- Fully responsive with mobile hamburger nav

### Builder UI (landing-pages/page.tsx)
- Split-pane layout: section list (left) + iframe preview (right) using `srcDoc`
- Desktop/Tablet/Mobile preview toggles
- AI Edit panel: edit individual sections or full page with natural language prompts
- Deploy bar: custom slug input → uploads HTML to Supabase Storage → shows LIVE badge with public URL
- Avatar dropdown sorted by priority ranking

### Deployment
- HTML uploaded to Supabase Storage bucket `client-assets` at path `{client_id}/pages/{slug}.html`
- Public URL format: `https://{project}.supabase.co/storage/v1/object/public/client-assets/{client_id}/pages/{slug}.html`
- Deploy status tracked: `draft` → `deployed` (with `deployed_url` saved to DB)
- Re-deploy overwrites existing file (upsert)
- Future: subdomain support (e.g., start.clientname.com) via reverse proxy

### Edge Functions
- `generate-landing-page` — Fetches client/avatar/offer/copy_components, builds prompts, calls Claude (sonnet, 8192 tokens), renders HTML, inserts landing_pages record
- `edit-landing-page-section` — Section-level or full-page AI editing, re-renders HTML after edit, updates DB
- Both use `renderLandingPage(templateId, sections, brandKit, offer, clientName, logoUrl?)` from `template-renderer.ts`

## Copywriting Agent

The `_shared/copywriter-prompts.ts` contains the comprehensive copywriting system:
- `COPYWRITER_IDENTITY` — Direct-response copywriter persona
- `QUALITY_RULES` — No fragments, specificity test, no-generic rule, emotional truth
- `FORMATTING_RULES` — FTC compliance, platform character limits
- `ANGLE_DEFINITIONS` — 10 marketing angles (problem, outcome, proof, curiosity, etc.)
- `BATCH_1_ADS` / `BATCH_2_PERSUASION` / `BATCH_3_VIDEO` — Parallel generation batch configs
- `getSectionGuidance()` — Per-type writing guidance for 21 component types
- `buildBatchSystemPrompt()` / `buildUserMessage()` — Prompt builders

## Commands
- `npm run dev` — Start development server (port 3000)
- `npm run build` — Production build (static export)
- `npm run lint` — Run ESLint
- `npx supabase db push` — Push migrations to remote Supabase
- `npx supabase functions deploy` — Deploy all edge functions
- `npx supabase functions deploy <name> --no-verify-jwt` — Deploy single function
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
- **Push to master**: `git push origin <branch>:master` to trigger deploy

### Supabase (Backend)
- Project ref: `nkeswemyzzkpsciwhlqc`
- Edge functions deployed with `--no-verify-jwt` (auth handled at application level)
- All edge functions share `_shared/ai-client.ts` which uses Claude claude-sonnet-4-6

## Styling
- Dark theme using CSS custom properties in `globals.css`
- No CSS framework — all custom styles
- 3 responsive breakpoints: 1024px (tablet landscape), 768px (tablet/mobile), 480px (phone)
- Mobile: compact angle dots instead of text badges, stacked layouts, horizontal-scroll tabs
- **CSS architecture note**: Funnel page base styles come AFTER the main responsive breakpoints in globals.css, so funnel-specific responsive overrides are at the END of the file to ensure proper cascade
- Key fix: `.main-area` needs `min-width: 0` and `overflow-x: hidden` to prevent flex item overflow on mobile
