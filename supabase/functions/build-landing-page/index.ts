// Build Landing Page — assembles the master Stitch prompt, sends to Stitch API,
// gets back the designed HTML, stores everything for preview + iteration.
//
// Process:
// 1. Gather copy + business info from database
// 2. Assemble the master prompt (brand extraction + global rules + page purpose + template spec + copy + final instructions)
// 3. Send assembled prompt to Stitch API with the client's website URL
// 4. Stitch returns the designed HTML
// 5. Store HTML + prompt + metadata in landing_pages table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import { generateWithStitch } from '../_shared/stitch-client.ts'

// ============================================================
// PART 2: GLOBAL DESIGN RULES (static constant)
// ============================================================

const GLOBAL_DESIGN_RULES = `Apply the following design rules to every section of this page without exception.

SOFT GRADIENTS -- REQUIRED EVERYWHERE

Every background surface uses a soft gradient. No flat solid fills anywhere on this page.

Light sections: linear-gradient(135deg, #ffffff 0%, [extracted primary at 5% opacity] 100%). The gradient must be barely perceptible -- if you can clearly see where one color ends and another begins, reduce the opacity further.

Hero section: radial-gradient centered -- white or extracted light background at center, faint extracted primary tint at edges (4% opacity max).

Card backgrounds: linear-gradient(180deg, white 0%, [extracted primary at 3% opacity] 100%). Adds warmth without competing with content.

Dark sections (reviews, final CTA): gradient between two shades of the same extracted dark color -- never flat. Shift 5-8% lighter toward the bottom, or vary hue very slightly.

CTA buttons: linear-gradient(180deg, [base CTA color] 0%, [CTA color darkened 8%] 100%). Adds depth and makes buttons feel tactile.

All gradients stay within the brand's own color family. No multi-color transitions. No rainbow gradients. Subtle depth only.

DESIGN ACCENTS -- REQUIRED EVERYWHERE

Apply small decorative details throughout. These are background texture -- they never compete with copy or CTAs.

Hero background: 2-3 soft floating shapes (blurred circles or organic blobs, 6-8% opacity, extracted primary color, filter: blur(50px), positioned asymmetrically behind all content).

Section transitions: 48px gradient overlap between adjacent sections so backgrounds softly bleed into each other instead of hard cuts.

Category and feature cards: very faint diagonal line pattern or dot grid at 3-4% opacity, top-right corner of each card. Subtle texture only.

Benefit cards: small 2px corner bracket in extracted accent color, top-left corner. Refined crafted detail.

Result and stat figures: soft radial glow behind each large number (extracted primary at 8% opacity, 80px diameter, blurred). Makes numbers feel alive.

Dark sections: one large soft blurred circle (extracted primary at 12-15% opacity, 500px diameter, filter: blur(80px)) offset to one corner. Adds depth without clutter.

Section headlines: small 2px accent line (extracted accent color, 40px wide) centered above each section headline. Spacing: 12px gap between line and text.

Accent opacity ceiling: nothing above 15% for background decorative elements. If in doubt, reduce further.

MOBILE-FIRST RESPONSIVE

Build mobile-first. Default CSS targets 320px+ screens. Apply tablet styles at min-width: 768px. Apply desktop styles at min-width: 1024px.

MOBILE (default, below 768px):
- Section padding: 56px top/bottom, 20px left/right. Nothing bleeds to edge.
- Hero headline: 32px, font-weight 800, line-height 1.15, text-align center
- Section headlines: 26px, font-weight 700, text-align center
- Body copy: 15px, line-height 1.65
- Captions: 13px. Minimum font size anywhere: 12px
- All buttons: width 100% (full width), height 52px, font-size 16px, font-weight 700
- All interactive elements: minimum 44px touch target height
- All grids: collapse to 1 column except category cards and results (2 columns OK if labels are short)
- Testimonials: always 1 column
- Images and video: width 100%, border-radius 12px
- Hero illustration/image: shown below text, full width
- No horizontal scrolling at any viewport width
- Horizontal pill navigation: overflow-x auto, allow scroll

TABLET (768px and above):
- Section padding: 72px top/bottom, 40px left/right
- Hero headline: 42px
- Section headlines: 30px
- Buttons: auto width, min-width 180px, not full width
- Grids: 3 columns for categories, 3 for benefits, 3 for testimonials, 4 for results

DESKTOP (1024px and above):
- Section padding: 88px top/bottom, content max-width 1100px centered
- Hero headline: per template spec
- All grids: per template spec
- Sticky header active

IMAGE AND VIDEO PLACEHOLDERS

When a slot value is a URL: use it as the image or video source.

When a slot value is [PLACEHOLDER]: build a styled placeholder using brand colors. Image placeholder: rounded rectangle, soft gradient using extracted primary and accent colors at low opacity, with a subtle geometric pattern overlay -- not a gray box. Video placeholder: 16:9 container, dark gradient using brand colors, centered play button circle (56px, white bg, brand-colored triangle, slight shadow), small "Video" label in muted white. Border-radius 12px. Hero illustration placeholder: abstract illustration using brand colors -- geometric shapes, floating elements. Intentionally illustrated, not empty.

HARD RULES -- NON-NEGOTIABLE

1. Extract brand from the client website URL. Never guess or use generic defaults.
2. Hero background matches what was extracted from the client site. Do not override with dark/gradient unless the client site itself uses it.
3. All copy slots are plain strings. Never render [object Object].
4. No navigation links in header. Logo + one CTA button only.
5. All CTA buttons use the extracted CTA/accent color. Consistent throughout.
6. Build exactly the sections in the template spec. No additions. No omissions.
7. Fully responsive at 320px, 768px, and 1024px. Zero horizontal scroll.
8. Minimum 44px touch targets on all interactive elements.
9. Do not default to Inter, Roboto, or Arial. Use fonts extracted from the client site or a distinctive Google Fonts alternative.
10. Image/video slots containing [PLACEHOLDER] receive styled brand-colored placeholders. Never gray boxes.`

