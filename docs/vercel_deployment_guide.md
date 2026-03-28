# Vercel Deployment & Landing Page Architecture

## Overview

All landing pages are served from the **Hub itself** (`hub.logicalboost.com`). There are NO separate Vercel projects per client. The Hub's Next.js app has a dynamic catch-all route that renders landing pages using pre-built React templates.

## URL Structure

### Hub-served URLs
```
hub.logicalboost.com/[client-slug]/[page-slug]
```

Examples:
- `hub.logicalboost.com/upstart/gig` — Upstart's gig worker landing page
- `hub.logicalboost.com/upstart/homeowner` — Upstart's homeowner landing page
- `hub.logicalboost.com/summit-roofing/storm` — Summit Roofing's storm damage page

### Custom domain URLs
When a client connects their domain DNS to our server:
```
page.clientdomain.com/gig → hub.logicalboost.com/upstart/gig
```

The Hub detects which client based on the incoming domain (stored in `clients.custom_domain`).

## How Pages Are Built

1. **Agency manager** selects Avatar + Offer + Template in the Hub's Landing Page Builder
2. **Copy slots** are auto-filled from AI-generated copy components, reviewed/edited
3. **Media assets** (hero image, parallax, logo) are uploaded or AI-generated
4. **Slug is assigned** — e.g., `gig`, `homeowner`, `storm-damage`
5. **Page data is saved** to `published_pages` table in Supabase
6. **Page is immediately live** at `hub.logicalboost.com/[client-slug]/[page-slug]`
7. **GitHub repo** is created/updated for the client (`LogicalBoost/[client-slug]-pages`) so team can open Claude Code to refine the page

## How Pages Are Rendered

The Hub has a dynamic route: `app/p/[client]/[slug]/page.tsx`

This route:
1. Looks up the `published_pages` record by client slug + page slug
2. Loads the brand kit, copy slots, media assets
3. Renders the appropriate template component (e.g., LeadCaptureClassic)
4. Returns a fully rendered landing page — no Hub chrome (no sidebar, no header)

## GitHub Repos (For Editing)

Each client gets a GitHub repo: `LogicalBoost/[client-slug]-pages`

This repo:
- Contains the page data files (JSON with copy slots, media URLs, brand kit)
- Can contain static JSX override files for pages that need custom tweaks
- Is opened with Claude Code for refinement
- Changes pushed to the repo trigger a webhook that updates the Supabase data

The repo is NOT deployed separately. It's a version-controlled editing workspace.

## Custom Domains

### Setup
1. Client points their domain DNS (CNAME) to `cname.vercel-dns.com`
2. In Vercel dashboard, add the custom domain to the Hub project
3. In the Hub database, save `custom_domain` on the `clients` table
4. The Hub's middleware detects the domain and serves the right client's pages

### How It Works
- Vercel handles SSL and DNS routing
- The Hub's Next.js middleware checks `req.headers.host`
- If the host matches a `clients.custom_domain`, it rewrites the path to include the client slug
- Example: `page.upstart.com/gig` → internally serves `hub.logicalboost.com/p/upstart/gig`

## Database Tables

### `published_pages`
| Column | Description |
|--------|-------------|
| `id` | UUID primary key |
| `client_id` | FK to clients |
| `avatar_id` | FK to avatars |
| `offer_id` | FK to offers |
| `template_id` | Which template to render |
| `slug` | URL slug (e.g., `gig`, `homeowner`) |
| `copy_slots` | JSONB — all copy slot values |
| `media_assets` | JSONB — hero image, parallax, etc. |
| `brand_kit_snapshot` | JSONB — frozen brand kit at publish time |
| `status` | `draft`, `published`, `archived` |
| `created_at` | Timestamp |
| `updated_at` | Timestamp |

### `clients` (relevant fields)
| Column | Description |
|--------|-------------|
| `github_repo` | e.g., `LogicalBoost/upstart-pages` |
| `custom_domain` | e.g., `page.upstart.com` |
| `domain_verified` | Boolean |

## Required Secrets

All stored as Supabase Edge Function secrets:
- `GITHUB_TOKEN` — GitHub PAT for creating/updating client repos
- `VERCEL_TOKEN` — Vercel API token (for adding custom domains)
- `VERCEL_TEAM_ID` — Vercel team ID
