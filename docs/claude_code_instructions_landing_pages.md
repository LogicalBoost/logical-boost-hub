# Claude Code Instructions: Landing Page System Overhaul

**Date:** March 27, 2026
**Priority:** HIGH — This replaces the entire previous landing page generation approach

---

## PHASE 1: KILL THE STITCH WORKFLOW

Remove all code, references, and integrations related to sending landing page data to Stitch (or any external design tool) for page generation. This includes:

- Any API calls or webhooks that send landing page data to an external service for rendering
- Any code that waits for or receives rendered pages back from an external service
- Any UI that references "sending to design" or "generating page" via an external tool
- Any queue, job, or background process related to external page rendering

**Do NOT remove:**
- The `landing_pages` table or its data
- The `sections` JSON structure (hero, problem, solution, benefits, proof, faq, final_cta) — we are keeping this
- The AI prompts that generate landing page copy/sections content (Prompt 7 in the AI prompts file) — we are keeping this
- Any copy_component data tagged with `platform: "landing_page"`

The sections JSON and AI-generated copy are still the content source. What's changing is HOW that content becomes a real page.

---

## PHASE 2: NEW DATA MODEL ADDITIONS

Add the following tables to Supabase. All tables need RLS policies following the existing multi-tenant pattern.

### Table: `brand_kits`

```sql
CREATE TABLE brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  primary_color VARCHAR(7) NOT NULL,        -- hex e.g. "#2E86AB"
  secondary_color VARCHAR(7) NOT NULL,
  accent_color VARCHAR(7),
  background_color VARCHAR(7) DEFAULT '#FFFFFF',
  text_color VARCHAR(7) DEFAULT '#1A1A1A',
  heading_font VARCHAR(100) NOT NULL,       -- Google Font name e.g. "Barlow Condensed"
  body_font VARCHAR(100) NOT NULL,          -- e.g. "Inter"
  logo_url TEXT,
  logo_dark_url TEXT,                       -- logo variant for dark backgrounds
  button_style JSONB DEFAULT '{"borderRadius": "8px", "textTransform": "uppercase"}',
  custom_css TEXT,                          -- optional override CSS
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)                         -- one brand kit per client
);
```

### Table: `media_assets`

```sql
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  avatar_id UUID REFERENCES avatars(id) ON DELETE SET NULL,  -- nullable = universal asset
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL,           -- "image", "video"
  role VARCHAR(50) NOT NULL,                -- see role list below
  alt_text TEXT,
  display_name VARCHAR(200),
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Media asset roles (controlled values for the `role` field):**
- `hero_image` — Main hero/banner image
- `hero_video` — Hero section background or inline video
- `testimonial_photo` — Customer/client photo for testimonials
- `team_photo` — Company team or owner photo
- `background_texture` — Parallax or section background
- `before_after` — Before/after comparison images
- `process_step` — Images showing how the service works
- `certification_badge` — Trust badges, certifications, awards
- `company_logo` — Client's own logo (also in brand_kit, but specific variants here)
- `gallery` — General portfolio/work gallery images
- `icon_custom` — Custom icons if needed beyond the icon library

### Table: `page_templates`

```sql
CREATE TABLE page_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,               -- e.g. "Lead Capture Classic"
  slug VARCHAR(50) NOT NULL UNIQUE,         -- e.g. "lead-capture-classic"
  description TEXT,
  template_type VARCHAR(50) NOT NULL,       -- "lead_capture", "call_only", "booking", "product_page"
  section_schema JSONB NOT NULL,            -- defines what sections exist and their order
  slot_schema JSONB NOT NULL,              -- defines media slots per section (see below)
  preview_image_url TEXT,                   -- screenshot of the template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**slot_schema example:**
```json
{
  "hero": {
    "slots": [
      {"name": "hero_image", "role": "hero_image", "required": true},
      {"name": "hero_video", "role": "hero_video", "required": false}
    ]
  },
  "proof": {
    "slots": [
      {"name": "testimonial_photos", "role": "testimonial_photo", "required": false, "max": 4},
      {"name": "certification_badges", "role": "certification_badge", "required": false, "max": 6}
    ]
  },
  "solution": {
    "slots": [
      {"name": "process_image", "role": "process_step", "required": false}
    ]
  },
  "background": {
    "slots": [
      {"name": "parallax_image", "role": "background_texture", "required": false}
    ]
  }
}
```

### Table: `published_pages`

```sql
CREATE TABLE published_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  landing_page_id UUID NOT NULL REFERENCES landing_pages(id),
  template_id UUID NOT NULL REFERENCES page_templates(id),
  avatar_id UUID NOT NULL REFERENCES avatars(id),
  offer_id UUID NOT NULL REFERENCES offers(id),
  slug VARCHAR(30) NOT NULL,                -- short URL slug e.g. "inspect-7x3k"
  custom_domain VARCHAR(255),               -- e.g. "page.summitroofing.com"
  media_mapping JSONB,                      -- maps template slots to media_asset IDs
  page_file_path TEXT,                      -- path in repo e.g. "/pages/inspect-7x3k"
  status VARCHAR(20) DEFAULT 'draft',       -- "draft", "published", "archived"
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slug, custom_domain)
);
```

