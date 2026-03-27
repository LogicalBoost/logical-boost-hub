# Logical Boost Hub

Multi-tenant marketing platform where an agency team builds and manages AI-powered campaign systems for clients.

## Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **AI**: Anthropic Claude API (called from Supabase Edge Functions)
- **Landing Pages**: Google Stitch API (`@google/stitch-sdk`) for design generation. STITCH_API_KEY set as Supabase secret.
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
    landing-pages/page.tsx — Landing page builder (7-step pipeline, design engine powered)
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
    stitch.ts              — Landing page integration: template slot definitions, serialization, copy mapping
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
    build-landing-page/    — Workflow 7: Assemble master prompt + call Stitch API → get designed HTML
    iterate-landing-page/  — Workflow 7b: Append change request to original prompt → Stitch redesign
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

The Landing Pages page implements a 7-step pipeline. The design engine is Google Stitch API (`@google/stitch-sdk`). **Never mention "Stitch" in user-facing UI.**

### The 3-Step Process (How It Actually Works)
1. **Gather copy + business info** — Frontend collects avatar, offer, template, copy slots, business assets
2. **Send to Stitch API** — Edge function assembles the master prompt (6 parts) and sends it to Stitch with the client's website URL. Stitch visits the URL, extracts the brand, and returns designed HTML.
3. **Convert to React** — Take the Stitch HTML output, convert it to a React site, save it in a client directory, provide a preview link. User can then edit locally with Claude Code.

### Master Prompt Assembly (build-landing-page edge function)
The edge function assembles a 6-part prompt before sending to Stitch:
1. **Part 1: Brand Extraction** — Tells Stitch to visit `clients.website` and extract colors, fonts, spacing, button styles. The client's website IS the brand kit.
2. **Part 2: Global Design Rules** — Static rules: soft gradients, design accents, mobile-first responsive (320/768/1024), image/video placeholders, hard rules (no nav links, no generic fonts, etc.)
3. **Part 3: Page Purpose** — Client name, avatar name+description, offer name+description, primary CTA, conversion type
4. **Part 4: Template Layout Spec** — One of 8 template-specific section-by-section specs with `{{slot_id}}` placeholders
5. **Part 5: Copy** — All copy slots serialized as `slot_id: value` lines using `serializeCopySlots()`
6. **Part 6: Final Instructions** — "Build this page now" with output format rules

### Iteration Prompt Pattern
Change requests append to the ORIGINAL full prompt (not just the HTML):
```
[original 6-part prompt] + "---" + [iteration instruction with change request]
```
This preserves brand context, copy, and template spec for every iteration.

### Copy Slot Sources
Each slot has a `source` field:
- `'copy'` — AI-generatable. Auto-filled from `copy_components` via `mapComponentsToSlots()`.
- `'business'` — Business assets (testimonials, ratings, badges, disclaimers). Manual entry only. AI cannot generate these.
- `'media'` — Video URLs, images. User provides manually.

### AI Hero Image Generation
Step 3 includes a hero image generator powered by Google Gemini 3.1 Flash:
- **4 styles**: Hero Shot (waist-up portrait), Family/Group (lifestyle), Trust Portrait (headshot), Lifestyle (editorial)
- **Avatar-aware prompts** — person appearance derived from avatar description (gig worker → casual clothes, nurse → scrubs, executive → suit, etc.). Clothing, posture, and vibe must match the actual avatar.
- **Offer-aware icons** — optional floating icons are gated to avatar+offer context (e.g. car/phone for rideshare driver, receipt/calculator for tax offer). "If in doubt, use NO icons."
- **Transparent background** — all styles enforce blank/transparent background, person isolated, no environment/room/scenery
- Optional custom prompt override for full control
- Image uploaded to Supabase Storage (`client-assets/{client_id}/hero-*.png`)
- Image URL auto-inserted into `hero_image` copy slot → included in Stitch prompt
- `generate-hero-image` edge function: calls Gemini 3.1 Flash via `generateContent` with `responseModalities: ["IMAGE"]` → uploads to storage → saves to `client_assets` table → returns public URL
- **Auth**: `GOOGLE_AI_API_KEY` (Google AI Studio key, free tier)
- **Model**: `gemini-3.1-flash-image-preview` — standard Gemini models (gemini-2.0-flash etc) do NOT support image output. Imagen models require paid plans.
- **Never mention "Gemini", "AI-generated", or model names in user-facing UI** — just "Hero Image"
- **Upload**: Drag-and-drop or file picker to upload your own hero image (stored in Supabase Storage)

