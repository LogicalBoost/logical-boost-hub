// Build Landing Page — assembles the full template prompt with global design rules,
// copy slots, and client website URL, then sends to the design engine.
//
// Prompt structure follows the wireframe spec exactly:
// [Global Brand Extraction] + [Global Soft Gradients] + [Global Design Accents]
// + [Global Mobile Rules] + [Global Image/Video Placeholders] + [Global Hard Rules]
// + [Template-specific prompt with copy slots inserted]

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

// ============================================================
// GLOBAL RULES — injected into every prompt
// ============================================================

function GLOBAL_BRAND_EXTRACTION(websiteUrl: string, brandRefUrl?: string): string {
  return `Before designing anything, visit ${websiteUrl} and extract the complete design system from that site. Pull the exact colors, fonts, button styles, spacing rhythm, card styles, border radius values, shadow styles, and overall visual tone directly from what you observe. Do not guess. Do not use generic fintech or SaaS defaults. Use only what is actually present on that website. Also extract any real customer testimonials, proof stats, or social proof figures present on the site and use them in the social proof section. The client's website IS the brand kit. Build this page so it feels like a natural extension of that site — same visual family, same design language.${brandRefUrl ? ` If the main website doesn't reflect the brand accurately, also reference ${brandRefUrl} for brand extraction.` : ''}`
}

const GLOBAL_SOFT_GRADIENTS = `Every background surface on this page uses a soft gradient. No flat solid fills anywhere.
LIGHT SECTIONS: linear-gradient from pure white to a very faint tint of the brand's primary color at 4-6% opacity. Direction: 135deg. Barely perceptible — if you can clearly see where the gradient ends, it is too strong.
HERO SECTION: radial-gradient — white or very light at center, faint brand primary tint at edges (4% opacity). Creates depth without drama.
CARD BACKGROUNDS: linear-gradient from white at top to brand primary at 2-3% opacity at bottom. Adds warmth without competing with content.
DARK SECTIONS (reviews, final CTA): gradient between two shades of the same dark color — never flat. Use the dark brand color at 100% top, lightening slightly (5-8%) toward the bottom, or shift slightly in hue.
CTA BUTTONS: linear-gradient top to bottom — base CTA color at top, darken by 8% at bottom. Adds depth and makes buttons feel tactile.
RULE: All gradients stay within the brand's own color family. No rainbow gradients. No multi-color transitions. Subtle depth only.`

const GLOBAL_DESIGN_ACCENTS = `Apply small decorative details throughout the page to elevate it from template to crafted. These must feel like background texture — they never compete with copy or CTAs.
HERO BACKGROUND: 2-3 soft floating shapes — blurred circles or organic blobs at 6-8% opacity in the brand's primary color. Position asymmetrically. filter: blur(50px). Positioned behind the content layer, never in front.
SECTION TRANSITIONS: instead of hard background color changes between sections, use a 48px gradient overlap so one section's background softly bleeds into the next.
CATEGORY / FEATURE CARDS: a very faint diagonal line pattern or dot grid at 3-4% opacity in the top-right corner of each card. Creates subtle texture.
BENEFIT CARDS: small decorative corner bracket (2px, brand accent color) in the top-left corner of each card. Adds a refined crafted detail.
RESULT / STAT FIGURES: a soft radial glow behind each large number — brand primary color at 8% opacity, 80px diameter, blurred. Makes numbers feel alive.
DARK SECTIONS (final CTA, reviews): one large soft blurred circle (brand primary at 12-15% opacity, 500px diameter, filter: blur(80px)) offset to one corner. Adds depth to the dark background without looking busy.
ACCENT LINES: 2px lines or small corner brackets in the brand's accent color appear above key section headlines and beside important proof numbers.
WHAT THESE MUST NOT DO: Never be visible as obvious foreground elements. Never use opacity above 15% for background accents. Never distract from the copy or CTAs. If in doubt, reduce opacity further.`

const GLOBAL_MOBILE_RULES = `Build mobile-first. Default styles target 320px+ screens. Layer on tablet styles at min-width: 768px. Layer on desktop styles at min-width: 1024px.
BREAKPOINT SUMMARY: - Mobile default: below 768px - Tablet: 768px - 1023px - Desktop: 1024px and above
GLOBAL MOBILE RULES (apply to all sections unless overridden per template):
Typography: - Hero headline: 32px, font-weight 800, line-height 1.15, text-align center - Section headlines: 26px, font-weight 700, text-align center - Subheadlines: 16px, line-height 1.6 - Body copy: 15px, line-height 1.65 - Captions / muted text: 13px - Minimum font size anywhere: 12px
Spacing: - Section vertical padding: 56px top and bottom - Section horizontal padding: 20px on all content — nothing bleeds to edge - Card internal padding: 20px - Gap between cards: 12px
Buttons: - Full width (width: 100%) on mobile - Height: 52px minimum - Font size: 16px, font-weight 700 - Border-radius: 10px - Touch target minimum: 44px height on ALL interactive elements
Grids: - All multi-column grids collapse to 1 column on mobile - Exception: category cards and results cards can be 2 columns if labels are short (under 20 chars) - Testimonials: always 1 column on mobile
Images and media: - All images full width (width: 100%) - Border-radius: 12px - Video placeholders: 16:9 ratio maintained, full width
No horizontal scrolling at any viewport width.
GLOBAL TABLET RULES (768px+): - Section padding: 72px vertical, 40px horizontal - Hero headline: 42px - Section headlines: 30px - Category cards: 3 columns - Benefits: 3 columns - Testimonials: 3 columns in a row - Results: 4 columns if 4 items, 2 columns if 2 items - Buttons: auto width, min-width 180px, not full width
GLOBAL DESKTOP RULES (1024px+): - Section padding: 88px vertical, content max-width 1100px centered - Hero headline: per template spec - All grids: per template spec - Sticky header active`