// ============================================================
// TEMPLATE-SPECIFIC LAYOUT SPECS (Part 4)
// Each template's exact section-by-section spec with {{slot_id}} placeholders
// ============================================================

const TEMPLATE_SPECS: Record<string, string> = {

template_1: `TEMPLATE: Conditional Funnel / Quiz-Led
CONVERSION GOAL: The quiz widget IS the hero. Everything on the page serves it. Visitor self-qualifies through 2 steps before seeing a contact form. By the time they reach the form they've committed mentally. Short page -- funnel above the fold, social proof below.

---

PAGE STRUCTURE -- BUILD EXACTLY THESE 4 SECTIONS:

SECTION 1 -- HEADER: Logo only, left-aligned. No navigation. Height 56px desktop, 52px mobile. Transparent or matches hero background. Not sticky.

SECTION 2 -- HERO + QUIZ WIDGET:
Desktop: two-column, left 48% / right 52%. Vertical padding 88px.
Mobile: single column centered. Vertical padding 56px.

Left column (desktop) / top block (mobile):
- Headline: {{t1_headline}} -- Desktop 52px / Mobile 30px. Font-weight 800. Line-height 1.1. Centered on mobile.
- Subheadline: {{t1_subheadline}} -- Desktop 18px / Mobile 15px. Muted color. Margin-top 12px. Centered on mobile.

Quiz widget card (right column desktop, below text mobile):
Style: white background, border-radius 14px, box-shadow 0 8px 40px rgba(0,0,0,0.12), padding 32px desktop / 20px mobile. Full-width on mobile.

Inside the widget -- Step 1 (default state):
- Step indicator: "Step 1 of 3" -- 11px, muted, top-right of widget
- Question label: {{t1_q1_prompt}} -- 16px bold, margin-bottom 16px
- Answer tiles: CSS grid, 2 columns desktop / 1 column mobile. Each tile: min-height 56px desktop / 52px mobile, border 1.5px solid light color, border-radius 10px, padding 12px 16px, cursor pointer, font-size 14-15px. Hover: border-color changes to extracted CTA color, background tint at 5% opacity, transition 150ms.
- Options: {{t1_q1_options}}
- Clicking any tile triggers Step 2 -- no submit button

Inside the widget -- Step 2 (after tile click):
- CSS slide or fade transition, 220ms ease
- Step indicator updates to "Step 2 of 3"
- Question: {{t1_q2_prompt}}
- Same tile format. Options: {{t1_q2_options}}
- Back text link bottom-left, 13px muted

Inside the widget -- Step 3 form (after Step 2 tile click):
- Step indicator: "Step 3 of 3"
- 2 input fields: First Name + Phone (or Email). Full width, height 48px, border 1.5px, border-radius 8px.
- CTA button: {{t1_cta}} -- full width, height 56px, extracted CTA color, white text, font-weight 700.
- Trust line: {{t1_trust_line}} -- 12-13px centered muted text below button

SECTION 3 -- SOCIAL PROOF WALL:
Contrasting background (extracted dark or secondary brand color). Padding 80px desktop / 56px mobile.
Rating block centered: {{t1_proof_rating}} -- large star icons (gold), rating number 40px bold, count + platform 16px muted.
Testimonial cards: 3 columns desktop / 1 column mobile. Gap 20px. Each card: white background, border-radius 12px, padding 24px, box-shadow subtle. Structure: 5 gold stars, quote text, reviewer name bold, date muted.
Cards: {{t1_testimonials}}
Trust badge strip: horizontal row desktop / 2-per-row wrap mobile. Muted/grayscale styling.
Badges: {{t1_trust_badges}}

SECTION 4 -- FOOTER: Dark background. Single row: logo left, disclaimer center (11px muted), privacy link right.
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
CONVERSION GOAL: Hero establishes authority and outcome. Category cards below the fold segment the visitor by their exact situation -- this is the conversion hinge. Seeing their problem named makes them stay. Benefits, proof, results, and final CTA close the argument.

---

PAGE STRUCTURE -- BUILD EXACTLY THESE 7 SECTIONS:

SECTION 1 -- HEADER: Sticky. Height 68px desktop / 56px mobile. Logo left. Right: phone number (bold, extracted CTA color, phone icon) OR CTA button. Shadow appears on scroll via JS scroll listener.

SECTION 2 -- HERO:
Desktop: split -- text left 55% / image right 45%. Min-height 500px. Padding 88px vertical.
Mobile: single column centered. Padding 56px top / 48px bottom.

Pre-headline: {{t2_pre_headline}} -- 12px all-caps desktop / 11px mobile, letter-spacing 0.12em, accent color. Centered on mobile.
Headline: {{t2_headline}} -- 56px desktop / 32px mobile, font-weight 800, line-height 1.1. Centered on mobile.
Subheadline: {{t2_subheadline}} -- 19px desktop / 16px mobile, muted. Margin-top 16px. Centered on mobile.
CTA: {{t2_hero_cta}} -- 56px height desktop / full-width 52px mobile. Extracted CTA color. Margin-top 28px.
Trust trio: {{t2_trust_trio}} -- 3 items, checkmark icon + text. Horizontal desktop / stacked vertical mobile. 14px desktop / 13px mobile.
Right image (desktop only): rounded card, brand-colored placeholder.

SECTION 3 -- CATEGORY SEGMENTATION:
Background: extracted light section color. Padding 80px desktop / 56px mobile.
Section headline: {{t2_category_headline}} -- 32px desktop / 26px mobile, bold, centered.
Card grid: 3 columns desktop / 2 columns mobile. Gap 16px desktop / 12px mobile.
Each card: white bg, border 1.5px light, border-radius 14px. Desktop: padding 28px 24px, min-height 110px. Mobile: padding 18px 14px.
Content: emoji icon (36px desktop / 28px mobile) + label (17px desktop / 15px mobile, bold) + description (13px desktop / 12px mobile, muted).
Hover (desktop): border-color extracted CTA color, box-shadow 0 4px 20px rgba(0,0,0,0.10), translateY(-2px), 200ms.
Cards: {{t2_categories}}

SECTION 4 -- CORE BENEFITS:
White background. Padding 80px desktop / 56px mobile.
Section headline: {{t2_benefits_headline}} -- 32px desktop / 26px mobile, centered.
Grid: 3 columns desktop / 1 column mobile. Gap 24px.
Each card: 4px top border (extracted accent color), padding 32px desktop / 24px mobile. Icon (44px desktop / 40px mobile) + headline (20px desktop / 18px mobile, bold) + explanation (15px desktop / 14px mobile, muted, line-height 1.65).
Cards: {{t2_benefits}}

SECTION 5 -- SOCIAL PROOF:
Dark background (extracted dark brand color). Padding 80px desktop / 56px mobile.
Rating: {{t2_proof_rating}} -- stars gold, number 42px bold white, count + platform 16px white muted.
Cards: {{t2_testimonials}} -- 3 columns desktop / 1 column mobile. White cards with shadow. Structure each card: gold stars, quote (15px), name bold (14px), descriptor muted (13px).

SECTION 6 -- RESULTS:
White background. Padding 80px desktop / 56px mobile.
Section headline: {{t2_results_headline}} -- 30px desktop / 24px mobile, centered.
Grid: match number of results for columns desktop / 2 columns mobile.
Each card: 4px top border (extracted primary color), centered content. Figure: 42px desktop / 32px mobile, font-weight 800, extracted primary color. Label: 14px desktop / 13px mobile, muted.
Results: {{t2_results}}

SECTION 7 -- FINAL CTA:
Extracted primary color background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t2_final_headline}} -- 36px desktop / 28px mobile, white, font-weight 800.
CTA button: {{t2_final_cta}} -- full width mobile / auto desktop. Extracted CTA color.
Phone: {{t2_phone_cta}} -- if provided, 18px white, phone icon, below button.

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

PAGE STRUCTURE -- BUILD EXACTLY THESE 7 SECTIONS:

SECTION 1 -- HEADER: Sticky. 68px desktop / 56px mobile. Logo left. Nav links (desktop only, hidden mobile). CTA button right.

SECTION 2 -- HERO (two-column desktop, single-column mobile):
Desktop: left 58% content / right 42% form card. Padding 80px vertical.
Mobile: stacked. Content above, form card below. Padding 56px.

Left/top content:
Headline: {{t3_headline}} -- 52px desktop / 32px mobile, font-weight 800.
Subheadline: {{t3_subheadline}} -- 18px desktop / 16px mobile, muted, line-height 1.6. Margin-top 16px.
Feature bullets: {{t3_feature_bullets}} -- checkmark icon (extracted accent) + text. Desktop 15-16px / Mobile 14px. Line-height 2.

Form card (desktop right / mobile below content):
White card, border-radius 16px, box-shadow 0 8px 40px rgba(0,0,0,0.12), padding 32px desktop / 24px mobile.
Form headline: {{t3_form_headline}} -- 18-20px bold.
2-3 fields: full width, height 48px desktop / 44px mobile.
CTA: {{t3_form_cta}} -- full width, 52px. Extracted CTA color.
Secondary: {{t3_secondary_cta}} -- text link below button, 14px, extracted primary color.

SECTION 3 -- LOGO BAR:
Light background. Padding 32px vertical. Label: {{t3_logo_bar_label}} -- 14px centered muted. Logos: horizontal flex desktop / overflow-x scroll mobile. Grayscale 55% opacity.

SECTION 4 -- USE CASE TABS:
Light gray background. Padding 80px desktop / 56px mobile.
Headline: {{t3_tab_headline}} -- 34px desktop / 26px mobile, centered.
Subheadline: {{t3_tab_subheadline}} -- 17px muted, centered.
Pill row: horizontal flex desktop / overflow-x scroll mobile. Active pill: extracted primary color filled. Inactive: outlined muted. Height 40px.
Content panel: fades on tab change (opacity transition 200ms). Desktop: left 58% text / right 42% screenshot. Mobile: text above / screenshot below.
Tabs: {{t3_tabs}}

SECTION 5 -- FEATURES GRID:
White background. Padding 80px desktop / 56px mobile.
Headline: {{t3_features_headline}} -- 32px desktop / 26px mobile, centered.
Grid: 3 columns desktop / 1 column mobile. Gap 24px.
Each card: padding 28-32px. Icon (40-44px, extracted primary) + name (17-18px bold) + description (14-15px muted, line-height 1.65).
Features: {{t3_features}}

SECTION 6 -- SOCIAL PROOF:
White or very light background. Padding 80px desktop / 56px mobile.
Rating badges: {{t3_proof_ratings}} -- row desktop / stacked mobile.
Testimonials: {{t3_testimonials}} -- 2-3 columns desktop / 1 column mobile.

SECTION 7 -- FINAL CTA:
Extracted primary or dark background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t3_final_headline}} -- 34px desktop / 26px mobile, white.
Buttons: {{t3_final_cta}} + {{t3_final_secondary_cta}} -- side by side desktop / stacked mobile.

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

PAGE STRUCTURE -- BUILD EXACTLY THESE SECTIONS:

SECTION 1 -- HEADER: Sticky. Logo left / CTA right. Minimal.

SECTION 2 -- HERO:
Centered. Padding 88px desktop / 56px mobile. Bold, energetic background.
Headline: {{t4_headline}} -- 60px desktop / 38px mobile, font-weight 900, line-height 1.05.
Subheadline: {{t4_subheadline}} -- 18px desktop / 15px mobile, muted. Margin-top 14px.
CTA pair: {{t4_primary_cta}} + {{t4_secondary_cta}} -- side by side desktop / stacked mobile.
Stats bar: {{t4_stats}} -- 3 stats, large number + label. Horizontal row desktop / stacked mobile. JS count-up animation on page load (1.5s, ease-out).
Logo bar: {{t4_logo_bar_label}} + logos row. Grayscale. Horizontal scroll on mobile.

SECTION 3 -- USE CASE NAVIGATION:
Light background strip. Padding 16px vertical. Pills: {{t4_use_case_tabs}} -- horizontal row desktop / overflow-x scroll mobile. Becomes sticky after hero scrolls out (JS IntersectionObserver).

SECTIONS 4-N -- SHOWCASE BLOCKS (build one per item in t4_showcase_blocks):
Each block: full width. Padding 88px desktop / 56px mobile. Backgrounds alternate: white and extracted light section tint.
Desktop layout alternates: ODD = text left 44% / visual right 56%. EVEN = visual left 56% / text right 44%.
Mobile: always text above / visual below. Single column.
Each block has anchor ID matching its use case tab.
Text side: Badge + headline + description + CTA button.
Visual side: 16:9 rounded card with brand-colored placeholder.
Scroll animation: IntersectionObserver fade-in (opacity 0 to 1, translateY 32px to 0, 400ms ease).
Blocks: {{t4_showcase_blocks}}

SECTION N+1 -- CAPABILITY SUMMARY:
White background. Padding 80px desktop / 56px mobile.
Headline: {{t4_capability_headline}} -- 32px desktop / 26px mobile, centered.
Cards: {{t4_capability_cards}} -- 3-4 columns desktop / 1 column mobile.

SECTION N+2 -- FINAL CTA:
Extracted primary color or gradient background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t4_final_headline}} -- 36px desktop / 28px mobile, white.
CTAs: {{t4_final_cta}} + {{t4_final_secondary_cta}} -- side by side desktop / stacked full-width mobile.

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

PAGE STRUCTURE -- BUILD EXACTLY THESE 5 SECTIONS:

SECTION 1 -- HEADER: Minimal. Logo left. Single CTA right. No nav. Sticky. 60px desktop / 56px mobile.

SECTION 2 -- HERO:
Strong background (extracted). Centered. Max-width 760px content column. Padding 80px desktop / 56px mobile.
Headline: {{t5_headline}} -- 48px desktop / 32px mobile, font-weight 800, centered.
Subheadline: {{t5_subheadline}} -- 18px desktop / 15px mobile, muted 75%, centered. Margin-top 14px.
Video: {{t5_video_url}} -- max-width 700px desktop / full-width mobile. 16:9 ratio. If URL: iframe embed, border-radius 12px, box-shadow. If [PLACEHOLDER]: styled video placeholder per global rules.
CTA: {{t5_primary_cta}} -- centered below video. 56px desktop / full-width 52px mobile. Extracted CTA color.

SECTION 3 -- WHO IT'S FOR:
Contrasting background. Padding 64px desktop / 52px mobile.
Headline: {{t5_who_headline}} -- 28px desktop / 22px mobile, centered.
Bullets: {{t5_who_bullets}} -- centered column, max-width 560px. Each: checkmark circle (extracted primary) + text 16px / 15px mobile.

SECTION 4 -- TESTIMONIAL WALL:
Light background. Padding 80px desktop / 56px mobile.
Headline: {{t5_testimonials_headline}} -- 28px desktop / 22px mobile, centered. Margin-bottom 36px.
Grid: 3-4 columns desktop / 1-2 columns mobile. Gap 18px. Render ALL cards -- minimum 8.
Each card: white bg, border 1px light, border-radius 12px, padding 20-24px, subtle shadow. Photo: 48px circle placeholder + name bold 14px + role muted 12-13px. Stars: 5 gold, 14px. Quote: 14-15px, line-height 1.7. Full text, not truncated.
Cards: {{t5_testimonials}}
Video testimonials (only if slot populated): {{t5_video_testimonials}} -- horizontal row desktop / overflow-x scroll mobile.

SECTION 5 -- FINAL CTA:
Extracted primary color background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t5_final_headline}} -- 36px desktop / 26px mobile, white, font-weight 800.
CTA: {{t5_final_cta}} -- centered, 56px desktop / full-width 52px mobile.

FOOTER: Minimal dark. Logo + disclaimer + privacy + copyright.

---

INTERACTIONS:
- Video: if URL present, embed with autoplay=0. If placeholder, show styled placeholder.
- No scroll animations. Fast, clean.
- All touch targets 44px+ mobile.`,

template_6: `TEMPLATE: VSL / Long-Form Direct Response
CONVERSION GOAL: Take a cold skeptical visitor through a complete argument. Every section earns the scroll to the next. No nav. No distractions. Reading copy is the design. Long page = seriousness to this audience.

---

PAGE STRUCTURE -- BUILD EXACTLY THESE 8 SECTIONS:

SECTION 1 -- HEADER: Logo ONLY. No nav. No CTA. No phone. Not sticky.

SECTION 2 -- VSL HERO:
Centered column, max-width 760px, margin 0 auto. Padding 80px desktop / 56px mobile.
Pre-headline: {{t6_pre_headline}} -- 13px, accent color, bold, centered.
Headline: {{t6_headline}} -- 44px desktop / 30px mobile, font-weight 800, centered, line-height 1.2.
Video: {{t6_video_url}} -- max-width 680px, centered. 16:9. Border-radius 8px. Shadow.
CTA: {{t6_hero_cta}} -- centered, 56px desktop / full-width 52px mobile.

SECTION 3 -- PROBLEM:
Centered column, max-width 680px. Padding 64px desktop / 52px mobile. White background.
Copy: {{t6_problem_copy}} -- 17-18px desktop / 16px mobile, line-height 1.8. Flowing prose, no bullets. First phrase of each paragraph bold for rhythm.

SECTION 4 -- SOLUTION + MECHANISM:
Centered column, max-width 680px. Padding 64px desktop / 52px mobile. Light gray background.
Copy: {{t6_solution_copy}} -- same body treatment.

SECTION 5 -- OFFER STACK:
Full width. Deep dark background. Padding 80px desktop / 56px mobile.
Headline: "Here's Everything You Get" -- 28px desktop / 22px mobile, white, centered.
Items: {{t6_offer_items}} -- max-width 680px centered. Each: flex row. Left: numbered badge (40px, extracted accent, white number). Right: name bold white + description white muted. Divider between items.

SECTION 6 -- PROOF:
Centered column, max-width 760px. Padding 80px desktop / 56px mobile. White background.
Items: {{t6_proof_items}} -- card per item. Result figure: 32-40px bold, extracted primary. Photo placeholder 56px circle. Name + role. Story paragraph 15-16px.

SECTION 7 -- FAQ:
Centered column, max-width 680px. Padding 80px desktop / 56px mobile. Light background.
Headline: "You Might Be Wondering..." -- 24px desktop / 20px mobile, centered.
Accordion: {{t6_faq}} -- question row (click to toggle), chevron rotates 180deg, answer slides open (max-height transition 300ms). One open at a time.

SECTION 8 -- GUARANTEE:
Full width. Extracted accent at 10% opacity tint background. Padding 64px desktop / 52px mobile.
Centered max-width 600px. Shield icon centered above. "Our Guarantee" small caps label.
Copy: {{t6_guarantee}} -- 16px body, centered, line-height 1.7.

SECTION 9 -- FINAL CTA:
Dark background. Padding 80px desktop / 56px mobile. Centered max-width 680px.
Urgency callout: {{t6_urgency}} -- border-left 4px extracted accent, padding 16px, background accent 8% opacity, italic.
CTA: {{t6_final_cta}} -- centered, 60px height desktop / full-width 52px mobile. Maximum visual weight.

FOOTER: Minimal dark. Disclaimer + privacy + copyright.

---

INTERACTIONS:
- FAQ accordion: JS click handler, max-height transition 300ms, chevron CSS rotation
- One FAQ item open at a time
- No nav. No sticky elements.
- Reading experience is paramount -- generous line-height, appropriate font size`,

template_7: `TEMPLATE: Comparison / Challenger
CONVERSION GOAL: Position against the status quo. The comparison block is the emotional centerpiece -- old way must look and feel broken/painful, new way must look vivid and solving. Then benefits, switcher proof, CTA.

---

PAGE STRUCTURE -- BUILD EXACTLY THESE 6 SECTIONS:

SECTION 1 -- HEADER: Sticky. Logo left. CTA button right.

SECTION 2 -- HERO:
Full width. Centered. Padding 80px desktop / 56px mobile.
Headline: {{t7_headline}} -- 48px desktop / 32px mobile, font-weight 800. Must feel like a position, not a description.
Subheadline: {{t7_subheadline}} -- 18px desktop / 15px mobile, muted. Specific pain with status quo.
CTA: {{t7_hero_cta}} -- standard large button. Full width on mobile.

SECTION 3 -- COMPARISON BLOCK:
White background. Padding 80px desktop / 56px mobile. Centered max-width 900px.

DESKTOP: Two-column table. Column headers row:
Old: {{t7_comparison_label_old}} -- background #f0f0f0, text #666666, 18-20px bold, X prefix in #cc4444.
New: {{t7_comparison_label_new}} -- background extracted primary color, white text, 18-20px bold, checkmark prefix in white.
Rows: 3 cells each -- dimension (30%, bold 15px), old text (35%, muted gray, X prefix), new text (35%, extracted primary, checkmark prefix, font-weight 500).
Alternating row backgrounds. Border between rows. Wrap: border 1px #e0e0e0, border-radius 12px, overflow hidden.

MOBILE: Vertical stacking. Old column header + all old-column rows in a card (gray bg, muted styling). New column header + all new-column rows in a card below (extracted primary bg light tint, vivid styling).
Comparison data: {{t7_comparison_rows}}

SECTION 4 -- BENEFITS:
Light gray background. Padding 80px desktop / 56px mobile.
Headline: {{t7_benefits_headline}} -- 28-32px desktop / 24px mobile, centered.
Cards: {{t7_benefits}} -- 3-4 columns desktop / 1 column mobile.

SECTION 5 -- SOCIAL PROOF:
White background. Padding 80px desktop / 56px mobile.
Headline: {{t7_testimonials_headline}} -- 28px desktop / 22px mobile, centered.
Cards: {{t7_testimonials}} -- 3 columns desktop / 1 column mobile. Style transformation phrases in extracted accent color, italic.

SECTION 6 -- FINAL CTA:
Extracted primary background. Padding 80px desktop / 56px mobile. Centered.
Headline: {{t7_final_headline}} -- 34px desktop / 26px mobile, white.
CTA: {{t7_final_cta}} -- standard button. Full width mobile.

FOOTER: Standard dark.

---

INTERACTIONS:
- Sticky header with scroll shadow
- All touch targets 44px+ mobile
- No scroll animations`,

template_8: `TEMPLATE: Urgency / Event-Driven
CONVERSION GOAL: The visitor already knows they have a problem. Show them why acting NOW matters, what happens if they wait, how easy the action is, and why this business is credible. Urgency must feel real -- not manufactured spam. Controlled alarm. Short, direct, no fluff.

---

PAGE STRUCTURE -- BUILD EXACTLY THESE 6 SECTIONS:

SECTION 1 -- HEADER: Sticky. 68px desktop / 56px mobile. Logo left. Right: phone number (large, bold, extracted CTA color, phone icon, tel: link) + CTA button. No nav links. Shadow on scroll. Mobile: phone number as icon-only or small, CTA button right.

SECTION 2 -- URGENCY HERO:
Strong background -- use extracted primary color as background, or a dark/high-contrast variant. This must feel IMMEDIATE. Do not use plain white for this template's hero. Padding 80px desktop / 56px mobile. All content centered.

Pre-headline: {{t8_pre_headline}} -- alert badge: inline-flex, extracted accent bg (or amber #F59E0B), white text, 12-13px bold all-caps, border-radius 9999px, padding 6px 16px. Centered.
Headline: {{t8_headline}} -- 48px desktop / 30-34px mobile, font-weight 800, white/high-contrast, centered, line-height 1.15.
Subheadline: {{t8_subheadline}} -- 18px desktop / 15px mobile, white 80%, centered.
CTA button: {{t8_hero_cta}} -- 56px height desktop / full-width 52px mobile. Maximum contrast against hero background. Hover: scale 1.03 + glow (box-shadow 0 0 24px CTA-color-at-60%).
Urgency element: {{t8_urgency_element}} -- below CTA, margin-top 18px. Calendar or clock emoji + text, 14px white 65%, centered, italic.

SECTION 3 -- RISK BLOCK:
White background. Padding 80px desktop / 56px mobile.
Section headline: {{t8_risk_headline}} -- 28-32px desktop / 24px mobile, centered, bold.
Items: {{t8_risks}} -- max-width 680px centered. Each item: flex row. Left: warning icon (28-32px, amber). Right: bold statement (16-18px desktop / 15px mobile, font-weight 700) + explanation (14-15px desktop / 13px mobile, muted).

SECTION 4 -- HOW IT WORKS:
Extracted light section background. Padding 80px desktop / 56px mobile.
Section headline: "Here's How It Works" -- 24-28px desktop / 22px mobile, centered.
3-step process: Desktop: flex row, 3 equal columns. Mobile: flex column, stacked.
Each step: number circle (52px desktop / 44px mobile, extracted primary bg, white bold number) then step name then description.
Desktop connector: dashed horizontal line between circle centers.
Steps: {{t8_steps}}

SECTION 5 -- PROOF / TRUST:
White background. Padding 64-80px desktop / 52px mobile.
Trust badges: horizontal flex row desktop / 2-per-row wrap mobile.
Testimonials: 2-3 columns desktop / 1 column mobile.
Items: {{t8_proof_items}}

SECTION 6 -- FINAL CTA:
Dark background. Padding 80px desktop / 56px mobile. Centered.
Urgency restatement: {{t8_final_urgency}} -- italic, white 65%, 15-16px, centered.
CTA button: {{t8_final_cta}} -- centered, 60px height desktop / full-width 52px mobile. Maximum contrast. Hover glow.
Phone: {{t8_phone_cta}} -- if provided, 18-20px white bold, phone icon, tel: link, centered below button.

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
// COPY SLOT SERIALIZATION (from master prompt spec)
// ============================================================

function serializeCopySlots(slots: Record<string, unknown>): string {
  return Object.entries(slots).map(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return `${key}: [MISSING - DO NOT RENDER]`
    }
    if (typeof value === 'string') {
      return `${key}: ${value}`
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${key}: [MISSING - DO NOT RENDER]`
      }
      if (typeof value[0] === 'string') {
        return `${key}: ${value.join(' | ')}`
      }
      if (typeof value[0] === 'object') {
        const formatted = value.map((item: Record<string, unknown>) => {
          if (item.label && item.description) return `${item.label}: ${item.description}`
          if (item.question && item.answer) return `Q: ${item.question} | A: ${item.answer}`
          if (item.name && item.result) return `${item.name}: ${item.result}`
          if (item.step && item.label && item.description) return `Step ${item.step} - ${item.label}: ${item.description}`
          if (item.quote && item.name) return `"${item.quote}" -- ${item.name}${item.descriptor ? ', ' + item.descriptor : ''}`
          return Object.values(item).filter(v => v).join(': ')
        }).join(' | ')
        return `${key}: ${formatted}`
      }
    }
    if (typeof value === 'object') {
      return `${key}: ${Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${v}`).join(', ')}`
    }
    return `${key}: ${String(value)}`
  }).join('\n')
}

// ============================================================
// MASTER PROMPT ASSEMBLY (from master prompt spec)
// ============================================================

function assembleStitchPrompt({
  clientName,
  clientWebsiteUrl,
  clientBrandReferenceUrl,
  avatarName,
  avatarDescription,
  offerName,
  offerDescription,
  offerPrimaryCta,
  offerConversionType,
  templateSpec,
  copySlots,
}: {
  clientName: string
  clientWebsiteUrl: string
  clientBrandReferenceUrl?: string
  avatarName: string
  avatarDescription: string
  offerName: string
  offerDescription: string
  offerPrimaryCta: string
  offerConversionType: string
  templateSpec: string
  copySlots: Record<string, unknown>
}): string {

  const part1 = `Before designing anything, visit ${clientWebsiteUrl} and extract the complete design system from that site. Pull the exact colors, typography, button styles, spacing rhythm, card styles, border radius values, shadow styles, and overall visual tone directly from what you observe on that page.

