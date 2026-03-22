# Logical Boost Hub — Unified System Spec

**Version:** 1.1  
**Purpose:** Single source of truth for building the Logical Boost Hub. All previous notes, iterations, and conflicting specs are superseded by this document.

---

# SYSTEM OVERVIEW

The **Logical Boost Hub** is a multi-tenant marketing platform where the Logical Boost agency team builds, manages, and executes full campaign systems for clients — and where clients log in to view their assets, stats, and creative deliverables.

The core pipeline is:

**Avatar → Offer → Angle → Copy Components → Ad Variations / Creatives / Scripts / Landing Pages**

The platform serves three user types:

- **Admins (agency owners)** — full access to all clients, team management, all features
- **Team Members** — access to assigned clients only, with either Editor or Viewer permissions
- **Clients** — access to their own Hub only, can view all pages and deny items they don't like

---

# TERMINOLOGY (CANONICAL)

These terms are locked. Use them consistently everywhere.

| Internal Term | Client-Facing Label | Definition |
|---|---|---|
| avatar | Avatar | A distinct customer segment / audience profile |
| offer | Offer | The conversion proposition (e.g., Free Roof Inspection) |
| angle | Angle | The psychological messaging approach (from the 15-angle framework) |
| copy_component | (not shown to client) | An atomic building block of messaging (headline, benefit, proof, etc.) |
| funnel | Funnel | The page showing all assets for a specific Avatar + Offer + Angle combo |
| creative | Creative | A visual ad concept assembled from copy components |
| landing_page | Landing Page | A generated page built from copy components and offer data |

**Never show in client UI:** copy_component, angle IDs, database fields, metadata, raw IDs.

**Client-facing labels for angles:** Use plain English names (e.g., "Fear & Risk," "How It Works," "Social Proof") mapped from the canonical angle slugs.

---

# USERS, AUTH & PERMISSIONS

The Hub is a multi-tenant platform. Every user logs in and sees a tailored experience based on their role.

---

## User Roles

### Admin
- Sees ALL clients via a client switcher dropdown in the header
- Full access to every page and every action (create, edit, generate, deny, delete)
- Can manage team members: invite, assign to clients, set permission levels
- Can manage client accounts: create, archive, configure

### Team Member — Editor
- Sees only clients they are assigned to (client switcher shows only their clients)
- Can create, edit, generate, deny, delete on all pages for assigned clients
- Cannot manage other team members or create new client accounts

### Team Member — Viewer
- Sees only clients they are assigned to
- Read-only access on all pages — no edit, generate, deny, or delete buttons shown
- Use case: team members reviewing creative work, account coordinators, etc.

### Client
- Sees only their own Hub — no client switcher, no awareness of other clients
- Can view ALL pages: Dashboard, Funnel, Business Overview, Intake, Avatars, Offers, Competitor Ads, Stats
- Can **deny** items (copy components, creatives, landing pages) with confirmation dialog
- Cannot edit, create, generate, or delete anything
- Sees a dedicated **Dashboard** page as their landing page (placeholder for V1)

---

## UI Behavior by Role

| Feature | Admin | Editor | Viewer | Client |
|---|---|---|---|---|
| Client switcher dropdown | All clients | Assigned only | Assigned only | Hidden (single client) |
| View all pages | Yes | Yes | Yes | Yes |
| Generate (AI actions) | Yes | Yes | No | No |
| + Add (manual) | Yes | Yes | No | No |
| Edit items | Yes | Yes | No | No |
| Deny items | Yes | Yes | No | Yes |
| Delete items | Yes | Yes | No | No |
| Manage team members | Yes | No | No | No |
| Manage client accounts | Yes | No | No | No |

---

## Client Switcher (Admin & Team)

- Persistent dropdown in the top header/nav bar
- Shows list of accessible clients (all for admin, assigned for team members)
- Selecting a client loads that client's full Hub context
- All pages, data, and actions are scoped to the selected client

---

## Client Login Experience

- Client logs in and lands on their **Dashboard** page (placeholder in V1)
- Navigation shows all pages: Dashboard, Stats, Funnel, Business Overview, Intake, Avatars, Offers, Competitor Ads
- No "Generate" or "Add" buttons visible anywhere
- Deny buttons appear on individual items (copy, creatives, landing pages) with confirmation dialog
- The experience should feel like a polished client portal, not an internal tool