const GLOBAL_IMAGE_VIDEO_PLACEHOLDERS = `When the template calls for an image or video that has not been provided:
IMAGE PLACEHOLDERS: Do NOT use gray boxes. Build a styled placeholder using brand colors — a rounded rectangle filled with a soft gradient of the brand's primary and accent colors at low opacity, with a subtle geometric pattern or abstract shape overlay. It should look designed, not empty.
VIDEO PLACEHOLDERS: 16:9 aspect ratio container. Background: dark gradient using brand colors. Centered: a large play button circle (56px diameter, white background, brand-colored triangle icon, slight shadow). Below the play button: small label text in muted white. Border-radius: 12px. Box-shadow: subtle.
HERO ILLUSTRATION: When no image is provided for the hero right column, draw an abstract illustration using brand colors — geometric shapes, floating elements, or a simple human silhouette in a relevant context. Use the brand's primary, accent, and light tint colors. Make it feel intentionally illustrated, not placeholder.
All placeholders use brand colors. None are gray.`

const GLOBAL_HARD_RULES = `1. Brand extraction from the client URL is required. Never guess colors.
2. The hero background color matches what was extracted from the client site. Do not override it with a dark or gradient background unless the client site itself uses a dark hero.
3. All copy slots are plain strings. Never render [object Object].
4. No navigation links in the header. Logo + one CTA button only.
5. All CTA buttons use the extracted CTA/accent color. Consistent throughout.
6. Build exactly the sections specified. No additions. No omissions.
7. Fully responsive at 320px, 768px, and 1024px. No horizontal scroll.
8. Touch targets minimum 44px on all interactive elements.
9. Fonts must not default to Inter, Roboto, or Arial. Use fonts extracted from the client site or a distinctive alternative from Google Fonts.
10. Image and video slots marked [PLACEHOLDER] receive styled brand-colored placeholders, not gray boxes.
11. NEVER use em dashes anywhere in the output.
12. Output must be a complete HTML document (<!DOCTYPE html> to </html>) with all CSS in a <style> tag and all JS inline. No external dependencies except Google Fonts.`

// ============================================================
// TEMPLATE-SPECIFIC PROMPTS
// ============================================================