Do not guess. Do not use generic defaults. Do not use colors that are not present on ${clientWebsiteUrl}. Use only what is actually there.

Also visit ${clientWebsiteUrl} and pull any real customer testimonials, proof statistics, star ratings, or social proof figures present on the site. Use these in the social proof section of the page.

${clientBrandReferenceUrl ? `Additionally visit ${clientBrandReferenceUrl} to supplement your understanding of the brand's visual identity.` : ''}

The client's website IS the brand kit. Build this landing page so it feels like a natural, polished extension of ${clientWebsiteUrl} -- same color family, same typographic personality, same visual weight and spacing rhythm.`.trim()

  const part2 = GLOBAL_DESIGN_RULES

  const part3 = `This is a high-converting landing page for ${clientName}.

Target audience: ${avatarName} -- ${avatarDescription}
Offer: ${offerName} -- ${offerDescription}
Primary conversion action: ${offerPrimaryCta}
Conversion type: ${offerConversionType}

The page must feel like it belongs on ${clientWebsiteUrl} -- same visual family -- while being specifically crafted for ${avatarName} and the ${offerName} offer.`.trim()

  const part4 = templateSpec

  const part5 = `Use the following copy exactly as provided. Do not rewrite, paraphrase, or improve any copy. Insert each value into the corresponding location specified in the template layout above.

${serializeCopySlots(copySlots)}`.trim()

  const part6 = `Build this page now.

Produce complete, self-contained, production-ready code.

Output format: HTML file with all CSS and JavaScript inline. No external dependencies except Google Fonts and any icon library via CDN.

The page must render correctly at 320px, 768px, and 1024px. Zero horizontal scroll. All interactive elements working. Brand colors from ${clientWebsiteUrl}. Premium crafted feel -- not AI-generated template.

Do not add placeholder text, lorem ipsum, or generic filler. Every section must contain the exact copy provided above.`.trim()

  return [part1, part2, part3, part4, part5, part6].join('\n\n---\n\n')
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

    // Validate required inputs
    if (!client_id || !avatar_id || !offer_id || !template_id || !copy_slots) {
      return errorResponse('client_id, avatar_id, offer_id, template_id, and copy_slots are required')
    }

    const templateSpec = TEMPLATE_SPECS[template_id]
    if (!templateSpec) {
      return errorResponse(`Invalid template_id: ${template_id}. Must be template_1 through template_8.`)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client, avatar, and offer data in parallel
    const [clientResult, avatarResult, offerResult] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('avatars').select('*').eq('id', avatar_id).single(),
      supabase.from('offers').select('*').eq('id', offer_id).single(),
    ])

    if (clientResult.error || !clientResult.data) {
      return errorResponse(`Client not found: ${clientResult.error?.message || 'No data'}`)
    }
    if (avatarResult.error || !avatarResult.data) {
      return errorResponse(`Avatar not found: ${avatarResult.error?.message || 'No data'}`)
    }
    if (offerResult.error || !offerResult.data) {
      return errorResponse(`Offer not found: ${offerResult.error?.message || 'No data'}`)
    }

    const client = clientResult.data
    const avatar = avatarResult.data
    const offer = offerResult.data

    // Validate client website URL
    const clientWebsiteUrl = client.website
    if (!clientWebsiteUrl) {
      return errorResponse('Client website URL is required for brand extraction. Add it in Business Overview.')
    }

    // Assemble the complete master prompt
    const fullPrompt = assembleStitchPrompt({
      clientName: client.name,
      clientWebsiteUrl,
      clientBrandReferenceUrl: client.brand_reference_url || undefined,
      avatarName: avatar.name,
      avatarDescription: avatar.description || '',
      offerName: offer.name,
      offerDescription: offer.description || '',
      offerPrimaryCta: offer.primary_cta || offer.name,
      offerConversionType: offer.conversion_type || 'lead',
      templateSpec,
      copySlots: copy_slots,
    })

    // Send to Stitch API
    const stitchResult = await generateWithStitch(fullPrompt, {
      title: `${client.name} - Landing Page`,
      device: 'DESKTOP',
    })

    // Clean up HTML (strip any markdown fences just in case)
    let cleanHtml = stitchResult.html.trim()
    if (cleanHtml.startsWith('```')) {
      cleanHtml = cleanHtml.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    // Extract headline for the record
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
        stitch_preview_url: stitchResult.imageUrl,
        stitch_job_id: stitchResult.screenId,
        headline,
        brand_kit_snapshot: client.brand_kit || {},
        deploy_status: 'draft',
        status: 'approved',
        iteration_history: [{
          iteration: 0,
          prompt_sent: fullPrompt,
          change_request: 'Initial build',
          preview_url: stitchResult.imageUrl,
          output_code: cleanHtml,
          timestamp: new Date().toISOString(),
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
