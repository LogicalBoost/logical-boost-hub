# Logical Boost Hub

Multi-tenant marketing platform where an agency team builds and manages AI-powered campaign systems for clients.

## Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **AI**: Anthropic Claude API (called from Supabase Edge Functions)
- **Landing Pages**: Template-based system. Pre-built React templates in separate repo (`LogicalBoost/landing-pages`), rendered with brand kit + copy + media assets. Deployed via Vercel.
- **Hero Images**: Google Gemini 3.1 Flash (image preview) via Generative Language API for AI-generated photorealistic hero shots. Uses `generateContent` with `responseModalities: ["IMAGE"]`. GOOGLE_AI_API_KEY set as Supabase secret.
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
    landing-pages/page.tsx — Landing page builder (template-based pipeline)
    login/page.tsx         — Login page
    offers/page.tsx        — Offer management (approve/deny)
    settings/page.tsx      — Settings and user management
    stats/page.tsx         — Campaign stats overview (placeholder)
    layout.tsx             — Root layout (AppProvider + AppShell)
    globals.css            — All styles (dark theme, CSS custom properties, 3 responsive breakpoints)
  components/
    AppShell.tsx           — Layout shell (sidebar + header + content)
    Header.tsx             — Top bar with client switcher dropdown
    Sidebar.tsx            — Navigation sidebar (9 nav items, collapsed state shows icon.png not full logo)
    LogoUpload.tsx         — Logo upload component
  lib/
    api.ts                 — Edge function caller (all AI workflow API calls + landing page pipeline). Errors parse response body for detailed messages.
    template-slots.ts      — Template copy slot definitions, serialization, copy mapping
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
    014_client_assets.sql   — client_assets table for persistent image storage (hero, parallax, logo, photo)
    015_client_assets_anon_policies.sql — Anon RLS policies for client_assets (temporary, pre-auth)
  functions/
    _shared/
      ai-client.ts         — Shared Claude API wrapper (callClaude, parseJsonResponse, CORS helpers)
      stitch-client.ts     — Google Stitch SDK wrapper (generateWithStitch, editWithStitch)
      copywriter-prompts.ts — Comprehensive copywriting agent prompts (quality rules, batch configs, section guidance)
      template-renderer.ts — Legacy HTML renderer (replaced by Stitch pipeline)
    analyze-business/      — Workflow 1: Analyze business → generate avatars/offers
    analyze-brand-kit/     — Workflow 9: Extract brand colors, fonts, visual identity (legacy)
    analyze-competitor-pages/ — Workflow 11: Analyze competitor landing pages
    # build-landing-page/  — REMOVED (Stitch pipeline killed)
    # iterate-landing-page/ — REMOVED (Stitch pipeline killed)
    discover-competitors/  — Workflow 10: AI-powered competitor discovery
    generate-avatars/      — Generate additional avatars via AI prompter
    generate-funnel/       — Workflow 4: Generate full campaign (3 parallel batches: ads, persuasion, video)
    generate-hero-image/   — Workflow 8: AI hero image generation (Gemini 3.1 Flash) for landing pages
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
4. Landing Pages
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
- Switching clients loads all related data (avatars, offers, copy, intake, competitors, landing pages, client assets)
- `brand_reference_url` field on clients — alternative URL for brand extraction if website doesn't reflect brand

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
5. **Landing Pages** → Design engine pipeline (see below)

## Landing Page Builder

**Architecture change (March 2026):** Stitch API has been removed. Landing pages are now built with a **template-based system** — pre-built React templates + brand kit + AI-generated copy + uploaded media assets. See `/docs/` for full specs.

### How It Works
1. **AI generates copy** (sections JSON) via existing Workflow 7 — unchanged
2. **Agency sets up brand kit** — colors, fonts, logo (once per client)
3. **Agency uploads media** — hero images, testimonial photos, badges, parallax backgrounds
4. **Agency picks template** — one of 4 templates from `page_templates` table
5. **Platform assembles the page** — duplicates template into client directory, rebrands with brand kit, injects copy and media
6. **Deployed via Vercel** — separate repo `LogicalBoost/landing-pages`, dynamic `[slug]` routing

### New Database Tables (migration 016)
- **`brand_kits`** — per-client colors, fonts, logo, button styles (one per client)
- **`media_assets`** — uploaded images/videos tagged with role + avatar (replaces old `client_assets`)
- **`page_templates`** — 4 template definitions with section_schema and slot_schema
- **`published_pages`** — tracks every live landing page (slug, domain, status)

### 4 Templates (stored in `page_templates` table)
| Slug | Name | Best For |
|------|------|----------|
| `lead-capture-classic` | Lead Capture Classic | Standard lead gen — inspections, quotes, consultations |
| `bold-split` | Bold Split | High-urgency, fear/risk, storm damage, emergency |
| `social-proof-heavy` | Social Proof Heavy | Trust-first industries, credibility barriers |
| `minimal-direct` | Minimal Direct | Simple offers, call-only pages, clean look |