### Client Assets (Persistent Image Storage)
- All generated and uploaded images are saved to the `client_assets` table for reuse
- **Business Overview** page shows an Image Assets grid with thumbnails, type badges, dates
- **Landing Page Builder** Step 3 shows saved image galleries at the top of both Hero Image and Parallax sections
- Click any saved thumbnail to select it for the current landing page
- Asset types: `hero_image`, `parallax`, `logo`, `photo`, `other`
- Table: `client_assets` (migration 014) with anon RLS policies (migration 015)

### Parallax Background Image
- Upload a full-width background image for a parallax scrolling section
- Placed between social proof and final CTA in all templates
- Uses `background-attachment: fixed` with iOS Safari fallback
- Dark overlay + centered stat/headline text
- If no image provided, a dark gradient placeholder section is still included (parallax-ready)
- Upload via drag-and-drop on Step 3, stored in Supabase Storage as `parallax_image` slot

### Frontend Pipeline (7 UI Steps)
1. **Select Avatar + Offer** — Two dropdowns, approved only, avatars sorted by priority
2. **Select Template** — 8 template cards with name and "Best for" description
3. **Review Copy Slots** — Auto-fills copy slots from approved components; business/media slots shown separately for manual entry; optional slots (quiz questions) don't block build; **AI Hero Image** generator panel with style picker and preview; **Saved images gallery** at top of hero/parallax sections for reuse; **Parallax background** upload
4. **Build Page** — Shows readiness checklist (avatar, offer, template, slots, optional images) with clear ✓/✗ status. Assembles master prompt (including hero image URL if generated), sends to Stitch API, receives designed HTML. Build errors displayed inline with full error details.
5. **Preview + Iterate** — Interactive preview in iframe, change request panel, version history
6. **Approve** — Approve the design for React conversion
7. **Deploy** — Convert to React, save to client directory, provide preview link

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

### Key Files
- **`supabase/functions/build-landing-page/index.ts`** — Master prompt assembly + Stitch API call. Contains all 6 global rules, all 8 template specs with `{{slot_id}}` placeholders, `serializeCopySlots()`, `assembleStitchPrompt()`.
- **`supabase/functions/iterate-landing-page/index.ts`** — Appends change request to original prompt, calls Stitch for redesign.
- **`supabase/functions/_shared/stitch-client.ts`** — Stitch SDK wrapper (`generateWithStitch()`).
- **`src/lib/stitch.ts`** — Frontend: `TEMPLATE_SLOTS` (slot definitions per template with `source` field), `mapComponentsToSlots()`, `serializeCopySlots()`.
- **`src/lib/api.ts`** — `buildLandingPage()`, `iterateLandingPage()`, `approveLandingPage()`, `deployLandingPage()`, `generateMissingCopySlots()`.

### Variable Names: Edge Function vs Database
The edge function receives `copy_slots` from the request body (snake_case) but the `assembleStitchPrompt()` function parameter is `copySlots` (camelCase). Always pass as `copySlots: copy_slots`.

### Deploy Status Flow
`draft` → `pending_approval` → `approved` → `converting` → `deployed` (or `failed`)

### A/B Testing
Create two `landing_page` records with same `funnel_instance_id` but different `template_id`. Both deployed to separate URLs.

### Remaining TODO
- `approve-landing-page` edge function — Convert Stitch HTML to React component, save to client directory
- `deploy-landing-page` edge function — Deploy to live URL
- `generate-missing-copy` edge function — AI fills gaps in template slots
- React conversion pipeline: Stitch HTML → React component in `/clients/{client-slug}/` directory
- Preview link served via dev server or static hosting

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
- `STITCH_API_KEY` — Google Stitch API key for landing page design (from stitch.withgoogle.com → Settings)
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
| landing_page | Landing Page | Built via design engine pipeline |
| wireframe_template | Template | 1 of 8 structural layouts |
| master_prompt | (internal) | 6-part assembled prompt sent to Stitch API |
| stitch | (internal only) | Google Stitch API — NEVER mention in user-facing UI |
