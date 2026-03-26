# Logical Boost Hub

Multi-tenant marketing platform where an agency team builds and manages AI-powered campaign systems for clients.

## Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **AI**: Anthropic Claude API (called from Supabase Edge Functions)
- **Landing Pages**: Google Stitch API (`@google/stitch-sdk`) for design generation
- **Hosting**: GitHub Pages (static export) + Supabase cloud
- **Deployment**: GitHub Actions auto-deploys to GitHub Pages on push to `master`

## Core Pipeline
```
Avatar → Offer → Angle → Copy Components → Ad Variations / Creatives / Scripts / Landing Pages
```

## Project Structure
```
src/
  app/                     — Next.js App Router pages
    avatars/page.tsx       — Avatar management (approve/deny AI-generated personas)
    business-overview/     — Client setup + AI business analysis
    competitor-intel/      — Unified competitor intelligence hub (3 tabs: Ads, Analysis, Playbook)
    competitor-ads/        — Competitor ads analysis (legacy, merged into competitor-intel)
    competitive-intel/     — Legacy route (replaced by competitor-intel)
    copy/page.tsx          — Copy page (formerly "Funnel") — all copy components for Avatar+Offer+Angle
    dashboard/page.tsx     — Main dashboard with getting started checklist
    funnel/page.tsx        — Legacy route (renamed to /copy/)
    intake/page.tsx        — AI-generated intake questionnaire
    landing-pages/page.tsx — Stitch-powered landing page builder (7-step pipeline)
    login/page.tsx         — Login page
    offers/page.tsx        — Offer management (approve/deny)
    settings/page.tsx      — Settings and user management
    stats/page.tsx         — Campaign stats overview (placeholder)
    layout.tsx             — Root layout (AppProvider + AppShell)
    globals.css            — All styles (dark theme, CSS custom properties, 3 responsive breakpoints)
  components/
    AppShell.tsx           — Layout shell (sidebar + header + content)
    Header.tsx             — Top bar with client switcher dropdown
    Sidebar.tsx            — Navigation sidebar (9 nav items)
    LogoUpload.tsx         — Logo upload component
  lib/
    api.ts                 — Edge function caller (all AI workflow API calls + Stitch pipeline)
    stitch.ts              — Stitch integration: template slot definitions, serialization, copy mapping
    store.tsx              — React Context state management (AppProvider/useAppStore)
    supabase.ts            — Supabase client + auth helpers + role-based client access
    demo-toast.ts          — Toast notification utility
  types/
    database.ts            — All TypeScript interfaces + ANGLES (15) + ANGLE_COLORS + TEMPLATE_INFO (8)
  hooks/
    useSupabase.ts         — Supabase hook
supabase/
  migrations/
    001_initial_schema.sql — 11 tables (clients, users, avatars, offers, etc.)
    002_rls_policies.sql   — Row Level Security policies per role
    003-009                — Phase 1 schema extensions, brand kit, storage, RLS fixes
    010_landing_page_playbook.sql — landing_page_playbook + landing_page_concepts on clients
    011_landing_page_builder.sql — template_id, page_html, section_data, brand_kit_snapshot, deploy_status
    012_storage_html_support.sql — HTML MIME type for client-assets bucket
    013_stitch_landing_pages.sql — Stitch fields (stitch_job_id, copy_slots, iteration_history, react_output, deploy_url) + competitor_intel updates + funnel_instances angle tracking
  functions/
    _shared/
      ai-client.ts         — Shared Claude API wrapper (callClaude, parseJsonResponse, CORS helpers)
      copywriter-prompts.ts — Comprehensive copywriting agent prompts (quality rules, batch configs, section guidance)
      template-renderer.ts — Legacy HTML renderer (being replaced by Stitch pipeline)
    analyze-business/      — Workflow 1: Analyze business → generate avatars/offers
    analyze-brand-kit/     — Workflow 9: Extract brand colors, fonts, visual identity (legacy — Stitch now extracts from URL)
    analyze-competitor-pages/ — Workflow 11: Analyze competitor landing pages
    discover-competitors/  — Workflow 10: AI-powered competitor discovery
    generate-avatars/      — Generate additional avatars via AI prompter
    generate-funnel/       — Workflow 4: Generate full campaign (3 parallel batches: ads, persuasion, video)
    generate-intake/       — Workflow 2: Generate intake questions
    generate-more/         — Workflow 5: Generate more items per section with AI prompter
    generate-landing-page/ — Legacy: Generate landing page with custom renderer
    generate-playbook/     — Workflow 12: Generate landing page industry playbook
    edit-landing-page-section/ — Legacy: AI-powered section editing
    recommend-angles/      — Recommend marketing angles for avatar+offer combo
    refine-system/         — Workflow 3: Refine avatars/offers after intake answers
    suggest-offers/        — Suggest new offers for a client
```

