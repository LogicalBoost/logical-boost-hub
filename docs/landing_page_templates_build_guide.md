# Landing Page Templates — Build Guide

**Date:** March 27, 2026
**Purpose:** How to build, structure, and store the landing page templates for the Logical Boost Hub

---

## WHERE TEMPLATES SHOULD LIVE

Templates live in a **separate repo** from the Hub: `LogicalBoost/landing-pages`. This is a lightweight, public-facing Next.js app that does ONE thing — serve landing pages fast.

```
landing-pages/                        ← NEW REPO: LogicalBoost/landing-pages
  src/
    components/
      shared/                         ← Shared section components used across templates
        HeroSection.jsx
        ProblemSection.jsx
        SolutionSection.jsx
        BenefitsSection.jsx
        ProofSection.jsx
        FaqSection.jsx
        FinalCtaSection.jsx
        LeadForm.jsx
        TestimonialCard.jsx
        TrustBadgeRow.jsx
      templates/                      ← Full page templates that compose shared sections
        LeadCaptureClassic.jsx
        BoldSplit.jsx
        SocialProofHeavy.jsx
        MinimalDirect.jsx
      ThemeProvider.jsx               ← Applies brand_kit as CSS custom properties
      TemplateRenderer.jsx            ← Master component: template_id + sections + brand_kit + media → renders
    pages/
      [slug].jsx                      ← Catch-all route — queries Supabase, renders the right page
      overrides/                      ← Optional static overrides for Claude Code refined pages
        [slug].jsx                    ← Hand-edited pages that bypass data-driven rendering
```

### Why a separate repo from the Hub?
- Landing pages stay fast (tiny bundle, no Hub UI code, no auth overhead)
- Hub deploys don't break live landing pages
- Different scaling needs (landing pages get ad traffic spikes from paid campaigns)
- Claude Code can refine landing pages without touching the Hub codebase
- Clean separation: Hub = internal tool, landing-pages = public-facing

### How it's deployed
- One Vercel project connected to `LogicalBoost/landing-pages`
- One build serves ALL clients' landing pages (data-driven, not static files)
- Custom domains added per-client in Vercel settings
- Default URL: `yourdomain.vercel.app/[slug]` until client connects their domain
- Client domain URL: `page.clientdomain.com/[slug]`

### The catch-all route logic
```
/[slug].jsx:
1. Check: does /pages/overrides/[slug].jsx exist? → Render that (Claude Code refined)
2. If not: query published_pages by slug + domain → Get template_id, sections, brand_kit, media
3. Render via TemplateRenderer (data-driven)
4. If no match: 404
```

---

## HOW TEMPLATES WORK

Every template is a React component that accepts the same props interface:

```jsx
// TemplateRenderer.jsx — the master renderer
export default function TemplateRenderer({ template, sections, brandKit, mediaAssets }) {
  // template = which layout to use (e.g. "lead-capture-classic")
  // sections = the sections JSON from landing_pages table
  // brandKit = colors, fonts, logo, button styles from brand_kits table
  // mediaAssets = resolved media URLs mapped to template slots

  const TemplateComponent = TEMPLATE_MAP[template.slug];

  return (
    <ThemeProvider brandKit={brandKit}>
      <TemplateComponent sections={sections} media={mediaAssets} />
    </ThemeProvider>
  );
}
```

```jsx
// ThemeProvider.jsx — injects brand as CSS custom properties
export function ThemeProvider({ brandKit, children }) {
  const style = {
    '--color-primary': brandKit.primary_color,
    '--color-secondary': brandKit.secondary_color,
    '--color-accent': brandKit.accent_color,
    '--color-bg': brandKit.background_color,
    '--color-text': brandKit.text_color,
    '--font-heading': brandKit.heading_font,
    '--font-body': brandKit.body_font,
    '--button-radius': brandKit.button_style?.borderRadius || '8px',
  };

  return <div style={style}>{children}</div>;
}
```

Each template uses CSS custom properties (not hardcoded colors) so the brand kit skins it automatically. Tailwind classes reference these vars.

---

## THE 4 STARTER TEMPLATES

Build these first. They cover the most common lead gen scenarios.

### Template 1: "Lead Capture Classic" (`lead-capture-classic`)

**Best for:** Standard lead gen — free inspections, free quotes, consultations

**Layout:**
- Hero: Full-width background image, headline + subheadline overlaid, lead form right-aligned
- Problem: Two-column — icon/image left, pain point text right
- Solution: Text block explaining the mechanism, optional process image
- Benefits: Icon grid (3 columns, 2 rows)
- Proof: Trust badges row + testimonial cards (2-3)
- FAQ: Accordion style
- Final CTA: Colored background section, headline + CTA button + lead form repeat

**Key media slots:** hero_image, testimonial_photos (3), certification_badges (up to 6), process_image

---

### Template 2: "Bold Split" (`bold-split`)

**Best for:** High-urgency offers, fear/risk angles, storm damage, emergency services

**Layout:**
- Hero: Split 50/50 — left side dark with headline + CTA, right side full hero image
- Problem: Bold stat or number callout, then paragraph
- Solution: Step-by-step process (numbered, 3-4 steps with icons)
- Benefits: Alternating left/right sections (image + text, text + image)
- Proof: Full-width testimonial banner with large quote, customer photo, trust badges below
- FAQ: Two-column grid
- Final CTA: Full-width dark section, urgency headline, large CTA button

**Key media slots:** hero_image, testimonial_photos (1 featured), certification_badges, process_step images (3-4), background_texture

---

### Template 3: "Social Proof Heavy" (`social-proof-heavy`)

**Best for:** Trust-first industries, markets where credibility is the main barrier

