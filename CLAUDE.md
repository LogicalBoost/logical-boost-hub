# Logical Boost Hub

Multi-tenant marketing platform where an agency team builds and manages AI-powered campaign systems for clients.

## Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **AI**: Anthropic Claude API (called from Supabase Edge Functions)
- **Landing Pages**: Template-based system. Pre-built React templates rendered inside the Hub itself with brand kit + copy + media assets. All pages served from the Hub — NO separate deployments per client.
- **Hero Images**: Google Gemini 3.1 Flash (image preview) via Generative Language API for AI-generated photorealistic hero shots. Uses `generateContent` with `responseModalities: ["IMAGE"]`. GOOGLE_AI_API_KEY set as Supabase secret.
- **Hosting**: Vercel (SSR) + Supabase cloud
- **Deployment**: Vercel auto-deploys on push to `master`. Hub lives at `hub.logicalboost.com`.

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
    copy/page.tsx          — Copy page (formerly "Funnel") — all copy components for Avatar+Offer+Angle
    dashboard/page.tsx     — Main dashboard with getting started checklist
    intake/page.tsx        — AI-generated intake questionnaire
    landing-pages/page.tsx — Landing page builder (template-based pipeline)
    login/page.tsx         — Login page with forgot password / password reset flow
    offers/page.tsx        — Offer management (approve/deny)
    p/                     — Landing page rendering (no Hub chrome)
      layout.tsx           — Clean layout for public landing pages (Tailwind CSS)
      landing-page.css     — Tailwind imports + button texture styles
      [client]/[slug]/page.tsx — Dynamic route: renders landing page from published_pages
    settings/page.tsx      — Settings and user management
    stats/page.tsx         — Campaign stats overview (placeholder)
    layout.tsx             — Root layout (AppProvider + AppShell)
    globals.css            — All styles (dark theme, CSS custom properties, 3 responsive breakpoints)
  components/
    AppShell.tsx           — Layout shell (sidebar + header + content). Bypasses shell for /p/ and /login routes.
    Header.tsx             — Top bar with client switcher dropdown
    Sidebar.tsx            — Navigation sidebar (9 nav items, collapsed state shows icon.png not full logo)
    LogoUpload.tsx         — Logo upload component
    templates/
      LeadCaptureClassic.tsx — Lead Capture Classic template (white hero, animated bg, feature cards, parallax, FAQ, etc.)
      types.ts             — TypeScript interfaces: Section, SectionItem, MediaAssets, BrandKit
    shared/
      AnimatedBackground.tsx — Floating geometric shapes and gradient orbs for hero sections
  lib/
    api.ts                 — Edge function caller (all AI workflow API calls + deployLandingPage). Errors parse response body for detailed messages.
    template-slots.ts      — Template copy slot definitions, serialization, copy mapping
    store.tsx              — React Context state management (AppProvider/useAppStore)
    supabase.ts            — Supabase client + auth helpers + role-based client access
    demo-toast.ts          — Toast notification utility
  types/
    database.ts            — All TypeScript interfaces + ANGLES (15) + ANGLE_COLORS + AVAILABLE_TEMPLATES + TemplateId
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
    013_stitch_landing_pages.sql — Legacy Stitch fields + competitor_intel updates + funnel_instances angle tracking
    014_client_assets.sql   — client_assets table for persistent image storage (hero, parallax, logo, photo)
    015_client_assets_anon_policies.sql — Anon RLS policies for client_assets (temporary, pre-auth)
  functions/
    _shared/
      ai-client.ts         — Shared Claude API wrapper (callClaude, parseJsonResponse, CORS helpers)
      copywriter-prompts.ts — Comprehensive copywriting agent prompts (quality rules, batch configs, section guidance)
    analyze-business/      — Workflow 1: Analyze business → generate avatars/offers
    analyze-brand-kit/     — Workflow 9: Extract brand colors, fonts, visual identity
    analyze-competitor-pages/ — Workflow 11: Analyze competitor landing pages
    deploy-landing-page/   — Creates client GitHub repo from template, pushes page data, saves to landing_pages table
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

**Current state**: Auth is enforced. Login page has password reset flow. AuthProvider redirects unauthenticated users to `/login/`. RLS is active on all tables.

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
5. **Landing Pages** → Template-based builder (see below)

## Landing Page Builder

### Architecture: Hub-Served Pages

All landing pages are served directly from the Hub at `hub.logicalboost.com/p/[client-slug]/[page-slug]`. There are NO separate Vercel projects or deployments per client. The Hub's Next.js app has a dynamic catch-all route that renders pages using pre-built React templates.

### URL Structure
```
hub.logicalboost.com/p/[client-slug]/[page-slug]
```
Examples:
- `hub.logicalboost.com/p/upstart/gig` — Upstart's gig worker landing page
- `hub.logicalboost.com/p/summit-roofing/storm` — Summit Roofing's storm damage page

Custom domains: Client points DNS to Vercel → Hub middleware detects domain → rewrites to correct client slug.

### How It Works
1. **AI generates copy** (sections JSON) via existing copy pipeline
2. **Agency sets up brand kit** — colors, fonts, logo (once per client)
3. **Agency uploads media** — hero images, parallax backgrounds, testimonial photos
4. **Agency picks template** — from available built templates (currently: Lead Capture Classic)
5. **Agency assigns slug** — e.g., `gig`, `homeowner`, `storm-damage`
6. **Page data saved** to `published_pages` table in Supabase
7. **Page is immediately live** at `hub.logicalboost.com/p/[client-slug]/[slug]`
8. **GitHub repo created** for client (`LogicalBoost/[client-slug]-pages`) so team can open Claude Code to refine