### Modify existing `landing_pages` table — add columns:

```sql
ALTER TABLE landing_pages ADD COLUMN template_id UUID REFERENCES page_templates(id);
ALTER TABLE landing_pages ADD COLUMN brand_kit_id UUID REFERENCES brand_kits(id);
ALTER TABLE landing_pages ADD COLUMN media_mapping JSONB;
```

---

## PHASE 3: UPDATE THE SECTIONS JSON SCHEMA

The existing sections JSON structure stays, but each section now also accepts media slot references. Update the landing page section structure to:

```json
{
  "sections": [
    {
      "type": "hero",
      "headline": "Don't Let Storm Damage Cost You $15,000",
      "subheadline": "Free professional roof inspection...",
      "cta": "Schedule Your Free Inspection",
      "media": {
        "hero_image": "{{media_asset_id}}",
        "hero_video": null
      }
    },
    {
      "type": "problem",
      "content": "After a major storm...",
      "media": {}
    },
    {
      "type": "solution",
      "content": "We come to your home...",
      "media": {
        "process_image": "{{media_asset_id}}"
      }
    },
    {
      "type": "benefits",
      "items": ["..."],
      "media": {}
    },
    {
      "type": "proof",
      "items": ["..."],
      "media": {
        "testimonial_photos": ["{{media_asset_id}}", "{{media_asset_id}}"],
        "certification_badges": ["{{media_asset_id}}"]
      }
    },
    {
      "type": "faq",
      "items": [{"question": "...", "answer": "..."}],
      "media": {}
    },
    {
      "type": "final_cta",
      "headline": "Don't Wait...",
      "cta": "Schedule Now",
      "media": {}
    }
  ]
}
```

---

## PHASE 4: PAGE ASSEMBLY PIPELINE

The Page Builder is a **deterministic code generator**, not AI. Here is the assembly logic:

```
INPUT:
  - template_id → loads React template component
  - landing_page.sections → copy content
  - brand_kit → colors, fonts, logo, button styles
  - media_mapping → which media_assets fill which template slots
  - client custom_domain + generated slug

OUTPUT:
  - A complete, self-contained React page component
  - Committed to the landing-pages GitHub repo
  - Auto-deployed via Vercel

ASSEMBLY STEPS:
  1. Load the template component by template_id
  2. Inject sections JSON as props (copy content)
  3. Apply brand_kit as CSS custom properties / theme
  4. Resolve media_mapping → replace asset IDs with actual URLs
  5. Output the assembled page to the repo
  6. Vercel auto-deploys on push
```

**No AI is involved in page assembly.** AI generates the copy (sections JSON). Humans choose the template, upload media, and configure the brand kit. The builder merges them deterministically.

---

## PHASE 5: URL & DOMAIN ROUTING

### Slug Generation
- Format: `[short-offer-keyword]-[4char-random]` e.g. `inspect-7x3k`, `quote-m2pf`, `roof-9dw2`
- Max 30 characters
- Lowercase, alphanumeric + hyphens only
- Must be unique per custom_domain

### Custom Domain Setup
- Client adds CNAME: `page.theirdomain.com` → `cname.vercel-dns.com`
- Admin adds the domain in Vercel project settings
- Admin records the custom_domain in the `published_pages` row
- Vercel handles SSL automatically

### Routing
- Catch-all route: `/[slug]` looks up the slug in `published_pages`
- If found and status = "published" → render that page
- If not found → 404
- No client name, avatar, or angle in the URL ever

---

## PHASE 6: CLAUDE CODE REFINEMENT WORKFLOW

After the automated build produces a page, team members can refine it using Claude Code:

1. **Navigate to the page in the repo** — each published page has a known file path
2. **Make changes** — drop in screenshots, describe changes in natural language
3. **Preview locally** — `npm run dev` then visit `localhost:3000/[slug]`
4. **Push to deploy** — `git push` triggers Vercel auto-deploy

The key requirement: **the automated build must output clean, readable, editable React code** — not minified or abstracted beyond recognition. Claude Code needs to be able to read the JSX and make targeted edits.

---

## IMPLEMENTATION ORDER

1. Kill Stitch workflow code
2. Create new database tables (brand_kits, media_assets, page_templates, published_pages)
3. Add columns to landing_pages table
4. Update sections JSON schema to include media slots
5. Build the Media Assets management UI (upload, tag with role + avatar, browse)
6. Build the Brand Kit management UI (color pickers, font selectors, logo upload)
7. Build the Template Selection UI (choose template, preview, assign media to slots)
8. Build the Page Assembly pipeline (deterministic builder)
9. Set up the landing-pages GitHub repo structure
10. Configure Vercel project with custom domain support
11. Build the Published Pages management UI (status, URLs, domain config)

Templates themselves (the actual React components) are built separately — see the companion document.