---

# THE 15 ANGLES (CANONICAL LIST)

These are controlled values. No additions, no renaming.

| Slug | Label (Client-Facing) | Definition |
|---|---|---|
| problem | Pain Point | Focus on a pain the audience is currently experiencing |
| outcome | Desired Result | Focus on the transformation or end result |
| fear | Fear & Risk | Focus on what the audience risks losing or doing wrong |
| opportunity | New Opportunity | Highlight a new advantage, trend, or method |
| curiosity | Curiosity Hook | Create intrigue or a pattern interrupt |
| proof | Social Proof | Show measurable results or case studies |
| authority | Authority & Trust | Establish expertise, scale, or credibility |
| mechanism | How It Works | Explain how the solution works (unique method/system) |
| speed | Fast Results | Emphasize quick results or rapid setup |
| cost | Cost Savings | Focus on saving money or improving efficiency |
| comparison | Us vs. Them | Contrast against current alternatives |
| identity | Audience Callout | Call out a specific audience segment directly |
| mistake | Common Mistakes | Highlight errors the audience is making |
| hidden_truth | Hidden Truth | Reveal something counterintuitive or unknown |
| before_after | Before & After | Show contrast between current state and improved state |

### Angle Selection Logic

When AI recommends angles for a given Avatar + Offer:

- If product/service is technical or unique → prioritize `mechanism`
- If audience is high intent / aware → use `problem` + `mechanism`
- If market is saturated → add `curiosity` or `hidden_truth`
- If trust is low → add `proof` or `authority`
- If targeting a specific segment → always include `identity`

AI recommends 3–5 angles per Avatar + Offer combination. The UI shows these as default options with a "See other options" expandable to reveal all 15.

### Angle Stacking

Every generated campaign unit uses:

- 1 primary angle (selected by user or recommended by AI)
- 1–2 secondary angles (AI selects based on context)

Preferred combinations:

- mechanism + problem + identity
- problem + fear
- curiosity + hidden_truth
- proof + mechanism
- outcome + before_after

---

# DATA MODEL

All tables below are the canonical schema. Platform-agnostic — implement in Xano, Supabase, Postgres, or whatever your stack requires.

---

## Table: `users`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| email | string | Login email, unique |
| name | string | Display name |
| role | string | `admin`, `team_editor`, `team_viewer`, `client` |
| client_id | UUID | Nullable. FK → clients. Only set for `client` role users (scopes them to one client) |
| status | string | `active`, `disabled` |
| created_at | timestamp | |
| updated_at | timestamp | |

**Notes:**
- Admin users have `client_id = null` (they access all clients via the switcher)
- Team members have `client_id = null` (they access assigned clients via `client_assignments`)
- Client users have `client_id` set to their company (they only ever see this one client)

---

## Table: `client_assignments`

Maps team members to the clients they can access.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → users (team_editor or team_viewer) |
| client_id | UUID | FK → clients |
| created_at | timestamp | |

**Notes:**
- Admins do not need rows here — they have implicit access to all clients
- Client-role users do not need rows here — they are scoped by `users.client_id`
- A team member can be assigned to multiple clients
- The client switcher dropdown queries this table to determine which clients a team member sees

---

## Table: `clients`

Each client has one workspace containing all their data.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | string | Company name |
| website | string | Primary website URL |
| business_summary | text | AI-generated or manually written overview |
| services | text | What the business offers |
| differentiators | text | What sets them apart |
| trust_signals | text | Credibility elements (awards, certifications, years in business) |
| tone | text | Brand voice description |
| ad_copy_rules | json | Structured rules — see Ad Copy Rules section below |
| ad_copy_notes | text | Freeform additional guidelines |
| competitors | json | Array of competitor objects (name, website, notes) |
| intake_status | string | `pending`, `completed` |
| created_at | timestamp | |
| updated_at | timestamp | |

### Ad Copy Rules (Structured Fields within `ad_copy_rules`)