### Media Asset Roles (controlled values)
`hero_image`, `hero_video`, `testimonial_photo`, `team_photo`, `background_texture`, `before_after`, `process_step`, `certification_badge`, `company_logo`, `gallery`, `icon_custom`, `parallax`, `photo`, `other`

### AI Hero Image Generation
- Powered by Google Gemini 3.1 Flash (`gemini-3.1-flash-image-preview`)
- **4 styles**: Hero Shot, Family/Group, Trust Portrait, Lifestyle
- **Avatar-aware prompts** — clothing, posture, vibe match avatar description
- **Offer-aware icons** — gated to avatar+offer context. "If in doubt, use NO icons."
- **Transparent background** — all styles enforce blank/transparent background
- Saved to `media_assets` table with `avatar_id` for reuse
- `generate-hero-image` edge function: Gemini API → Supabase Storage → `media_assets` record
- **Auth**: `GOOGLE_AI_API_KEY` (Google AI Studio, free tier)
- **Never mention "Gemini" or "AI-generated" in UI** — just "Hero Image"

### Frontend Pipeline (4 UI Steps — currently)
1. **Select Avatar + Offer** — Two dropdowns, approved only, avatars sorted by priority
2. **Select Template** — Template cards from `page_templates` table
3. **Review Copy + Media** — Copy slots auto-filled from components; hero image generator; saved image galleries; parallax background upload
4. **Build Page** — Placeholder (template assembly pipeline not yet built)

### Key Files
- **`src/lib/template-slots.ts`** — Template copy slot definitions, `mapComponentsToSlots()`, `serializeCopySlots()`
- **`src/lib/api.ts`** — `generateHeroImage()` and other AI workflow API calls
- **`supabase/functions/generate-hero-image/index.ts`** — Gemini image generation edge function
- **`docs/landing_page_operational_workflow.md`** — Full workflow spec
- **`docs/claude_code_instructions_landing_pages.md`** — Implementation instructions
- **`docs/landing_page_templates_build_guide.md`** — Template build guide for separate repo

### Landing Page Repo Architecture (One Repo Per Client)
- **`LogicalBoost/landing-page-templates`** — Master template library. GitHub Template Repository. Never deployed directly. Contains 4 templates, shared components, ThemeProvider, TemplateRenderer, `[slug]` catch-all route.
- **`LogicalBoost/[client-slug]-pages`** — One repo per client. Generated from template repo via GitHub API when first landing page is built. Brand kit baked in, `CLIENT_ID` env var scopes queries. All client pages are routes within this one repo.
- **Vercel project per client** — Created via Vercel API, linked to client repo. Custom domain attached. Auto-deploys on push.
- **Claude Code refinement** — Team opens client repo, makes changes, previews locally, pushes → Vercel auto-deploys. Static overrides at `/pages/overrides/[slug].jsx`.
- See `docs/vercel_deployment_guide.md` for full Vercel API integration details.

### Client Deployment Fields (migration 017)
Added to `clients` table: `github_repo`, `vercel_project_id`, `vercel_url`, `custom_domain`, `domain_verified`

### Deploy Status Flow
`draft` → `published` → `archived`

### A/B Testing
Create two `published_pages` records with same avatar+offer but different `template_id`. Both get separate slugs/URLs.

### Required Secrets for Deployment
- `VERCEL_TOKEN` — Vercel API token (Pro plan required)
- `VERCEL_TEAM_ID` — Vercel Team ID
- `GITHUB_TOKEN` — GitHub PAT with repo scope (for creating client repos from template)

### Remaining TODO
- Build the `LogicalBoost/landing-page-templates` repo (4 templates, shared components, ThemeProvider, TemplateRenderer, catch-all route)
- Brand Kit editor UI (Business Overview page)
- Media Assets manager UI (upload, tag with role + avatar)
- Template picker UI with media slot mapper
- Hub-side automation: GitHub API (create client repo) + Vercel API (create project, add domain)
- Published Pages manager (URLs, domains, status)
- "Export for Editing" feature (render page to static .jsx override file)

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
- `GOOGLE_AI_API_KEY` — Google AI Studio API key for Gemini Flash hero image generation (from aistudio.google.com, free tier)

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
| landing_page | Landing Page | Copy + sections JSON for a page |
| page_template | Template | 1 of 4 pre-built React layouts (in `page_templates` table) |
| published_page | (internal) | Live page with slug, domain, deploy status |
| brand_kit | Brand Kit | Client visual identity (colors, fonts, logo) |
| media_asset | Media Asset | Uploaded image/video tagged with role + avatar |