## Navigation Order (Sidebar)
1. Dashboard
2. Stats (placeholder)
3. Copy (centerpiece — formerly "Funnel")
4. Landing Pages (Stitch builder)
5. Business Overview
6. Intake
7. Avatars
8. Offers
9. Competitor Intel

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

## The 15 Marketing Angles

Controlled values — no additions, no renaming:
problem, outcome, fear, opportunity, curiosity, proof, authority, mechanism, speed, cost, comparison, identity, mistake, hidden_truth, before_after

Defined in `src/types/database.ts` with `ANGLES` constant, `ANGLE_COLORS` map, and `getAngleLabel()` helper.

## Client Management

- **Header dropdown** — Lists all clients. Select to switch, or "+ Add New Client"
- **Business Overview** → "+ Add New Client" button
- **Dashboard** → Shows "Add Your First Client" when none selected
- Clients stored in `clients` table, loaded via `loadAllClients()`
- Switching clients loads all related data (avatars, offers, copy, intake, competitors, landing pages)
- `brand_reference_url` field on clients — alternative URL for Stitch brand extraction if website doesn't reflect brand

## AI Workflow Pipeline

1. **Business Overview** → Enter name, URL, call notes → `analyze-business` edge function
   - AI generates: business_summary, services, differentiators, trust_signals, tone, ad_copy_rules, competitors, avatars, offers
2. **Intake** → `generate-intake` → AI creates targeted questions → User answers → `refine-system`
3. **Avatars / Offers** → Review and approve/deny AI-generated content
   - Avatars have `priority` field (1=highest) for ranking in selectors
4. **Copy** (formerly Funnel) → Select avatar + offer + angle → `generate-funnel`
   - 3 parallel AI batches: Ad Copy, Persuasion, Video
   - Generates ~130-180 copy components across 15 canonical types
   - Per-section "Generate More" with AI prompter
   - Video Ad Generator with hooks, scripts, CTAs
5. **Landing Pages** → Stitch-powered 7-step pipeline (see below)

## Landing Page Builder (Stitch Pipeline)

The Landing Pages page implements a 7-step pipeline powered by Google Stitch API.

### Architecture
- User selects Avatar + Offer → Platform packages copy payload → Sends to Stitch API with template prompt → Stitch returns visual preview → User approves → Platform converts to React → Deploys
- **No brand kit extraction needed** — Stitch extracts design system directly from client's website URL at render time
- Copy slots are always serialized to plain strings before assembly (never raw objects)
- All iterations stored in `iteration_history` for version control

### The 7 Steps
1. **Select Avatar + Offer** — Two dropdowns, approved only, avatars sorted by priority
2. **Select Template** — 8 template cards with name and "Best for" description
3. **Review Copy Slots** — Auto-fills from approved copy_components, inline editing, "Generate Missing Copy" for gaps
4. **Build with Stitch** — Assembles prompt (template spec + copy payload + client website URL + global design rules), sends to Stitch API
5. **Preview + Iterate** — Interactive preview in iframe, change request panel, version history
6. **Approve + Convert** — Converts Stitch output to React component
7. **Deploy** — One-click deploy, live URL displayed