```json
{
  "tone_descriptors": ["professional", "reassuring", "urgent"],
  "banned_words": ["cheap", "guarantee", "best"],
  "required_disclaimers": ["Licensed and insured", "Results may vary"],
  "platform_rules": {
    "google": { "headline_max_chars": 30, "description_max_chars": 90 },
    "meta": { "primary_text_max_chars": 125, "headline_max_chars": 40 },
    "youtube": {}
  },
  "brand_constraints": "Never use all caps. Always include company name in first headline.",
  "compliance_notes": "No income claims. No before/after photos without consent."
}
```

**CRITICAL RULE:** AI must reference `ad_copy_rules` and `ad_copy_notes` for EVERY generation task. These are not optional context — they are hard constraints.

---

## Table: `avatars`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| name | string | e.g., "Storm-Damage Homeowner" |
| avatar_type | string | e.g., homeowner, property_manager, commercial |
| description | text | Short summary of the audience |
| pain_points | text | What keeps them up at night |
| motivations | text | What they want to achieve |
| objections | text | Why they hesitate |
| desired_outcome | text | Their ideal end state |
| trigger_events | text | What causes them to seek the service |
| messaging_style | text | How to talk to them (reassuring, direct, etc.) |
| preferred_platforms | json array | e.g., ["meta", "google", "youtube"] |
| recommended_angles | json array | AI-suggested angle slugs for this avatar |
| status | string | `approved`, `denied` |
| created_at | timestamp | |
| updated_at | timestamp | |

**Status rules:**
- AI generates avatars as `approved` by default
- Team can deny (with confirmation dialog)
- Denied avatars are hidden from all selectors and generation workflows
- Deletion is allowed with confirmation dialog

---

## Table: `offers`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| name | string | e.g., "Free Roof Inspection" |
| offer_type | string | `lead_generation`, `appointment`, `purchase`, `trial`, `quote` |
| headline | string | Primary offer headline |
| subheadline | string | Supporting line |
| description | text | What the offer includes |
| primary_cta | string | e.g., "Schedule Free Inspection" |
| conversion_type | string | `lead_form`, `phone_call`, `booking`, `purchase` |
| benefits | json array | Array of benefit strings |
| proof_elements | json array | Array of proof/credibility strings |
| urgency_elements | json array | Array of urgency drivers |
| faq | json array | Array of {question, answer} objects |
| landing_page_type | string | `lead_capture`, `call_only`, `booking`, `product_page` |
| status | string | `approved`, `denied` |
| created_at | timestamp | |
| updated_at | timestamp | |

**Rules:**
- Offers come from client inputs, intake analysis, and business research
- AI can SUGGEST offers on the Offers page (including variations and industry ideas)
- Only `approved` offers are available in the Funnel page selector
- AI can NEVER invent or use an unapproved offer when generating copy

---

## Table: `copy_components`

This is the core building block table. Every piece of marketing text lives here.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| type | string | Component type — see taxonomy below |
| text | text | The actual copy content |
| character_count | integer | Auto-calculated on save |
| avatar_ids | json array | Multi-select — which avatars this works for |
| offer_ids | json array | Multi-select — which offers this works for |
| angle_ids | json array | Multi-select — which angles this works for |
| platform | string | Optional. `meta`, `google`, `youtube`, `display`, `landing_page`, `email`, `all` |
| status | string | `approved`, `denied` |
| funnel_instance_id | UUID | Nullable. FK → funnel_instances. Set when generated as part of a combo |
| parent_id | UUID | Nullable. References original when this is a variant |
| created_at | timestamp | |
| updated_at | timestamp | |

**Tagging rules:**
- Components are multi-tagged with avatars, offers, and angles
- Some components are generic and tagged with ALL avatars/offers/angles (or empty arrays meaning "universal")
- AI must tag components at creation time based on relevance
- On the Funnel page, the system queries components matching the selected Avatar + Offer + Angle

---

## Copy Component Taxonomy (type field)

These are the canonical types. This list covers everything needed for Google Ads, Meta Ads, display, video, and landing pages.

