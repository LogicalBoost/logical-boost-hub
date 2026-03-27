# Landing Page System — Complete Operational Workflow

**Date:** March 27, 2026
**Purpose:** Step-by-step workflow for how landing pages get created, from client onboarding to live URL. Clarifies what's already built (don't touch), what changes, and what's new.

---

## ARCHITECTURE DECISION: ONE PROJECT, MANY PAGES

All landing pages for all clients live in **one Next.js project** deployed to **one Vercel instance**.

- One GitHub repo: `LogicalBoost/landing-pages` (separate from the Hub app repo)
- One Vercel deployment
- One build
- Dynamic route: `/[slug]` — each landing page is a database-driven route, not a separate file
- Adding a new landing page = inserting a row in `published_pages`, not creating a new directory or repo

**When someone visits `page.summitroofing.com/inspect-7x3k`:**
1. Vercel receives the request on the custom domain
2. The catch-all `[slug].jsx` route runs
3. It queries Supabase: "give me the published_page where slug = 'inspect-7x3k' and custom_domain = 'page.summitroofing.com'"
4. It gets back: template_id, sections JSON, brand_kit, media_mapping
5. It renders the correct template with all the data
6. User sees a fully branded, unique landing page

**No static files per client. No separate builds. No directory duplication.** Every page is rendered from data.

### Why a separate repo from the Hub?

The Hub (`logical-boost-hub`) is your internal platform — auth, dashboard, funnel page, all the management UI. It runs at `hub.logicalboost.com`.

The landing pages project (`landing-pages`) is a public-facing, lightweight Next.js app that does ONE thing: serve landing pages fast. No auth, no sidebar, no dashboard. Just pages. It runs at whatever custom domains clients connect.

Keeping them separate means:
- Landing pages stay fast (tiny bundle, no Hub code)
- Hub deploys don't break live landing pages
- Different scaling needs (landing pages get ad traffic spikes)
- Claude Code can work on landing page refinements without touching the Hub

### But what about Claude Code refinement?

Here's the thing — since pages are data-driven (not static files), most refinement happens by editing the template components themselves, not individual pages. If you want to tweak how the hero section looks across ALL pages using that template, you edit the template component. If you want to override something for ONE specific page, you add a `custom_overrides` JSON field to that published_page record.

For truly custom one-off changes that go beyond what the template system supports, you CAN add a static page override — a real `.jsx` file in the repo for that specific slug. The catch-all route checks for a static override first, then falls back to database-driven rendering. This is the escape hatch for Claude Code refinement:

```
/[slug].jsx route logic:
1. Check: does /pages/overrides/[slug].jsx exist? → Render that (static override)
2. If not: query published_pages table → Render via TemplateRenderer (data-driven)
```

This gives you both: 99% of pages are data-driven and instant. The few that need hand-tuning get exported to a static file and refined via Claude Code.

---

## WHAT STAYS THE SAME (DO NOT TOUCH)

Everything up to the point of "building the actual page" is unchanged:

- **Workflow 1: Analyze Business** — still generates business_summary, avatars, offers ✓
- **Workflow 2: Generate Intake** — still creates intake questions ✓
- **Workflow 3: Refine System** — still updates avatars/offers from intake answers ✓
- **Workflow 4: Generate Funnel Instance** — still generates all copy_components, creatives, AND the `landing_page` record with sections JSON ✓
- **Workflow 5: Generate More** — still adds copy per section ✓
- **Workflow 6: Generate Creatives** — still generates ad concepts ✓
- **Workflow 7: Generate Landing Page** — **still generates the sections JSON** (headline, problem, solution, benefits, proof, faq, final_cta). This is the COPY generation. It still happens. ✓
- **Workflow 8: Suggest Offers** — still works ✓
- **All Funnel page features** — selectors, section cards, deny/edit/generate more, click-to-copy ✓
- **All role-based permissions** — admin, editor, viewer, client ✓
- **All existing database tables** — unchanged ✓
- **Business Overview, Avatars, Offers, Intake, Competitor Ads pages** — all unchanged ✓

**What's removed:** Only the part where the sections JSON was sent to Stitch (or any external service) to become a rendered page. That pipeline is replaced by the template system below.