### 8 Wireframe Templates
| ID | Name | Best For |
|----|------|----------|
| `template_1` | Conditional Funnel / Quiz-Led | Lead gen, high volume, financial/legal/home services |
| `template_2` | Problem/Solution + Category Segmentation | Multiple damage types, law, financial products |
| `template_3` | Feature-Dense Authority Page | SaaS, B2B platforms, complex products |
| `template_4` | Possibility Showcase / Output Gallery | Agencies, AI tools, creative services |
| `template_5` | Video + Social Proof Wall | Coaching, courses, personal brands |
| `template_6` | VSL / Long-Form Direct Response | High-ticket, cold traffic, skeptical audiences |
| `template_7` | Comparison / Us vs. Them | Challenger brands, switching markets |
| `template_8` | Urgency / Event-Driven | Storm damage, seasonal, deadline-sensitive offers |

### Stitch Integration (src/lib/stitch.ts)
- `TEMPLATE_SLOTS` — Copy slot definitions for all 8 templates (slot ID, label, content type, notes)
- `mapComponentsToSlots()` — Maps copy_components to template slots by type, returns filled + missing
- `serializeCopySlots()` — Serializes all slot values to plain strings (prevents [object Object])
- `serializeSlotValue()` — Handles strings, arrays, objects → plain string

### API Functions (src/lib/api.ts)
- `buildLandingPage()` — Sends copy payload + template to Stitch via edge function
- `iterateLandingPage()` — Sends change prompt to iterate on preview
- `approveLandingPage()` — Triggers React conversion
- `deployLandingPage()` — Deploys to live URL
- `generateMissingCopySlots()` — AI fills gaps in template slots

### Deploy Status Flow
`draft` → `pending_approval` → `approved` → `converting` → `deployed` (or `failed`)

### A/B Testing
Create two `landing_page` records with same `funnel_instance_id` but different `template_id`. Both deployed to separate URLs.

## Competitor Intel (3-Tab Hub)

The `/competitor-intel/` page consolidates all competitive intelligence:

1. **Competitor Ads** — Monitor competitor ads across channels (Meta Ad Library, Google Ads, manual)
2. **Competitive Analysis** — AI-generated analysis of competitor patterns, gaps, opportunities
3. **Industry Playbook** — AI-generated reference for proven LP structures, angles, offer patterns in client's industry

Fields on `competitor_intel` table: `intel_type` (ad/landing_page/keyword/industry_playbook/competitive_analysis), `angles_used`, `landing_page_structure`, `ai_analysis`

## Copywriting Agent

The `_shared/copywriter-prompts.ts` contains the comprehensive copywriting system:
- `COPYWRITER_IDENTITY` — Direct-response copywriter persona
- `QUALITY_RULES` — No fragments, specificity test, no-generic rule, emotional truth
- `FORMATTING_RULES` — FTC compliance, platform character limits
- `ANGLE_DEFINITIONS` — 15 marketing angles
- `BATCH_1_ADS` / `BATCH_2_PERSUASION` / `BATCH_3_VIDEO` — Parallel generation batch configs
- `getSectionGuidance()` — Per-type writing guidance for component types
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
- **CSS architecture note**: Copy page base styles come AFTER the main responsive breakpoints in globals.css, so copy-specific responsive overrides are at the END of the file to ensure proper cascade
- Key fix: `.main-area` needs `min-width: 0` and `overflow-x: hidden` to prevent flex item overflow on mobile

## Key Terminology
| Internal | Client-Facing | Notes |
|----------|---------------|-------|
| avatar | Avatar | Customer segment / audience profile |
| offer | Offer | Conversion proposition |
| angle | Angle | Psychological messaging approach (15 canonical) |
| copy_component | (not shown) | Atomic building block of messaging |
| funnel_instance | (internal) | Avatar + Offer + Angle combo record |
| landing_page | Landing Page | Built via Stitch pipeline |
| wireframe_template | Template | 1 of 8 structural layouts |
| stitch_prompt | (internal) | Assembled prompt sent to Stitch |