const TEMPLATE_PROMPTS: Record<string, string> = {

template_1: `TEMPLATE: Conditional Funnel / Quiz-Led
CONVERSION GOAL: The quiz widget IS the hero. Everything on the page serves it. Visitor self-qualifies through 2 steps before seeing a contact form. By the time they reach the form they've committed mentally. Short page — funnel above the fold, social proof below.

---

PAGE STRUCTURE — BUILD EXACTLY THESE 4 SECTIONS:

SECTION 1 — HEADER: Logo only, left-aligned. No navigation. Height 56px desktop, 52px mobile. Transparent or matches hero background. Not sticky.

SECTION 2 — HERO + QUIZ WIDGET:
Desktop: two-column, left 48% / right 52%. Vertical padding 88px.
Mobile: single column centered. Vertical padding 56px.

Left column (desktop) / top block (mobile):
- Headline: {{t1_headline}} — Desktop 52px / Mobile 30px. Font-weight 800. Line-height 1.1. Centered on mobile.
- Subheadline: {{t1_subheadline}} — Desktop 18px / Mobile 15px. Muted color. Margin-top 12px. Centered on mobile.

Quiz widget card (right column desktop, below text mobile):
Style: white background, border-radius 14px, box-shadow 0 8px 40px rgba(0,0,0,0.12), padding 32px desktop / 20px mobile. Full-width on mobile.

Inside the widget — Step 1 (default state):
- Step indicator: "Step 1 of 3" — 11px, muted, top-right of widget
- Question label: {{t1_q1_prompt}} — 16px bold, margin-bottom 16px
- Answer tiles: CSS grid, 2 columns desktop / 1 column mobile. Each tile: min-height 56px desktop / 52px mobile, border 1.5px solid light color, border-radius 10px, padding 12px 16px, cursor pointer, font-size 14-15px. Hover: border-color changes to extracted CTA color, background tint at 5% opacity, transition 150ms.
- Options: {{t1_q1_options}}
- Clicking any tile triggers Step 2 — no submit button

Inside the widget — Step 2 (after tile click):
- CSS slide or fade transition, 220ms ease
- Step indicator updates to "Step 2 of 3"
- Question: {{t1_q2_prompt}}
- Same tile format. Options: {{t1_q2_options}}
- Back text link bottom-left, 13px muted

Inside the widget — Step 3 form (after Step 2 tile click):
- Step indicator: "Step 3 of 3"
- 2 input fields: First Name + Phone (or Email). Full width, height 48px, border 1.5px, border-radius 8px.
- CTA button: {{t1_cta}} — full width, height 56px, extracted CTA color, white text, font-weight 700.
- Trust line: {{t1_trust_line}} — 12-13px centered muted text below button

SECTION 3 — SOCIAL PROOF WALL:
Contrasting background (extracted dark or secondary brand color). Padding 80px desktop / 56px mobile.
Rating block centered: {{t1_proof_rating}} — large star icons (gold), rating number 40px bold, count + platform 16px muted.
Testimonial cards: 3 columns desktop / 1 column mobile. Gap 20px. Each card: white background, border-radius 12px, padding 24px, box-shadow subtle. Structure: 5 gold stars, quote text, reviewer name bold, date muted.
Cards: {{t1_testimonials}}
Trust badge strip: horizontal row desktop / 2-per-row wrap mobile. Muted/grayscale styling.
Badges: {{t1_trust_badges}}

SECTION 4 — FOOTER: Dark background. Single row: logo left, disclaimer center (11px muted), privacy link right.
Disclaimer: {{t1_disclaimer}}

---

INTERACTIONS:
- Quiz step transitions: CSS slide (translateX) or opacity fade, 220ms ease-out
- Tile hover: border color change + background tint, 150ms ease
- CTA button hover: brightness 1.08 + scale 1.02, 150ms ease
- All touch targets minimum 44px height on mobile
- No page load animations. No scroll animations.
- All CTA buttons link to "#contact" as placeholder anchor.`,

template_2: `TEMPLATE: Problem/Solution with Category Segmentation
CONVERSION GOAL: Hero establishes authority and outcome. Category cards below the fold segment the visitor by their exact situation — this is the conversion hinge. Seeing their problem named makes them stay. Benefits, proof, results, and final CTA close the argument.

---

PAGE STRUCTURE — BUILD EXACTLY THESE 7 SECTIONS:

SECTION 1 — HEADER: Sticky. Height 68px desktop / 56px mobile. Logo left. Right: phone number (bold, extracted CTA color, phone icon) OR CTA button. Shadow appears on scroll via JS scroll listener.

SECTION 2 — HERO:
Desktop: split — text left 55% / image right 45%. Min-height 500px. Padding 88px vertical.
Mobile: single column centered. Padding 56px top / 48px bottom.

Pre-headline: {{t2_pre_headline}} — 12px all-caps desktop / 11px mobile, letter-spacing 0.12em, accent color. Centered on mobile.
Headline: {{t2_headline}} — 56px desktop / 32px mobile, font-weight 800, line-height 1.1. Centered on mobile.
Subheadline: {{t2_subheadline}} — 19px desktop / 16px mobile, muted. Margin-top 16px. Centered on mobile.
CTA: {{t2_hero_cta}} — 56px height desktop / full-width 52px mobile. Extracted CTA color. Margin-top 28px.
Trust trio: {{t2_trust_trio}} — 3 items, checkmark icon + text. Horizontal desktop / stacked vertical mobile. 14px desktop / 13px mobile.
Right image (desktop only): rounded card, brand-colored placeholder.

SECTION 3 — CATEGORY SEGMENTATION:
Background: extracted light section color. Padding 80px desktop / 56px mobile.
Section headline: {{t2_category_headline}} — 32px desktop / 26px mobile, bold, centered.
Card grid: 3 columns desktop / 2 columns mobile. Gap 16px desktop / 12px mobile.
Each card: white bg, border 1.5px light, border-radius 14px. Desktop: padding 28px 24px, min-height 110px. Mobile: padding 18px 14px.
Content: emoji icon (36px desktop / 28px mobile) + label (17px desktop / 15px mobile, bold) + description (13px desktop / 12px mobile, muted).
Hover (desktop): border-color extracted CTA color, box-shadow 0 4px 20px rgba(0,0,0,0.10), translateY(-2px), 200ms.
Cards: {{t2_categories}}

SECTION 4 — CORE BENEFITS:
White background. Padding 80px desktop / 56px mobile.
Section headline: {{t2_benefits_headline}} — 32px desktop / 26px mobile, centered.
Grid: 3 columns desktop / 1 column mobile. Gap 24px.
Each card: 4px top border (extracted accent color), padding 32px desktop / 24px mobile. Icon (44px desktop / 40px mobile) + headline (20px desktop / 18px mobile, bold) + explanation (15px desktop / 14px mobile, muted, line-height 1.65).
Cards: {{t2_benefits}}

SECTION 5 — SOCIAL PROOF:
Dark background (extracted dark brand color). Padding 80px desktop / 56px mobile.
Rating: {{t2_proof_rating}} — stars gold, number 42px bold white, count + platform 16px white muted.
Cards: {{t2_testimonials}} — 3 columns desktop / 1 column mobile. White cards with shadow. Structure each card: gold stars, quote (15px), name bold (14px), descriptor muted (13px).

SECTION 6 — RESULTS:
White background. Padding 80px desktop / 56px mobile.
Section headline: {{t2_results_headline}} — 30px desktop / 24px mobile, centered.
Grid: match number of results for columns desktop / 2 columns mobile.
Each card: 4px top border (extracted primary color), centered content. Figure: 42px desktop / 32px mobile, font-weight 800, extracted primary color. Label: 14px desktop / 13px mobile, muted.
Results: {{t2_results}}

SECTION 7 — FINAL CTA:
Extracted primary color background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t2_final_headline}} — 36px desktop / 28px mobile, white, font-weight 800.
CTA button: {{t2_final_cta}} — full width mobile / auto desktop. Extracted CTA color.
Phone: {{t2_phone_cta}} — if provided, 18px white, phone icon, below button.

FOOTER: Dark. Logo + disclaimer text + privacy link.
Disclaimer: {{t2_disclaimer}}

---

INTERACTIONS:
- Sticky header: JS scroll listener adds shadow class after 10px scroll
- Category card hover: all transitions as specified, 200ms ease
- All interactive elements minimum 44px touch target on mobile
- No scroll animations. Clean and fast.`,

template_3: `TEMPLATE: Feature-Dense Authority Page
CONVERSION GOAL: Hero captures leads immediately. Page depth proves capability. Interactive use-case tabs let visitors self-navigate to what matters to them. Feature grid shows breadth. Social proof closes. Page length itself signals seriousness.

---

PAGE STRUCTURE — BUILD EXACTLY THESE 7 SECTIONS:

SECTION 1 — HEADER: Sticky. 68px desktop / 56px mobile. Logo left. Nav links (desktop only, hidden mobile). CTA button right.

SECTION 2 — HERO (two-column desktop, single-column mobile):
Desktop: left 58% content / right 42% form card. Padding 80px vertical.
Mobile: stacked. Content above, form card below. Padding 56px.

Left/top content:
Headline: {{t3_headline}} — 52px desktop / 32px mobile, font-weight 800.
Subheadline: {{t3_subheadline}} — 18px desktop / 16px mobile, muted, line-height 1.6. Margin-top 16px.
Feature bullets: {{t3_feature_bullets}} — checkmark icon (extracted accent) + text. Desktop 15-16px / Mobile 14px. Line-height 2.

Form card (desktop right / mobile below content):
White card, border-radius 16px, box-shadow 0 8px 40px rgba(0,0,0,0.12), padding 32px desktop / 24px mobile.
Form headline: {{t3_form_headline}} — 18-20px bold.
2-3 fields: full width, height 48px desktop / 44px mobile.
CTA: {{t3_form_cta}} — full width, 52px. Extracted CTA color.
Secondary: {{t3_secondary_cta}} — text link below button, 14px, extracted primary color.

SECTION 3 — LOGO BAR:
Light background. Padding 32px vertical. Label: {{t3_logo_bar_label}} — 14px centered muted. Logos: horizontal flex desktop / overflow-x scroll mobile. Grayscale 55% opacity.

SECTION 4 — USE CASE TABS:
Light gray background. Padding 80px desktop / 56px mobile.
Headline: {{t3_tab_headline}} — 34px desktop / 26px mobile, centered.
Subheadline: {{t3_tab_subheadline}} — 17px muted, centered.
Pill row: horizontal flex desktop / overflow-x scroll mobile. Active pill: extracted primary color filled. Inactive: outlined muted. Height 40px.
Content panel: fades on tab change (opacity transition 200ms). Desktop: left 58% text / right 42% screenshot. Mobile: text above / screenshot below.
Tabs: {{t3_tabs}}

SECTION 5 — FEATURES GRID:
White background. Padding 80px desktop / 56px mobile.
Headline: {{t3_features_headline}} — 32px desktop / 26px mobile, centered.
Grid: 3 columns desktop / 1 column mobile. Gap 24px.
Each card: padding 28-32px. Icon (40-44px, extracted primary) + name (17-18px bold) + description (14-15px muted, line-height 1.65).
Features: {{t3_features}}

SECTION 6 — SOCIAL PROOF:
White or very light background. Padding 80px desktop / 56px mobile.
Rating badges: {{t3_proof_ratings}} — row desktop / stacked mobile.
Testimonials: {{t3_testimonials}} — 2-3 columns desktop / 1 column mobile.

SECTION 7 — FINAL CTA:
Extracted primary or dark background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t3_final_headline}} — 34px desktop / 26px mobile, white.
Buttons: {{t3_final_cta}} + {{t3_final_secondary_cta}} — side by side desktop / stacked mobile.

FOOTER: Multi-column dark. Logo + navigation columns + disclaimer.

---

INTERACTIONS:
- Tab switching: JS click handler, opacity fade 200ms, pill active state updates
- Sticky header: shadow on scroll
- All touch targets 44px+ mobile
- Fully functional tab navigation`,

template_4: `TEMPLATE: Possibility Showcase / Output Gallery
CONVERSION GOAL: Show what this product or service produces. Gallery-style, richly visual, scrolling output demonstrations per use case. Each showcase block adds another reason to convert. Visual density is a feature.

---

PAGE STRUCTURE — BUILD EXACTLY THESE SECTIONS:

SECTION 1 — HEADER: Sticky. Logo left / CTA right. Minimal.

SECTION 2 — HERO:
Centered. Padding 88px desktop / 56px mobile. Bold, energetic background.
Headline: {{t4_headline}} — 60px desktop / 38px mobile, font-weight 900, line-height 1.05.
Subheadline: {{t4_subheadline}} — 18px desktop / 15px mobile, muted. Margin-top 14px.
CTA pair: {{t4_primary_cta}} + {{t4_secondary_cta}} — side by side desktop / stacked mobile.
Stats bar: {{t4_stats}} — 3 stats, large number + label. Horizontal row desktop / stacked mobile. JS count-up animation on page load (1.5s, ease-out).
Logo bar: {{t4_logo_bar_label}} + logos row. Grayscale. Horizontal scroll on mobile.

SECTION 3 — USE CASE NAVIGATION:
Light background strip. Padding 16px vertical. Pills: {{t4_use_case_tabs}} — horizontal row desktop / overflow-x scroll mobile. Becomes sticky after hero scrolls out (JS IntersectionObserver).

SECTIONS 4-N — SHOWCASE BLOCKS (build one per item in t4_showcase_blocks):
Each block: full width. Padding 88px desktop / 56px mobile. Backgrounds alternate: white and extracted light section tint.
Desktop layout alternates: ODD = text left 44% / visual right 56%. EVEN = visual left 56% / text right 44%.
Mobile: always text above / visual below. Single column.
Each block has anchor ID matching its use case tab.
Text side: Badge + headline + description + CTA button.
Visual side: 16:9 rounded card with brand-colored placeholder.
Scroll animation: IntersectionObserver fade-in (opacity 0 to 1, translateY 32px to 0, 400ms ease).
Blocks: {{t4_showcase_blocks}}

SECTION N+1 — CAPABILITY SUMMARY:
White background. Padding 80px desktop / 56px mobile.
Headline: {{t4_capability_headline}} — 32px desktop / 26px mobile, centered.
Cards: {{t4_capability_cards}} — 3-4 columns desktop / 1 column mobile.

SECTION N+2 — FINAL CTA:
Extracted primary color or gradient background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t4_final_headline}} — 36px desktop / 28px mobile, white.
CTAs: {{t4_final_cta}} + {{t4_final_secondary_cta}} — side by side desktop / stacked full-width mobile.

FOOTER: Dark. Multi-column desktop / stacked mobile.

---

INTERACTIONS:
- Stats count-up: requestAnimationFrame from 0 to final value, 1.5s, ease-out
- Sticky use-case nav: IntersectionObserver on hero section
- Showcase block scroll animation: IntersectionObserver fade + lift, stagger
- Pill click: smooth-scroll to anchor`,

template_5: `TEMPLATE: Video + Social Proof Wall
CONVERSION GOAL: Video handles the selling. The testimonial wall (minimum 8 cards, specific results, real names) overwhelms skepticism through abundance. Nothing competes with the video or the proof wall. CTA is singular and simple.

---

PAGE STRUCTURE — BUILD EXACTLY THESE 5 SECTIONS:

SECTION 1 — HEADER: Minimal. Logo left. Single CTA right. No nav. Sticky. 60px desktop / 56px mobile.

SECTION 2 — HERO:
Strong background (extracted). Centered. Max-width 760px content column. Padding 80px desktop / 56px mobile.
Headline: {{t5_headline}} — 48px desktop / 32px mobile, font-weight 800, centered.
Subheadline: {{t5_subheadline}} — 18px desktop / 15px mobile, muted 75%, centered. Margin-top 14px.
Video: {{t5_video_url}} — max-width 700px desktop / full-width mobile. 16:9 ratio. If URL: iframe embed, border-radius 12px, box-shadow. If [PLACEHOLDER]: styled video placeholder per global rules.
CTA: {{t5_primary_cta}} — centered below video. 56px desktop / full-width 52px mobile. Extracted CTA color.

SECTION 3 — WHO IT'S FOR:
Contrasting background. Padding 64px desktop / 52px mobile.
Headline: {{t5_who_headline}} — 28px desktop / 22px mobile, centered.
Bullets: {{t5_who_bullets}} — centered column, max-width 560px. Each: checkmark circle (extracted primary) + text 16px / 15px mobile.

SECTION 4 — TESTIMONIAL WALL:
Light background. Padding 80px desktop / 56px mobile.
Headline: {{t5_testimonials_headline}} — 28px desktop / 22px mobile, centered. Margin-bottom 36px.
Grid: 3-4 columns desktop / 1-2 columns mobile. Gap 18px. Render ALL cards — minimum 8.
Each card: white bg, border 1px light, border-radius 12px, padding 20-24px, subtle shadow. Photo: 48px circle placeholder + name bold 14px + role muted 12-13px. Stars: 5 gold, 14px. Quote: 14-15px, line-height 1.7. Full text, not truncated.
Cards: {{t5_testimonials}}
Video testimonials (only if slot populated): {{t5_video_testimonials}} — horizontal row desktop / overflow-x scroll mobile.

SECTION 5 — FINAL CTA:
Extracted primary color background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t5_final_headline}} — 36px desktop / 26px mobile, white, font-weight 800.
CTA: {{t5_final_cta}} — centered, 56px desktop / full-width 52px mobile.

FOOTER: Minimal dark. Logo + disclaimer + privacy + copyright.

---

INTERACTIONS:
- Video: if URL present, embed with autoplay=0. If placeholder, show styled placeholder.
- No scroll animations. Fast, clean.
- All touch targets 44px+ mobile.`,

template_6: `TEMPLATE: VSL / Long-Form Direct Response
CONVERSION GOAL: Take a cold skeptical visitor through a complete argument. Every section earns the scroll to the next. No nav. No distractions. Reading copy is the design. Long page = seriousness to this audience.

---

PAGE STRUCTURE — BUILD EXACTLY THESE 8 SECTIONS:

SECTION 1 — HEADER: Logo ONLY. No nav. No CTA. No phone. Not sticky.

SECTION 2 — VSL HERO:
Centered column, max-width 760px, margin 0 auto. Padding 80px desktop / 56px mobile.
Pre-headline: {{t6_pre_headline}} — 13px, accent color, bold, centered.
Headline: {{t6_headline}} — 44px desktop / 30px mobile, font-weight 800, centered, line-height 1.2.
Video: {{t6_video_url}} — max-width 680px, centered. 16:9. Border-radius 8px. Shadow.
CTA: {{t6_hero_cta}} — centered, 56px desktop / full-width 52px mobile.

SECTION 3 — PROBLEM:
Centered column, max-width 680px. Padding 64px desktop / 52px mobile. White background.
Copy: {{t6_problem_copy}} — 17-18px desktop / 16px mobile, line-height 1.8. Flowing prose, no bullets. First phrase of each paragraph bold for rhythm.

SECTION 4 — SOLUTION + MECHANISM:
Centered column, max-width 680px. Padding 64px desktop / 52px mobile. Light gray background.
Copy: {{t6_solution_copy}} — same body treatment.

SECTION 5 — OFFER STACK:
Full width. Deep dark background. Padding 80px desktop / 56px mobile.
Headline: "Here's Everything You Get" — 28px desktop / 22px mobile, white, centered.
Items: {{t6_offer_items}} — max-width 680px centered. Each: flex row. Left: numbered badge (40px, extracted accent, white number). Right: name bold white + description white muted. Divider between items.

SECTION 6 — PROOF:
Centered column, max-width 760px. Padding 80px desktop / 56px mobile. White background.
Items: {{t6_proof_items}} — card per item. Result figure: 32-40px bold, extracted primary. Photo placeholder 56px circle. Name + role. Story paragraph 15-16px.

SECTION 7 — FAQ:
Centered column, max-width 680px. Padding 80px desktop / 56px mobile. Light background.
Headline: "You Might Be Wondering..." — 24px desktop / 20px mobile, centered.
Accordion: {{t6_faq}} — question row (click to toggle), chevron rotates 180deg, answer slides open (max-height transition 300ms). One open at a time.

SECTION 8 — GUARANTEE:
Full width. Extracted accent at 10% opacity tint background. Padding 64px desktop / 52px mobile.
Centered max-width 600px. Shield icon centered above. "Our Guarantee" small caps label.
Copy: {{t6_guarantee}} — 16px body, centered, line-height 1.7.

SECTION 9 — FINAL CTA:
Dark background. Padding 80px desktop / 56px mobile. Centered max-width 680px.
Urgency callout: {{t6_urgency}} — border-left 4px extracted accent, padding 16px, background accent 8% opacity, italic.
CTA: {{t6_final_cta}} — centered, 60px height desktop / full-width 52px mobile. Maximum visual weight.

FOOTER: Minimal dark. Disclaimer + privacy + copyright.

---

INTERACTIONS:
- FAQ accordion: JS click handler, max-height transition 300ms, chevron CSS rotation
- One FAQ item open at a time
- No nav. No sticky elements.
- Reading experience is paramount — generous line-height, appropriate font size`,

template_7: `TEMPLATE: Comparison / Challenger
CONVERSION GOAL: Position against the status quo. The comparison block is the emotional centerpiece — old way must look and feel broken/painful, new way must look vivid and solving. Then benefits, switcher proof, CTA.

---

PAGE STRUCTURE — BUILD EXACTLY THESE 6 SECTIONS:

SECTION 1 — HEADER: Sticky. Logo left. CTA button right.

SECTION 2 — HERO:
Full width. Centered. Padding 80px desktop / 56px mobile.
Headline: {{t7_headline}} — 48px desktop / 32px mobile, font-weight 800. Must feel like a position, not a description.
Subheadline: {{t7_subheadline}} — 18px desktop / 15px mobile, muted. Specific pain with status quo.
CTA: {{t7_hero_cta}} — standard large button. Full width on mobile.

SECTION 3 — COMPARISON BLOCK:
White background. Padding 80px desktop / 56px mobile. Centered max-width 900px.

DESKTOP: Two-column table. Column headers row:
Old: {{t7_comparison_label_old}} — background #f0f0f0, text #666666, 18-20px bold, X prefix in #cc4444.
New: {{t7_comparison_label_new}} — background extracted primary color, white text, 18-20px bold, checkmark prefix in white.
Rows: 3 cells each — dimension (30%, bold 15px), old text (35%, muted gray, X prefix), new text (35%, extracted primary, checkmark prefix, font-weight 500).
Alternating row backgrounds. Border between rows. Wrap: border 1px #e0e0e0, border-radius 12px, overflow hidden.

MOBILE: Vertical stacking. Old column header + all old-column rows in a card (gray bg, muted styling). New column header + all new-column rows in a card below (extracted primary bg light tint, vivid styling).
Comparison data: {{t7_comparison_rows}}

SECTION 4 — BENEFITS:
Light gray background. Padding 80px desktop / 56px mobile.
Headline: {{t7_benefits_headline}} — 28-32px desktop / 24px mobile, centered.
Cards: {{t7_benefits}} — 3-4 columns desktop / 1 column mobile.

SECTION 5 — SOCIAL PROOF:
White background. Padding 80px desktop / 56px mobile.
Headline: {{t7_testimonials_headline}} — 28px desktop / 22px mobile, centered.
Cards: {{t7_testimonials}} — 3 columns desktop / 1 column mobile. Style transformation phrases in extracted accent color, italic.

SECTION 6 — FINAL CTA:
Extracted primary background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t7_final_headline}} — 34px desktop / 26px mobile, white.
CTA: {{t7_final_cta}} — standard button. Full width mobile.

FOOTER: Standard dark.

---

INTERACTIONS:
- Sticky header with scroll shadow
- All touch targets 44px+ mobile
- No scroll animations`,

template_8: `TEMPLATE: Urgency / Event-Driven
CONVERSION GOAL: The visitor already knows they have a problem. Show them why acting NOW matters, what happens if they wait, how easy the action is, and why this business is credible. Urgency must feel real — not manufactured spam. Controlled alarm. Short, direct, no fluff.

---

PAGE STRUCTURE — BUILD EXACTLY THESE 6 SECTIONS:

SECTION 1 — HEADER: Sticky. 68px desktop / 56px mobile. Logo left. Right: phone number (large, bold, extracted CTA color, phone icon, tel: link) + CTA button. No nav links. Shadow on scroll. Mobile: phone number as icon-only or small, CTA button right.

SECTION 2 — URGENCY HERO:
Strong background — use extracted primary color as background, or a dark/high-contrast variant. This must feel IMMEDIATE. Do not use plain white for this template's hero. Padding 80px desktop / 56px mobile. All content centered.

Pre-headline: {{t8_pre_headline}} — alert badge: inline-flex, extracted accent bg (or amber #F59E0B), white text, 12-13px bold all-caps, border-radius 9999px, padding 6px 16px. Centered.
Headline: {{t8_headline}} — 48px desktop / 30-34px mobile, font-weight 800, white/high-contrast, centered, line-height 1.15.
Subheadline: {{t8_subheadline}} — 18px desktop / 15px mobile, white 80%, centered.
CTA button: {{t8_hero_cta}} — 56px height desktop / full-width 52px mobile. Maximum contrast against hero background. Hover: scale 1.03 + glow (box-shadow 0 0 24px CTA-color-at-60%).
Urgency element: {{t8_urgency_element}} — below CTA, margin-top 18px. Calendar or clock emoji + text, 14px white 65%, centered, italic.

SECTION 3 — RISK BLOCK:
White background. Padding 80px desktop / 56px mobile.
Section headline: {{t8_risk_headline}} — 28-32px desktop / 24px mobile, centered, bold.
Items: {{t8_risks}} — max-width 680px centered. Each item: flex row. Left: warning icon (28-32px, amber). Right: bold statement (16-18px desktop / 15px mobile, font-weight 700) + explanation (14-15px desktop / 13px mobile, muted).

SECTION 4 — HOW IT WORKS:
Extracted light section background. Padding 80px desktop / 56px mobile.
Section headline: "Here's How It Works" — 24-28px desktop / 22px mobile, centered.
3-step process: Desktop: flex row, 3 equal columns. Mobile: flex column, stacked.
Each step: number circle (52px desktop / 44px mobile, extracted primary bg, white bold number) then step name then description.
Desktop connector: dashed horizontal line between circle centers.
Steps: {{t8_steps}}

SECTION 5 — PROOF / TRUST:
White background. Padding 64-80px desktop / 52px mobile.
Trust badges: horizontal flex row desktop / 2-per-row wrap mobile.
Testimonials: 2-3 columns desktop / 1 column mobile.
Items: {{t8_proof_items}}

SECTION 6 — FINAL CTA:
Dark background. Padding 80px desktop / 56px mobile. Centered.
Urgency restatement: {{t8_final_urgency}} — italic, white 65%, 15-16px, centered.
CTA button: {{t8_final_cta}} — centered, 60px height desktop / full-width 52px mobile. Maximum contrast. Hover glow.
Phone: {{t8_phone_cta}} — if provided, 18-20px white bold, phone icon, tel: link, centered below button.

FOOTER: Minimal dark. Disclaimer: {{t8_disclaimer}}. Privacy link. Copyright.

---

INTERACTIONS:
- Sticky header: scroll shadow via JS
- Hero CTA hover: scale + glow, 200ms
- Final CTA hover: glow effect
- All touch targets 44px+ mobile
- Phone number: large tap target, tel: link
- No scroll animations. Fast and direct.`,
}