---

## WHAT'S NEW

### New database tables:
- `brand_kits` — per-client colors, fonts, logo, button styles
- `media_assets` — uploaded images/videos tagged with role + avatar
- `page_templates` — the 4+ template definitions with slot schemas
- `published_pages` — tracks every live landing page (slug, domain, status)

### New columns on existing `landing_pages` table:
- `template_id` — which template to use
- `brand_kit_id` — which brand kit to apply (FK to brand_kits, though usually just the client's one kit)
- `media_mapping` — JSON mapping template slots to media_asset IDs

### New Hub UI pages/sections:
- Brand Kit editor (on Business Overview page or its own page)
- Media Assets manager (upload, tag, browse by avatar)
- Template picker + media slot mapper (on Funnel page, Landing Page section)
- Published Pages manager (URLs, domains, status)

### New separate repo:
- `LogicalBoost/landing-pages` — the public-facing Next.js app that serves landing pages

---

## COMPLETE STEP-BY-STEP WORKFLOW

### Step 1: Client Onboarding (EXISTING — no changes)

Agency team provides website, call notes, materials.

→ **Workflow 1 (Analyze Business)** runs
→ Populates: business_summary, services, differentiators, trust_signals, tone
→ Generates: initial avatars (approved), initial offers (approved)

### Step 2: Brand Kit Setup (NEW)

Agency team goes to **Business Overview** page (or a new Brand Kit section).

They enter:
- Primary color, secondary color, accent color (hex pickers)
- Background color, text color
- Heading font, body font (dropdown of Google Fonts)
- Upload client logo (regular + dark variant)
- Button style preferences (border radius, text transform)

→ Creates one `brand_kits` record for this client
→ This is done ONCE per client, reused for all their landing pages

### Step 3: Upload Media Assets (NEW)

Agency team goes to a **Media Assets** section (could be on Business Overview or its own page).

They upload images and videos and tag each with:
- **Role** — hero_image, testimonial_photo, certification_badge, team_photo, background_texture, process_step, before_after, gallery, etc.
- **Avatar** — which avatar this asset is for (or "universal" for all avatars)
- **Display name** — for easy identification

Some assets are universal (logo, certification badges, trust badges). Some are avatar-specific (different hero images for "Storm Damage Homeowner" vs "Property Manager").

→ Creates `media_assets` records
→ These are a library that gets reused across multiple landing pages

### Step 4: Generate Copy (EXISTING — no changes)

On the **Funnel page**, agency team selects Avatar + Offer + Angle.

→ **Workflow 4 (Generate Funnel Instance)** runs if this combo is new
→ Generates all copy_components (headlines, benefits, proof, etc.)
→ Generates `landing_page` record with sections JSON (hero, problem, solution, benefits, proof, faq, final_cta)
→ Generates creative concepts

All of this is exactly as it works today. The sections JSON is now the **copy payload** that feeds into the template system.

### Step 5: Build the Landing Page (NEW — replaces Stitch)

Still on the **Funnel page**, in the **Landing Page section** (section 7 in the spec), instead of "sending to Stitch," the agency team now sees:

**5a. Choose Template**
- Template gallery showing previews of available templates (Lead Capture Classic, Bold Split, Social Proof Heavy, Minimal Direct)
- Each preview shows a thumbnail with the template's layout described
- Team clicks to select one

**5b. Map Media to Slots**
- Based on the chosen template's slot_schema, the UI shows which media slots need filling
- Example for "Lead Capture Classic":
  - Hero Image (required) → dropdown/browser filtered to media_assets with role=hero_image AND (avatar_id matches OR universal)
  - Testimonial Photos (optional, max 3) → filtered to role=testimonial_photo
  - Certification Badges (optional, max 6) → filtered to role=certification_badge
  - Process Image (optional) → filtered to role=process_step
- Team picks assets for each slot
- If an asset doesn't exist yet, there's a quick-upload option right here

**5c. Preview**
- "Preview Landing Page" button renders the page in a modal or new tab
- Uses: selected template + sections JSON (copy) + brand_kit + mapped media
- Team can see exactly what the page looks like before publishing

**5d. Generate / Upload Hero Images (NEW — optional AI assist)**
- For hero_image and other visual slots, team can either:
  - Upload their own images (photographer shots, stock photos)
  - Use DALL-E API to generate concept images from the creative's visual_prompt
  - Browse existing media_assets
- Generated images get saved to media_assets for reuse

**5e. Publish**
- Team clicks "Publish Landing Page"
- System generates a short slug: `[offer-keyword]-[4char-random]` e.g. `inspect-7x3k`
- Creates a `published_pages` record with: slug, template_id, client_id, avatar_id, offer_id, media_mapping, status='published'
- Page is immediately live at `hub.logicalboost.com/lp/[slug]` (or custom domain if configured)

### Step 6: Custom Domain (NEW — optional)

If the client wants their landing pages on their own domain:

1. Admin tells client: "Add a CNAME record: `page.yourdomain.com` pointing to `cname.vercel-dns.com`"
2. Admin adds `page.yourdomain.com` in Vercel project settings (Vercel handles SSL)
3. Admin updates the `published_pages` record: `custom_domain = 'page.summitroofing.com'`
4. Page is now live at `page.summitroofing.com/inspect-7x3k`

### Step 7: Refinement via Claude Code (NEW — optional)

If a page needs tweaks beyond what the template + data can handle:

1. Team member runs an "Export for Editing" action on the published page
2. System writes a static `.jsx` file to the landing-pages repo at `/pages/overrides/[slug].jsx` — a snapshot of the rendered page as editable code
3. Team member opens Claude Code, navigates to that file
4. They describe changes: "move testimonials above benefits," "make the hero full-bleed," "add a video embed in the solution section"
5. Claude Code edits the file
6. They preview locally: `npm run dev` → `localhost:3000/[slug]`
7. Push to GitHub → Vercel auto-deploys → live

The override file takes priority over the database-driven version. If they later want to go back to data-driven, they delete the override file.

### Step 8: Create More Landing Pages for Same Client

When the team goes to build another landing page (different avatar, different offer, or just a different template for A/B testing):

- They go back to the Funnel page
- Select the Avatar + Offer + Angle combo
- The copy (sections JSON) already exists from Step 4
- They repeat Step 5: pick a DIFFERENT template, map media (which may already be uploaded), preview, publish
- New `published_pages` row, new slug, same one-build deployment
- No new repo, no new directory, no new build — just another route in the same project

**Multiple templates for the same Avatar + Offer = built-in A/B testing.** Same copy, different layouts, different URLs, measure which converts better.

---

## WHAT THE CLIENT SEES (UNCHANGED)

The client experience doesn't change at all:

- They log into their Hub dashboard
- They see the Funnel page with all their copy, creatives, etc.
- In the Landing Page section, they see a preview card with "View Full Page" that opens the live URL
- They can deny landing pages (with confirmation) just like any other item
- They never see the template picker, media mapper, brand kit editor, or any build UI
- Their landing page lives at their own custom domain — looks 100% like their brand

---

## SUMMARY: WHAT CHANGED vs WHAT DIDN'T

| Area | Status |
|------|--------|
| Business analysis (Workflow 1) | UNCHANGED |
| Intake generation (Workflow 2) | UNCHANGED |
| System refinement (Workflow 3) | UNCHANGED |
| Funnel instance + copy generation (Workflow 4) | UNCHANGED |
| Generate More per section (Workflow 5) | UNCHANGED |
| Creative concepts (Workflow 6) | UNCHANGED |
| Landing page COPY generation (Workflow 7) | UNCHANGED — still produces sections JSON |
| Suggest Offers (Workflow 8) | UNCHANGED |
| Funnel page UI (sections 1-6) | UNCHANGED |
| Funnel page UI (section 7 — Landing Page) | UPDATED — template picker + media mapper replaces Stitch |
| All other Hub pages | UNCHANGED |
| Role permissions | UNCHANGED |
| Stitch / external rendering pipeline | REMOVED |
| Brand Kit management | NEW |
| Media Asset management | NEW |
| Template system | NEW |
| Published Pages + custom domains | NEW |
| Landing pages Next.js project | NEW (separate repo) |
| Claude Code refinement workflow | NEW (optional) |