| Type Slug | Description | Platform Context |
|---|---|---|
| headline | Short attention-grabbing headline | Google (30 char), Meta (40 char), Landing pages |
| subheadline | Supporting headline | Landing pages, Meta ads |
| primary_text | Body copy for ads | Meta (125 char recommended) |
| google_headline | Google-specific headline | Google Ads (30 char max) |
| google_description | Google-specific description | Google Ads (90 char max) |
| benefit | A single value proposition point | Landing pages, ads, scripts |
| proof | Credibility / social proof statement | Landing pages, ads |
| urgency | Time-sensitive or scarcity messaging | Ads, landing pages |
| fear_point | Risk or loss-based messaging | Ads, scripts |
| value_point | Positive value / gain messaging | Ads, landing pages |
| cta | Call to action text | Everywhere |
| video_hook | Opening hook for video (first 3 seconds) | YouTube, Meta video, TikTok |
| video_script | Full video script body | YouTube, Meta video |
| objection_handler | Addresses a specific objection | Landing pages, scripts |
| description | General descriptive copy | Landing pages |

**Character limits** are enforced per platform using the `ad_copy_rules` from the client record. The component type + platform combination determines the limit.

---

## Table: `funnel_instances`

Each unique Avatar + Offer + Angle combination is generated once and saved permanently.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| avatar_id | UUID | FK → avatars |
| offer_id | UUID | FK → offers |
| primary_angle | string | Angle slug from the 15 |
| secondary_angles | json array | 1–2 additional angle slugs |
| generated_at | timestamp | When this combo was first built |
| status | string | `active`, `archived` |

**Rules:**
- A funnel_instance is created the FIRST time a user generates a specific Avatar + Offer + Angle combo
- It CANNOT be regenerated / rebuilt from scratch
- New items can be added to it (manually or via "Generate More")
- Individual items within it can be denied or deleted (with confirmation)
- The funnel_instance_id is set on all copy_components, creatives, and landing_pages generated as part of this combo

---

## Table: `creatives`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| funnel_instance_id | UUID | FK → funnel_instances |
| avatar_id | UUID | FK → avatars |
| offer_id | UUID | FK → offers |
| copy_component_ids | json array | Which components were used to assemble this |
| creative_type | string | `static_image`, `video`, `carousel`, `story`, `landing_hero` |
| headline | string | Display headline on the creative |
| support_copy | string | Secondary text |
| cta | string | Button / CTA text |
| concept_description | text | What the creative depicts |
| visual_prompt | text | AI image generation prompt |
| image_url | string | Nullable. URL if image has been generated/uploaded |
| status | string | `approved`, `denied` |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## Table: `landing_pages`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| funnel_instance_id | UUID | FK → funnel_instances |
| avatar_id | UUID | FK → avatars |
| offer_id | UUID | FK → offers |
| copy_component_ids | json array | Components used |
| headline | string | Hero headline |
| subheadline | string | Hero subheadline |
| cta | string | Primary CTA |
| sections | json | Ordered array of page sections (see Landing Page Structure below) |
| preview_image_url | string | Nullable. Thumbnail preview |
| status | string | `approved`, `denied` |
| created_at | timestamp | |
| updated_at | timestamp | |

### Landing Page Section Structure

```json
{
  "sections": [
    { "type": "hero", "headline": "", "subheadline": "", "cta": "" },
    { "type": "problem", "content": "" },
    { "type": "solution", "content": "" },
    { "type": "benefits", "items": [] },
    { "type": "proof", "items": [] },
    { "type": "faq", "items": [{ "question": "", "answer": "" }] },
    { "type": "final_cta", "headline": "", "cta": "" }
  ]
}
```

---

## Table: `intake_questions`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| section | string | Grouping label (e.g., "Best Customers", "Trigger Events") |
| question | text | The question |
| answer | text | Nullable. Client's answer |
| sort_order | integer | Display order |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## Table: `competitor_intel`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| competitor_name | string | |
| competitor_website | string | |
| source | string | `meta_ad_library`, `manual`, `google_ads` |
| ad_type | string | `social`, `search`, `display`, `landing_page` |
| content | text | Ad copy, URL, or description |
| screenshot_url | string | Nullable |
| keywords | json array | Relevant keywords if search ad |
| notes | text | Team observations |
| captured_at | timestamp | When this was found |
| created_at | timestamp | |

---

# PAGE SPECS

**Role-based visibility:** All pages are visible to all roles (admin, editor, viewer, client). The difference is in available actions:

| Action | Admin/Editor | Viewer | Client |
|---|---|---|---|
| Generate (AI) | Shown | Hidden | Hidden |
| + Add (manual) | Shown | Hidden | Hidden |
| Edit | Shown | Hidden | Hidden |
| Deny | Shown | Hidden | Shown (with confirmation) |
| Delete | Shown | Hidden | Hidden |
| View/Read | Yes | Yes | Yes |

