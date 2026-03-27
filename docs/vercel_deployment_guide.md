# Vercel Deployment & Custom Domain Setup — Guide for Claude Code

**Date:** March 27, 2026
**Purpose:** How Vercel fits into the Logical Boost Hub landing page system. Covers the full pipeline from template repo to live client pages on custom domains.

---

## HIGH-LEVEL ARCHITECTURE

```
LogicalBoost/landing-page-templates    ← Master template repo (never deployed directly)
       │
       │  (GitHub API: fork/duplicate when first landing page is built for a client)
       ▼
LogicalBoost/summit-roofing-pages      ← Client-specific repo (one per client)
       │
       │  (Connected to Vercel — auto-deploys on push)
       ▼
Vercel Project: "summit-roofing-pages"
       │
       │  (Custom domain attached)
       ▼
page.summitroofing.com/inspect-7x3k   ← Live landing page
```

**One template repo** → **One repo per client** → **One Vercel project per client** → **Client's custom domain attached**

---

## VERCEL ACCOUNT SETUP (ONE-TIME)

### Step 1: Create Vercel Account
1. Go to vercel.com and sign up with the LogicalBoost GitHub account
2. This connects Vercel to the `LogicalBoost` GitHub organization
3. Authorize Vercel to access repositories in the org

### Step 2: Generate API Token
1. In Vercel dashboard → click profile icon → Settings
2. Go to Tokens (under API Tokens section)
3. Click "Create Token"
4. Name it: `logical-boost-hub-api`
5. Scope: Full Account (needed for creating projects and adding domains)
6. Copy the token — store it as `VERCEL_TOKEN` in your Hub's `.env` file and in Supabase secrets

### Step 3: Get Team ID (if using Vercel Teams)
If you're on a Vercel Team plan (recommended for managing multiple projects):
1. Go to vercel.com/[your-team]/~/settings
2. Copy the Team ID
3. Store as `VERCEL_TEAM_ID` in your Hub's `.env`

---

## THE CLIENT ONBOARDING FLOW (AUTOMATED BY THE HUB)

When the agency builds the FIRST landing page for a new client, the Hub platform needs to do the following behind the scenes:

### Step 1: Create Client Repo from Template

Use the GitHub API to create a new repo from the template:

```javascript
// POST https://api.github.com/repos/LogicalBoost/landing-page-templates/generate
const response = await fetch('https://api.github.com/repos/LogicalBoost/landing-page-templates/generate', {
  method: 'POST',
  headers: {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
  },
  body: JSON.stringify({
    owner: 'LogicalBoost',
    name: `${clientSlug}-pages`,           // e.g. "summit-roofing-pages"
    description: `Landing pages for ${clientName}`,
    private: true,                          // Keep client repos private
    include_all_branches: false,            // Only need main branch
  }),
});
```

**IMPORTANT:** The template repo (`landing-page-templates`) must be configured as a GitHub Template Repository. Go to the repo Settings → check "Template repository." This enables the `/generate` endpoint.

### Step 2: Set Environment Variables in the New Repo

The client repo needs Supabase credentials to fetch page data at runtime. Add these as GitHub repository secrets (for the Vercel deployment to pick up):

```javascript
// These get injected as environment variables during Vercel build
// Set them via Vercel API when creating the project (see Step 3)
const envVars = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.SUPABASE_URL },
  { key: 'SUPABASE_ANON_KEY', value: process.env.SUPABASE_ANON_KEY },
  { key: 'CLIENT_ID', value: clientId },    // Scopes all queries to this client
];
```

### Step 3: Create Vercel Project Linked to the New Repo

Use the Vercel API to create a project and link it to the client's repo:

```javascript
const vercelResponse = await fetch('https://api.vercel.com/v11/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: `${clientSlug}-pages`,            // e.g. "summit-roofing-pages"
    framework: 'nextjs',
    gitRepository: {
      type: 'github',
      repo: `LogicalBoost/${clientSlug}-pages`,
    },
    environmentVariables: [
      {
        key: 'NEXT_PUBLIC_SUPABASE_URL',
        target: ['production', 'preview'],
        type: 'encrypted',
        value: SUPABASE_URL,
      },
      {
        key: 'SUPABASE_ANON_KEY',
        target: ['production', 'preview'],
        type: 'encrypted',
        value: SUPABASE_ANON_KEY,
      },
      {
        key: 'CLIENT_ID',
        target: ['production', 'preview'],
        type: 'plain',
        value: clientId,
      },
    ],
  }),
});

const vercelProject = await vercelResponse.json();
// Save vercelProject.id to the clients table as vercel_project_id
```

At this point, Vercel automatically:
- Detects the Next.js framework
- Runs the first build
- Deploys to `${clientSlug}-pages.vercel.app`

### Step 4: Store Deployment Info

Save these to the `clients` table (add columns if needed):