### How Pages Are Rendered
The Hub has a dynamic route: `src/app/p/[client]/[slug]/page.tsx`

This route:
1. Looks up the `published_pages` record by client slug + page slug
2. Loads the brand kit, copy slots, media assets
3. Injects brand kit as CSS custom properties
4. Renders the appropriate template component (e.g., LeadCaptureClassic)
5. Returns a fully rendered landing page — no Hub chrome (no sidebar, no header)

### Templates (Built)
| Slug | Name | Status |
|------|------|--------|
| `lead-capture-classic` | Lead Capture Classic | Built — white hero, animated bg, feature cards, two-column info, steps, parallax trust bar, benefits grid, testimonials, FAQ, footer |
| `bold-split` | Bold Split | Coming soon |
| `social-proof-heavy` | Social Proof Heavy | Coming soon |
| `minimal-direct` | Minimal Direct | Coming soon |

Template components live in `src/components/templates/`. Types in `src/components/templates/types.ts`.

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

### Frontend Pipeline (4 UI Steps)
1. **Select Avatar + Offer** — Two dropdowns, approved only, avatars sorted by priority
2. **Select Template** — Template cards (only built templates selectable, others show "Coming Soon")
3. **Review Copy + Media** — Copy slots auto-filled from components; hero image generator; saved image galleries; parallax background upload
4. **Build Page** — Assign slug, deploy button, shows preview URL + GitHub repo link on success

### GitHub Repos (For Editing Only)
Each client gets a GitHub repo: `LogicalBoost/[client-slug]-pages`

This repo:
- Contains page data files (JSON with copy slots, media URLs, brand kit)
- Can contain static JSX override files for pages needing custom tweaks
- Is opened with Claude Code for refinement
- Changes pushed to the repo trigger a webhook that updates the Supabase data

The repo is NOT deployed separately. It's a version-controlled editing workspace.

### Custom Domains
1. Client points DNS (CNAME) to `cname.vercel-dns.com`
2. In Vercel dashboard, add the custom domain to the Hub project
3. In the Hub database, save `custom_domain` on the `clients` table
4. Hub's middleware detects the domain and serves the right client's pages

### Client Deployment Fields
On `clients` table: `github_repo`, `vercel_project_id`, `vercel_url`, `custom_domain`, `domain_verified`

### Deploy Status Flow
`draft` → `published` → `archived`

### A/B Testing
Create two `published_pages` records with same avatar+offer but different `template_id`. Both get separate slugs/URLs.

### Required Secrets for Deployment
- `GITHUB_TOKEN` — GitHub PAT with repo scope (for creating client repos from template)

### Key Files
- **`src/app/p/[client]/[slug]/page.tsx`** — Dynamic route that renders published landing pages
- **`src/app/p/layout.tsx`** — Clean layout for landing page routes (no Hub shell)
- **`src/components/templates/LeadCaptureClassic.tsx`** — Lead Capture Classic template
- **`src/components/templates/types.ts`** — Section, SectionItem, MediaAssets, BrandKit interfaces
- **`src/components/shared/AnimatedBackground.tsx`** — Animated hero background
- **`src/lib/template-slots.ts`** — Template copy slot definitions, `mapComponentsToSlots()`, `serializeCopySlots()`
- **`src/lib/api.ts`** — `deployLandingPage()` and other AI workflow API calls
- **`supabase/functions/deploy-landing-page/index.ts`** — Edge function: creates client repo, pushes page data, saves record
- **`docs/vercel_deployment_guide.md`** — Full Hub-served architecture documentation

### Remaining TODO
- Update `deploy-landing-page` edge function to save to `published_pages` (currently still creates separate Vercel projects)
- Add slug input to Step 4 UI
- Brand Kit editor UI (Business Overview page)
- Media Assets manager UI (upload, tag with role + avatar)
- Custom domain middleware
- Published Pages manager (URLs, domains, status)
- Build remaining 3 templates (bold-split, social-proof-heavy, minimal-direct)

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
- `npm run build` — Production build
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

### Vercel (Frontend)
- SSR deployment at `hub.logicalboost.com`
- Auto-deploys on push to `master`
- No basePath, no static export — standard Next.js SSR
- `next.config.ts`: only `images: { unoptimized: true }`
- **Push to master**: `git push origin <branch>:master` to trigger deploy

### Supabase (Backend)
- Project ref: `nkeswemyzzkpsciwhlqc`
- Edge functions deployed with `--no-verify-jwt` (auth handled at application level)
- All edge functions share `_shared/ai-client.ts` which uses Claude claude-sonnet-4-6

## Styling
- Dark theme using CSS custom properties in `globals.css`
- No CSS framework — all custom styles (Hub pages). Landing page templates use Tailwind CSS.
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
| page_template | Template | Pre-built React layout (in `src/components/templates/`) |
| published_page | (internal) | Live page with slug, domain, deploy status |
| brand_kit | Brand Kit | Client visual identity (colors, fonts, logo) |
| media_asset | Media Asset | Uploaded image/video tagged with role + avatar |