---

## Page 0: DASHBOARD (Client Landing Page)

**Purpose:** The first page clients see when they log in. A high-level overview of their account.

**V1:** Placeholder page only. Show a welcome message with the client's company name, and placeholder cards for future widgets (stats summary, recent activity, quick links to Funnel and Avatars).

**Future:** This will become a rich overview with key metrics, recent changes, campaign status, and quick-access links.

**Notes:**
- This is the default landing page for client-role users
- Admin and team members land on the Funnel page (or last-visited client) by default
- Should feel polished and branded even as a placeholder

---

## Page 1: FUNNEL (Centerpiece)

**Purpose:** Display and manage the complete marketing system for a specific Avatar + Offer + Angle combination. This is the main deliverable clients see.

**Design:** Dark theme. Mobile-first vertical scroll. Rounded cards. Premium SaaS feel. No tables on this page. No technical jargon.

### Top Section — Selectors

Three selectors at the top of the page:

1. **Avatar** — dropdown of approved avatars
2. **Offer** — dropdown of approved offers
3. **Angle** — AI recommends 3–5 angles for the selected Avatar + Offer. Shown as primary options. "See other options" expands to all 15 angles with client-facing labels.

When all three are selected:

- If a `funnel_instance` exists for this combo → load all existing assets
- If no `funnel_instance` exists → show a "Generate Campaign" button that triggers the initial build

### Section Layout

Stacked rounded cards, each representing one asset category. Each section shows:

- Top items first (collapsed view)
- "View More" to expand full list
- Per-item actions: **Deny** (with confirmation), **Edit** (optional)
- Bottom actions: **+ Add** (manual entry), **Generate More** (AI adds to existing set)

Denied items are hidden by default.

**Role-aware actions:** Clients see only the Deny button per item. Viewers see no action buttons. Edit, + Add, Generate More, and Generate Campaign are only visible to Admin and Editor roles. See the role-based visibility table at the top of Page Specs.

### Section Order

**1. Headlines**
- Show top 5 headlines
- Each item: headline text + character count
- Expand to see all

**2. Social Copy**
- Show 2–3 examples
- Each item: body copy text + CTA line if present
- Text wraps naturally

**3. Key Benefits**
- Short bullet-style benefit statements
- Show top 5, expand for more

**4. Proof**
- Credibility and social proof statements
- Show top 3, expand for more

**5. Video Script**
- Show: hook line + preview of script text
- Full script in expanded view
- Text wraps, no clipping

**6. Ad Concepts (Creatives)**
- Horizontal scroll or stacked cards
- Each card: image placeholder/preview, headline, CTA, creative type
- Show 3, expand for more

**7. Landing Page**
- One large preview card
- Shows: thumbnail preview, headline, CTA
- "View Full Page" action

### + Add Behavior

Opens inline form or modal. Auto-fills:
- type = section type (headline, benefit, etc.)
- avatar_id = currently selected avatar
- offer_id = currently selected offer
- angle_id = currently selected angle
- status = approved

For copy that works across multiple combos, the add form should allow multi-selecting additional avatars, offers, and angles.

### Generate More Behavior

Triggers AI to generate additional items ONLY for that section type, constrained to:
- The selected Avatar + Offer + Angle
- The existing business overview and ad copy rules
- Must not duplicate existing items in the set
- New items saved as `approved`

---

## Page 2: BUSINESS OVERVIEW

**Purpose:** The foundation layer. Everything here informs all AI generation. This is the first thing set up for a new client.

### Sections

**Company Info**
- Business name
- Website URL
- Business summary (AI-generated from inputs, editable)
- Services offered
- Differentiators
- Trust signals

**Ad Copy Rules & Guidelines** (CRITICAL)
- Tone descriptors (multi-select tags)
- Banned words (tag input)
- Required disclaimers (list)
- Platform-specific rules (character limits, formatting rules per platform)
- Brand constraints (freeform)
- Compliance notes (freeform)

**Competitors**
- List of competitors with name, website, notes
- Link to Competitor Ads page for deeper intel

**Call Notes / Raw Inputs**
- Stored call notes by date
- Uploaded documents, transcripts
- These feed the AI analysis but are reference material, not structured data