```sql
ALTER TABLE clients ADD COLUMN github_repo VARCHAR(200);      -- "LogicalBoost/summit-roofing-pages"
ALTER TABLE clients ADD COLUMN vercel_project_id VARCHAR(100); -- Vercel project ID
ALTER TABLE clients ADD COLUMN vercel_url VARCHAR(200);        -- "summit-roofing-pages.vercel.app"
ALTER TABLE clients ADD COLUMN custom_domain VARCHAR(255);     -- "page.summitroofing.com" (set later)
```

---

## CUSTOM DOMAIN SETUP

This happens when the agency is ready to connect the client's domain. It's a two-part process: Vercel side + client's DNS side.

### Part A: Add Domain to Vercel Project (Agency Does This)

```javascript
// Add the subdomain to the client's Vercel project
const domainResponse = await fetch(
  `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'page.summitroofing.com',       // The subdomain the client wants to use
    }),
  }
);

const domainResult = await domainResponse.json();
// domainResult.verified will be false until DNS is configured
// domainResult.verification will contain the CNAME or TXT records needed
```

### Part B: Client Configures DNS (Client or Agency Does This)

The client (or their web person) needs to add ONE DNS record at their domain registrar:

**For a subdomain like `page.summitroofing.com`:**
```
Type:  CNAME
Name:  page                              (just the subdomain prefix)
Value: cname.vercel-dns.com              (Vercel's CNAME target)
TTL:   Auto or 300
```

That's it. One record. Vercel handles SSL automatically after DNS propagates.

**Common registrars where clients will do this:**
- GoDaddy: DNS Management → Add Record → CNAME
- Namecheap: Advanced DNS → Add New Record → CNAME
- Cloudflare: DNS → Add Record → CNAME (turn OFF the orange proxy cloud)
- Google Domains: DNS → Custom Records → CNAME

### Part C: Verify Domain (Agency Does This After DNS Propagates)

```javascript
// Check if the domain is verified
const verifyResponse = await fetch(
  `https://api.vercel.com/v10/projects/${vercelProjectId}/domains/${domain}/verify`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
    },
  }
);

const verifyResult = await verifyResponse.json();
// verifyResult.verified === true means it's ready
```

DNS propagation can take a few minutes to 48 hours. Usually it's under 30 minutes.

### Part D: Update the Client Record

```javascript
// Save the custom domain to the clients table
await supabase
  .from('clients')
  .update({ custom_domain: 'page.summitroofing.com' })
  .eq('id', clientId);
```

Now when the catch-all route in the client's landing pages app runs, it knows to respond to requests on `page.summitroofing.com`.

---

## HOW PAGES GET PUBLISHED

After the client's repo and Vercel project exist, publishing a new landing page is simple:

### 1. Agency Builds the Page in the Hub UI
- Select Avatar + Offer + Angle
- Copy is generated (sections JSON) via existing Workflow 4/7
- Select template, map media assets, preview

### 2. Hub Creates a `published_pages` Record
```javascript
const slug = generateSlug(offerName); // e.g. "inspect-7x3k"

await supabase.from('published_pages').insert({
  client_id: clientId,
  landing_page_id: landingPageId,
  template_id: selectedTemplateId,
  avatar_id: avatarId,
  offer_id: offerId,
  slug: slug,
  custom_domain: client.custom_domain,  // e.g. "page.summitroofing.com"
  media_mapping: mediaMappingJson,       // { "hero_image": "asset-uuid", ... }
  status: 'published',
  published_at: new Date().toISOString(),
});
```

### 3. Page Is Instantly Live
No deploy needed. The catch-all route in the client's landing pages app queries Supabase on every request. As soon as the `published_pages` row exists with status='published', the URL works.

**URL:** `page.summitroofing.com/inspect-7x3k`

### 4. The Catch-All Route Logic

```jsx
// pages/[slug].jsx in the client's landing-pages repo