**Layout:**
- Hero: Headline + subheadline centered, trust badges immediately below, CTA button
- Proof (early): Testimonial carousel right under hero (breaks convention — proof before problem)
- Problem: Short, punchy problem statement
- Solution: "Here's how we solve it" with team photo
- Benefits: Checkmark list style, compact
- More Proof: Case study card or before/after section
- FAQ: Accordion
- Final CTA: Testimonial quote + CTA button together

**Key media slots:** hero_image (optional), testimonial_photos (4-6), certification_badges, team_photo, before_after images

---

### Template 4: "Minimal Direct" (`minimal-direct`)

**Best for:** Simple offers, call-only pages, businesses that want clean/professional look

**Layout:**
- Hero: Clean white/light background, centered headline, subheadline, single CTA button (no form in hero)
- Solution: Brief explanation, one paragraph
- Benefits: Simple bulleted list with subtle icons
- Proof: One row of trust badges + star rating
- Final CTA: Lead form standalone section OR large phone number CTA

**Key media slots:** certification_badges, company_logo (minimal imagery by design)

---

## BUILDING INSTRUCTIONS FOR CLAUDE CODE

Open Claude Code and create a new repo `LogicalBoost/landing-pages`. Initialize it as a Next.js project with Tailwind CSS. Then give it this prompt:

---

**Prompt for Claude Code:**

```
I need to build a landing page template system in this new Next.js project. This is a separate repo from our main Hub — it ONLY serves public-facing landing pages.

0. Set up Supabase client connection (we'll need to query published_pages, brand_kits, media_assets tables). Install @supabase/supabase-js. Create a lib/supabase.js with anon key config (we'll add the real keys to .env.local).

1. Create the directory structure:
   src/components/shared/
   src/components/templates/
   src/components/ThemeProvider.jsx
   src/components/TemplateRenderer.jsx

2. Build ThemeProvider.jsx that takes a brandKit prop and sets CSS custom properties:
   --color-primary, --color-secondary, --color-accent, --color-bg, --color-text,
   --font-heading, --font-body, --button-radius

3. Build shared section components. Every section component takes:
   - section: the section data from sections JSON (headline, content, items, etc.)
   - media: resolved media URLs for that section's slots
   
   Shared sections to build:
   - HeroSection (headline, subheadline, cta, optional lead form, hero_image slot)
   - ProblemSection (content text, optional image)
   - SolutionSection (content text, optional process_image)
   - BenefitsSection (items array, icon grid or list layout)
   - ProofSection (items array, testimonial_photos slots, certification_badges slots)
   - FaqSection (items array of {question, answer}, accordion style)
   - FinalCtaSection (headline, cta, optional lead form repeat)
   - LeadForm (standalone form component — name, email, phone, submit button)

4. Build the first template: LeadCaptureClassic.jsx
   - Uses all shared sections in order: Hero → Problem → Solution → Benefits → Proof → FAQ → Final CTA
   - Hero has lead form right-aligned over hero_image background
   - Benefits in 3-column icon grid
   - Proof has trust badges row + testimonial cards
   - FAQ is accordion
   - Final CTA repeats the lead form

5. All styling uses Tailwind classes referencing CSS custom properties.
   For example: text-[var(--color-primary)], bg-[var(--color-bg)], font-[var(--font-heading)]
   
6. Every component must be responsive (mobile-first).

7. Use Lucide React for icons.

8. Build TemplateRenderer.jsx that:
   - Takes props: template (object with slug), sections (JSON), brandKit (object), mediaAssets (object)
   - Maps template.slug to the correct template component
   - Wraps in ThemeProvider
   - Renders the template with sections and media

9. Build the catch-all route at pages/[slug].jsx:
   - For now, hardcode sample data so we can preview
   - Later we'll wire it to Supabase
   - Check if pages/overrides/[slug].jsx exists first (static override), fall back to TemplateRenderer

Here's sample data to use for development/preview:

Brand Kit:
{
  "primary_color": "#2E86AB",
  "secondary_color": "#1B4965",
  "accent_color": "#F4A261",
  "background_color": "#FFFFFF",
  "text_color": "#1A1A1A",
  "heading_font": "Barlow Condensed",
  "body_font": "Inter",
  "button_style": {"borderRadius": "8px", "textTransform": "uppercase"}
}

Sections JSON: (use the Summit Roofing example from the AI prompts doc — hero, problem, solution, benefits, proof, faq, final_cta)

Make sure I can preview this at localhost:3000/test-page with hardcoded sample data first, then we'll wire it to Supabase.
```

---

## AFTER TEMPLATE 1 IS WORKING

Once LeadCaptureClassic renders correctly with sample data:

1. **Build the remaining 3 templates** — BoldSplit, SocialProofHeavy, MinimalDirect — reusing the shared section components but with different layouts and compositions
2. **Wire the `[slug].jsx` catch-all route** — query Supabase for the slug, pull sections + brand_kit + media, render via TemplateRenderer
3. **Build the Hub UI pages** — Brand Kit editor, Media Asset manager, Template picker + media slot mapper
4. **Test with real client data** — create a brand kit, upload media, generate copy via the existing AI workflow, pick a template, publish

---

## KEY PRINCIPLES

- **Templates are layout. AI generates copy. Humans choose media. Brand kit handles styling.** None of these jobs should bleed into each other.
- **Shared sections are the reusable building blocks.** Templates are just different arrangements and styling of those blocks.
- **CSS custom properties make every template instantly rebrandable.** No template should have a single hardcoded color.
- **Every template must look premium with zero media assets.** Images enhance but shouldn't be required (use colored backgrounds, gradients, or subtle patterns as fallbacks).
- **Mobile first.** Most traffic from Meta ads hits on mobile. Desktop is secondary.
- **Fast.** Landing pages must score 90+ on Lighthouse. No heavy JS, lazy load images, minimize layout shift.