---

## Page 3: AVATARS

**Purpose:** Card-based audience profiles that AI references for all copy generation.

**Layout:** Card grid, 3–4 per row. Clean, minimal. Similar to Notion gallery view.

### Each Card Shows
- Avatar name
- Avatar type
- Primary pain point (1 line)
- Primary angle recommendation
- Status badge

### Card Actions
- View Details (opens modal with full profile)
- Edit
- Deny (with confirmation)
- Delete (with confirmation)

### Detail Modal
Shows all avatar fields: description, pain points, motivations, objections, desired outcome, trigger events, messaging style, preferred platforms, recommended angles.

### Header Actions
- **Generate Avatars** button — opens AI prompt modal. AI analyzes business inputs and generates avatar cards. All created as `approved`.

---

## Page 4: OFFERS

**Purpose:** The conversion propositions available for campaigns. Card format.

**Layout:** Card grid, 3–4 per row.

### Each Card Shows
- Offer name
- Offer type
- Primary CTA
- Conversion type

### Card Actions
- View Details (opens modal with full offer data)
- Edit
- Deny (with confirmation)
- Delete (with confirmation)
- Generate Landing Page (triggers AI using this offer's data)

### Detail Modal
Shows all offer fields: headline, subheadline, description, benefits, proof elements, urgency elements, FAQ, landing page type.

### Header Actions
- **Suggest Offers** button — AI analyzes business inputs, competitors, and industry knowledge to suggest offer ideas. Suggestions appear as draft cards that the team reviews and approves before they enter the system.

**Rule:** Only approved offers appear in the Funnel page selector. AI cannot use unapproved offers for any generation.

---

## Page 5: INTAKE

**Purpose:** AI-generated custom questionnaire that fills knowledge gaps after initial business analysis.

### Layout
- Grouped by section (Best Customers, Trigger Events, Objections, etc.)
- Each question shown with answer field
- Answers are saved and feed back into the system

### How It Works
1. Team provides initial inputs (website, call notes, offer info)
2. AI analyzes and identifies what's missing
3. AI generates 8–12 targeted questions grouped by section
4. Client or team fills in answers
5. Answers feed back into avatar refinement, offer tuning, and copy generation

### Rules
- Max 10–12 questions
- No generic questions (never ask "What is your business?" if it's inferable)
- Questions must directly improve targeting, offers, or messaging quality
- Keep questions simple, no marketing jargon
- Should be completable in under 3 minutes

### Intake Status
- `pending` — questions generated, awaiting answers
- `completed` — all questions answered

After completion, AI can refine existing avatars, offers, and copy components based on new information.

---

## Page 6: STATS (Placeholder)

**Purpose:** Track campaign performance metrics. Landing page visits, leads, calls, qualified leads.

**First version:** Placeholder UI only. Design the layout and cards with sample data. Real integrations come later.

### Planned Sections
- Landing Page Visits (source: GA4)
- Leads Generated (source: form submissions / CRM)
- Calls (source: call tracking)
- Qualified Leads (source: CRM)
- Cost Per Lead (source: ad platforms)
- Conversion Rate by Funnel

### Future Integrations
- GA4 API
- CRM webhook / API
- Call tracking platform
- Ad platform APIs (Meta, Google)

---

## Page 7: COMPETITOR ADS

**Purpose:** Monitor what competitors are running across paid channels.

### Sources
- **Meta Ad Library API** (free) — pull active social ads for competitor pages
- **Manual input** — team pastes in ad copy, screenshots, landing page URLs
- **Google Ads** — manual capture of competitor search ads and keywords

### Layout
- Filter by competitor
- Filter by source (social, search, display, landing page)
- Card view showing ad content, screenshot, and team notes
- Keyword tracking section for Google paid terms

### Each Card Shows
- Competitor name
- Ad type
- Ad content / screenshot
- Landing page URL if available
- Keywords (if search ad)
- Team notes
- Date captured

---

# NAVIGATION & HEADER

## Header Bar

- **Left:** Logical Boost Hub logo / wordmark
- **Center or Right:** Client switcher dropdown (Admin sees all clients; Team sees assigned clients; Clients see their own company name, no dropdown)
- **Right:** User avatar / name + logout

## Sidebar Navigation

Sidebar nav with these items in order:

1. **Dashboard** (client landing page, placeholder in V1)
2. **Stats** (placeholder)
3. **Funnel** (centerpiece)
4. **Business Overview**
5. **Intake**
6. **Avatars**
7. **Offers**
8. **Competitor Ads**

All roles see all nav items. Actions within each page are controlled by role (see role-based visibility table in Page Specs).

---

# AI WORKFLOWS

These are the core AI operations the system performs. Each workflow must always reference the client's `ad_copy_rules` and `ad_copy_notes`.

---

## Workflow 1: ANALYZE BUSINESS

**Trigger:** New client setup — team provides website, call notes, landing pages

**Input:**
- Website URL (AI reads/scrapes)
- Call notes
- Landing page URLs
- Any uploaded materials

**Output:**
- Populate `clients` record: business_summary, services, differentiators, trust_signals, tone
- Generate initial avatars (status = approved)
- Suggest initial offers (status = approved)
- Identify recommended angles per avatar

**Rule:** This is the foundation. Quality of all downstream generation depends on this step.

---

## Workflow 2: GENERATE INTAKE

**Trigger:** After initial business analysis, before client intake call

**Input:**
- Everything from Workflow 1 output

**Process:**
- Analyze what is already known
- Identify critical gaps in: audience understanding, trigger events, objections, offer performance, differentiation, trust factors, urgency drivers
- Generate 8–12 targeted questions grouped by section

**Output:**
- `intake_questions` records for this client

---

## Workflow 3: REFINE SYSTEM

**Trigger:** Client completes intake questionnaire or new call notes are added

**Input:**
- Intake answers
- New call notes / transcripts
- Any new materials

**Process:**
- Compare new information against existing avatars, offers, and copy components
- Update and improve existing records — do NOT rebuild from scratch
- Flag any components that may need review based on new info

**Output:**
- Updated avatars (refined pain points, motivations, etc.)
- Updated offers (refined benefits, proof, urgency)
- Updated copy components if needed

---

## Workflow 4: GENERATE FUNNEL INSTANCE

**Trigger:** User selects Avatar + Offer + Angle on Funnel page and no existing funnel_instance exists for that combo

**Input:**
- avatar record (full profile)
- offer record (full details)
- selected primary angle + AI-chosen secondary angles
- client ad_copy_rules and ad_copy_notes
- business overview

**Process:**
1. Create `funnel_instance` record
2. Query existing copy_components that match this Avatar + Offer + Angle combo (reuse where possible)
3. Generate NEW copy_components to fill gaps:
   - Headlines (5–8, respecting platform char limits)
   - Social copy / primary text (3–5 variations)
   - Benefits (5–8)
   - Proof statements (3–5)
   - Urgency elements (2–3)
   - Video hook (2–3)
   - Video script (1–2)
   - CTAs (3–5)
   - Google headlines (5–8)
   - Google descriptions (3–5)
   - Objection handlers (2–3)
4. Tag all new components with the avatar_id, offer_id, angle slug
5. Generate creative concepts (3–5 static, 1–2 video concepts)
6. Generate landing page structure (1)

**Output:**
- funnel_instance record
- copy_components (all status = approved, linked to funnel_instance_id)
- creatives (status = approved)
- landing_page (status = approved)

**Rule:** This is a one-time generation. The combo is now locked. Items can be added or denied, but the set cannot be regenerated from scratch.

---

## Workflow 5: GENERATE MORE (Per Section)

**Trigger:** User clicks "Generate More" on any section within an existing funnel instance

**Input:**
- funnel_instance (Avatar + Offer + Angle context)
- section type (e.g., headline, benefit, proof)
- existing components in this section (to avoid duplication)
- client ad_copy_rules

**Process:**
1. Review existing items in this section for this funnel instance
2. Generate 3–5 new items that are complementary, not duplicative
3. Vary angles, phrasing, and approach while staying aligned to the combo

**Output:**
- New copy_components (status = approved, linked to funnel_instance_id)

---

## Workflow 6: GENERATE CREATIVES

**Trigger:** User clicks "Generate More" in the Creatives section, or system generates as part of Workflow 4

**Input:**
- Approved copy_components for this funnel instance
- Avatar + Offer context

**Process:**
1. Query approved copy_components matching this combo
2. Group by role (headline, benefit, proof, cta)
3. Assemble messaging combinations
4. Generate concept description and visual prompt for each

**Output:**
- creative records with copy_component_ids referencing which pieces were used

---

## Workflow 7: GENERATE LANDING PAGE

**Trigger:** User clicks "Generate Landing Page" from Funnel page or Offer detail

**Input:**
- Offer data (headline, subheadline, benefits, proof, FAQ, CTA, landing_page_type)
- Approved copy_components for the selected combo
- Avatar data (pain points, motivations)
- Client ad_copy_rules

**Process:**
1. Use offer.landing_page_type to determine layout structure
2. Pull hero content from offer (headline, subheadline, CTA)
3. Assemble sections using copy_components by role
4. Build sections JSON following the Landing Page Section Structure

**Output:**
- landing_page record with full sections JSON

---

# GLOBAL RULES

---

## Rule 1: AD COPY RULES ARE MANDATORY

Every AI generation workflow MUST read and apply the client's `ad_copy_rules` and `ad_copy_notes`. These include tone, banned words, disclaimers, platform character limits, brand constraints, and compliance notes. No exceptions.

---

## Rule 2: ONLY APPROVED ITEMS DOWNSTREAM

Only records with `status = approved` can be:
- Used as inputs for AI generation
- Shown in the Funnel page (default view)
- Used to assemble creatives or landing pages
- Presented to clients

---

## Rule 3: SIMPLIFIED STATUS

All content uses a two-status model:

- `approved` — visible, usable, active
- `denied` — hidden by default, excluded from generation

AI-generated content defaults to `approved`. Users can deny items (with confirmation dialog). Users can delete items (with confirmation dialog). There is no draft/review workflow — the system trusts AI output and gives users deny/delete power.

---

## Rule 4: FUNNEL INSTANCES ARE PERMANENT

Once a funnel_instance is generated for an Avatar + Offer + Angle combo:
- It cannot be regenerated from scratch
- Individual items can be added (manually or via Generate More)
- Individual items can be denied or deleted
- The instance itself can be archived but not deleted

---

## Rule 5: COPY COMPONENTS ARE MULTI-TAGGED

Components can belong to multiple avatars, offers, and angles. This allows:
- Generic copy to be reused across combos
- Specific copy to be targeted to one combo
- The Funnel page to query relevant components across the full library

---

## Rule 6: DELETION REQUIRES CONFIRMATION

Any destructive action (deny, delete) must show a confirmation dialog before executing. This is a hard UX requirement on every page.

---

# DESIGN RULES

- Dark theme throughout
- Premium SaaS aesthetic — clean, modern, polished
- Mobile-first vertical scroll on Funnel page
- Rounded cards, good spacing, clean typography
- No heavy borders
- No technical labels visible to clients
- No raw IDs in UI
- No tables on the Funnel page (other pages can use tables where appropriate)
- Everything should feel like a real client deliverable, not an internal admin tool
- All copy text must be easily copyable (click-to-copy or select)

---

# FILE NAMING CONVENTION (For Generated Assets)

When creatives or assets are exported:

```
[Client]_[Avatar]_[Offer]_[Angle]_[Type]_v[N].[ext]
```

Example:
```
RoofCo_Homeowner_Inspection_FearRisk_Static_v1.png
```

Metadata (avatar_id, offer_id, angle, copy_component_ids, creative_id) is stored in the database, NOT crammed into filenames.

---

# FUTURE CONSIDERATIONS (Not in V1)

These are noted for later but should NOT be built now:

- Performance tracking fields on copy_components (CTR, CVR, spend)
- Winner status for high-performing copy
- Email sequence generation
- A/B test management
- Full GA4 / CRM / call tracking integrations (Stats page is placeholder only in V1)
- Google Ads transparency tool integration for Competitor Ads
- Client Dashboard widgets (Dashboard page is placeholder only in V1)
- Team management UI (admin page for inviting users, assigning clients, setting roles — V1 can handle this via direct database/Xano admin)
- Client self-service invite flow
- Activity log / audit trail
- Notification system (e.g., client denies an item → team gets notified)

---

# END OF SPEC

This document is the single source of truth for the Logical Boost Hub. All previous iteration notes are superseded. Hand this to your development team or Claude Code to begin building.