// ============================================================
// PROMPT ASSEMBLY
// ============================================================

function assemblePrompt(
  templateId: string,
  copySlots: Record<string, string>,
  websiteUrl: string,
  brandRefUrl?: string
): string {
  // Get the template-specific prompt
  let templatePrompt = TEMPLATE_PROMPTS[templateId]
  if (!templatePrompt) {
    throw new Error(`Unknown template: ${templateId}`)
  }

  // Replace copy slot placeholders with actual values
  for (const [slotId, value] of Object.entries(copySlots)) {
    const placeholder = `{{${slotId}}}`
    templatePrompt = templatePrompt.replaceAll(placeholder, value || '[NOT PROVIDED]')
  }

  // Assemble the full prompt
  return `${GLOBAL_BRAND_EXTRACTION(websiteUrl, brandRefUrl)}

${GLOBAL_SOFT_GRADIENTS}

${GLOBAL_DESIGN_ACCENTS}

${GLOBAL_MOBILE_RULES}

${GLOBAL_IMAGE_VIDEO_PLACEHOLDERS}

${GLOBAL_HARD_RULES}

---

${templatePrompt}`
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, avatar_id, offer_id, template_id, copy_slots } = await req.json()

    if (!client_id || !avatar_id || !offer_id || !template_id || !copy_slots) {
      return errorResponse('client_id, avatar_id, offer_id, template_id, and copy_slots are required')
    }

    if (!TEMPLATE_PROMPTS[template_id]) {
      return errorResponse(`Invalid template_id: ${template_id}. Must be template_1 through template_8.`)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client data
    const { data: client, error: clientErr } = await supabase
      .from('clients').select('*').eq('id', client_id).single()
    if (clientErr || !client) {
      return errorResponse(`Client not found: ${clientErr?.message || 'No data'}`)
    }

    const websiteUrl = client.website || ''
    const brandRefUrl = client.brand_reference_url || undefined

    // Assemble the full prompt with all global rules + template spec + copy slots
    const fullPrompt = assemblePrompt(template_id, copy_slots, websiteUrl, brandRefUrl)

    // Send to design engine (Claude with the full Stitch-format prompt)
    const html = await callClaude(
      'You are a world-class landing page designer. You receive detailed design specifications and produce complete, production-ready HTML pages. Follow every instruction exactly. Output ONLY the complete HTML document from <!DOCTYPE html> to </html>. No markdown. No explanation. No code fences.',
      fullPrompt,
      {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 16384,
      }
    )

    // Clean up any markdown code fences
    let cleanHtml = html.trim()
    if (cleanHtml.startsWith('```')) {
      cleanHtml = cleanHtml.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    // Extract headline from copy slots for the record
    const headline = copy_slots[`${template_id.replace('template_', 't')}_headline`] ||
      copy_slots.t1_headline || copy_slots.t2_headline || copy_slots.t3_headline ||
      copy_slots.t4_headline || copy_slots.t5_headline || copy_slots.t6_headline ||
      copy_slots.t7_headline || copy_slots.t8_headline || ''

    // Insert landing page record
    const { data: landingPage, error: insertError } = await supabase
      .from('landing_pages')
      .insert({
        client_id,
        avatar_id,
        offer_id,
        template_id,
        copy_slots,
        page_html: cleanHtml,
        stitch_output_code: cleanHtml,
        headline,
        brand_kit_snapshot: client.brand_kit || {},
        deploy_status: 'draft',
        status: 'approved',
        iteration_history: [{
          version: 1,
          prompt: 'Initial build',
          stitch_preview_url: null,
          created_at: new Date().toISOString(),
        }],
      })
      .select()
      .single()

    if (insertError) {
      return errorResponse(`Failed to save landing page: ${insertError.message}`, 500)
    }

    return jsonResponse({
      success: true,
      landing_page: landingPage,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