export async function getServerSideProps({ params, req }) {
  const { slug } = params;
  
  // Get the hostname to match against custom_domain
  const host = req.headers.host;
  
  // Query for this specific page
  const { data: page } = await supabase
    .from('published_pages')
    .select(`
      *,
      landing_pages ( sections ),
      page_templates ( slug, section_schema, slot_schema ),
      clients!inner ( 
        brand_kits ( * )
      )
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!page) return { notFound: true };

  // Resolve media asset URLs from the media_mapping
  const mediaAssetIds = Object.values(page.media_mapping || {}).flat();
  const { data: mediaAssets } = await supabase
    .from('media_assets')
    .select('id, file_url, role, alt_text')
    .in('id', mediaAssetIds);

  return {
    props: {
      sections: page.landing_pages.sections,
      template: page.page_templates,
      brandKit: page.clients.brand_kits[0],
      mediaAssets: resolveMediaMapping(page.media_mapping, mediaAssets),
    },
  };
}

export default function LandingPage({ sections, template, brandKit, mediaAssets }) {
  return (
    <TemplateRenderer
      template={template}
      sections={sections}
      brandKit={brandKit}
      mediaAssets={mediaAssets}
    />
  );
}
```

---

## CLAUDE CODE REFINEMENT WORKFLOW

When a page needs hand-tuning beyond what templates support:

### 1. Export the Page
The Hub has an "Export for Editing" button on any published page. This:
- Renders the page to a static `.jsx` file
- Commits it to the client's repo at `/pages/overrides/[slug].jsx`
- Pushes to GitHub → Vercel auto-deploys

### 2. Refine with Claude Code
```bash
# Team member opens Claude Code
cd ~/repos/summit-roofing-pages
git pull

# Open the override file
# Claude Code can now edit it with natural language instructions

# Preview locally
npm run dev
# Visit localhost:3000/inspect-7x3k

# When happy, push
git add .
git commit -m "Refined hero section layout for inspect page"
git push
# Vercel auto-deploys in ~30 seconds
```

### 3. Override Priority
The catch-all route checks for overrides first:
```jsx
// If /pages/overrides/[slug].jsx exists, Next.js file-based routing
// serves that instead of the catch-all [slug].jsx
// This is automatic with Next.js — more specific routes take priority
```

---

## AUTO-DEPLOY FLOW

Every client repo has this automatic pipeline:

```
Team pushes code to GitHub (e.g. after Claude Code refinement)
       │
       ▼
Vercel detects push to main branch
       │
       ▼
Vercel runs: npm install → npm run build
       │
       ▼
Build succeeds → deployed to production
       │
       ▼
Live at: summit-roofing-pages.vercel.app AND page.summitroofing.com
       │
       ▼
All pages under that client are updated (shared build)
```

Preview deployments also work automatically:
- Push to a non-main branch → Vercel creates a preview URL
- Team can review changes before merging to main
- Useful for client review: "Here's a preview link, let us know if you want changes"

---

## VERCEL PLAN CONSIDERATIONS

### Free (Hobby) Plan
- 1 user
- Good for testing, NOT for production multi-client setup
- Custom domains supported but limited to 50 per project
- Cannot use with a GitHub Organization (only personal repos)

### Pro Plan ($20/month per user)
- Supports GitHub Organizations (required for LogicalBoost org repos)
- Unlimited custom domains per project
- Faster builds, more bandwidth
- Team collaboration features
- Password protection for preview deployments (useful for client previews)
- **This is the plan you need**

### How Costs Scale
- Each client repo = 1 Vercel project
- Pro plan handles multiple projects under one team
- Bandwidth is shared across the team (1TB on Pro)
- Landing pages are lightweight (mostly static HTML + images) — bandwidth usage will be low
- Build minutes are shared — each push to any client repo uses build minutes
- If you scale to 50+ clients, monitor bandwidth and build minutes

---

## REQUIRED ENVIRONMENT VARIABLES

### In the Hub (`.env` or Supabase secrets):
```
VERCEL_TOKEN=ver_xxxxxxxxxxxx          # Vercel API token
VERCEL_TEAM_ID=team_xxxxxxxxxxxx       # If using Teams
GITHUB_TOKEN=ghp_xxxxxxxxxxxx          # GitHub personal access token with repo scope
```

### In each client's Vercel project (set via API during project creation):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
CLIENT_ID=uuid-of-the-client
```

---

## DATABASE ADDITIONS FOR THIS SYSTEM

Add these columns to the `clients` table:

```sql
ALTER TABLE clients ADD COLUMN github_repo VARCHAR(200);       -- "LogicalBoost/summit-roofing-pages"
ALTER TABLE clients ADD COLUMN vercel_project_id VARCHAR(100);  -- From Vercel API response
ALTER TABLE clients ADD COLUMN vercel_url VARCHAR(200);         -- "summit-roofing-pages.vercel.app"  
ALTER TABLE clients ADD COLUMN custom_domain VARCHAR(255);      -- "page.summitroofing.com"
ALTER TABLE clients ADD COLUMN domain_verified BOOLEAN DEFAULT false;
```

---

## STEP-BY-STEP: WHAT TO DO RIGHT NOW

1. **Sign up for Vercel Pro** at vercel.com — connect with the LogicalBoost GitHub account
2. **Generate a Vercel API token** — save it somewhere safe
3. **Get your Team ID** from Vercel dashboard settings
4. **Make sure `landing-page-templates` repo exists** on GitHub as a Template Repository
5. **Test the flow manually first:**
   - Create `landing-page-templates` repo with a basic Next.js app
   - Use GitHub's "Use this template" button to create `test-client-pages`
   - Import `test-client-pages` into Vercel manually (dashboard → New Project → Import)
   - Add a test custom domain
   - Verify it all works end-to-end
6. **Then automate** — build the Hub-side code that does steps 1-4 via API
