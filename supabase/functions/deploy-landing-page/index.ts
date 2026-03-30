import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
const TEMPLATE_REPO_OWNER = 'LogicalBoost'
const TEMPLATE_REPO_NAME = 'landing-page-templates'
const HUB_URL = 'https://hub.logicalboost.com'

// ─── Convert flat copy_slots to Section[] for PageData ───
interface SectionItem {
  icon?: string; title?: string; text?: string; question?: string; answer?: string
  name?: string; role?: string; quote?: string; rating?: number
  stat?: string; label?: string; value?: string
}
interface Section {
  type: string; headline?: string; subheadline?: string; content?: string
  cta?: string; cta_url?: string; sub_cta?: string; accent_word?: string
  items?: SectionItem[]; show_form?: boolean; phone?: string
  links?: Array<{ label: string; url: string }>
  socials?: Array<{ platform: string; url: string }>
}

function copySlotsToSections(slots: Record<string, string>): Section[] {
  const sections: Section[] = []
  const headline = slots.t1_headline || slots.hero_headline || 'Welcome'
  const cta = slots.t1_cta || slots.hero_cta || 'Get Started'

  // Hero
  sections.push({
    type: 'hero',
    headline,
    subheadline: slots.t1_subheadline || slots.hero_subheadline || '',
    cta,
    cta_url: '#lead-form',
    sub_cta: slots.t1_trust_line || slots.trust_line || '',
    show_form: true,
  })

  // Feature Cards
  const featureItems: SectionItem[] = []
  for (let i = 1; i <= 6; i++) {
    const title = slots[`feature_${i}_title`]
    const text = slots[`feature_${i}_text`]
    if (title) featureItems.push({ icon: slots[`feature_${i}_icon`] || 'check', title, text: text || '' })
  }
  sections.push({
    type: 'feature_cards',
    items: featureItems.length > 0 ? featureItems : [
      { icon: 'zap', value: 'Fast Approval', label: 'Quick and easy process' },
      { icon: 'shield', value: 'Trusted Service', label: 'Industry-leading standards' },
      { icon: 'dollar', value: 'Great Rates', label: 'Competitive pricing' },
    ],
  })

  // Two Column Info
  const infoItems: SectionItem[] = []
  for (let i = 1; i <= 8; i++) {
    const title = slots[`info_${i}_title`] || slots[`benefit_${i}_title`]
    const text = slots[`info_${i}_text`] || slots[`benefit_${i}_text`]
    if (title || text) infoItems.push({ title, text: text || '' })
  }
  sections.push({
    type: 'two_column_info',
    headline: slots.info_headline || slots.problem_headline || 'Why It Matters',
    content: slots.info_content || '',
    items: infoItems.length > 0 ? infoItems : [
      { title: 'Expert Guidance', text: 'Our team helps you every step of the way' },
      { title: 'Tailored Solutions', text: 'Customized to fit your unique situation' },
    ],
    cta,
    cta_url: '#lead-form',
  })

  // Steps
  const stepItems: SectionItem[] = []
  for (let i = 1; i <= 5; i++) {
    const title = slots[`step_${i}_title`]
    const text = slots[`step_${i}_text`]
    if (title) stepItems.push({ icon: slots[`step_${i}_icon`], title, text: text || '' })
  }
  sections.push({
    type: 'steps',
    headline: slots.steps_headline || 'How It Works',
    items: stepItems.length > 0 ? stepItems : [
      { icon: 'calendar', title: 'Apply Online', text: 'Fill out our simple form in minutes' },
      { icon: 'eye', title: 'Get Matched', text: 'We find the best option for you' },
      { icon: 'thumbs_up', title: 'Get Results', text: 'Receive your answer quickly' },
    ],
    cta,
    cta_url: '#lead-form',
  })

  // Trust Bar
  sections.push({
    type: 'trust_bar',
    headline: slots.trust_headline || 'Proven Track Record',
    items: [
      { stat: slots.trust_stat_1 || '1000+', label: slots.trust_label_1 || 'Happy Clients' },
      { stat: slots.trust_stat_2 || '12+', label: slots.trust_label_2 || 'Years Experience' },
      { stat: slots.trust_stat_3 || '4.9', label: slots.trust_label_3 || 'Star Rating' },
    ],
  })

  // Benefits Grid
  const benefitItems: SectionItem[] = []
  for (let i = 1; i <= 8; i++) {
    const title = slots[`grid_benefit_${i}_title`]
    const text = slots[`grid_benefit_${i}_text`]
    if (title) benefitItems.push({ icon: slots[`grid_benefit_${i}_icon`] || 'check', title, text: text || '' })
  }
  sections.push({
    type: 'benefits_grid',
    headline: slots.benefits_headline || 'Benefits',
    items: benefitItems.length > 0 ? benefitItems : [
      { icon: 'check', title: 'No Hidden Fees', text: 'Transparent pricing from start to finish' },
      { icon: 'clock', title: 'Quick Process', text: 'Get approved in as little as one day' },
      { icon: 'shield', title: 'Secure & Private', text: 'Your information is always protected' },
      { icon: 'star', title: 'Top Rated', text: 'Thousands of 5-star reviews' },
      { icon: 'users', title: 'Dedicated Support', text: 'A real person to help you every step' },
      { icon: 'dollar', title: 'Competitive Rates', text: 'Fair terms designed for your situation' },
    ],
    cta,
    cta_url: '#lead-form',
  })

  // Testimonials
  const testimonialItems: SectionItem[] = []
  for (let i = 1; i <= 6; i++) {
    const name = slots[`testimonial_${i}_name`]
    const quote = slots[`testimonial_${i}_quote`]
    if (name || quote) {
      testimonialItems.push({
        name: name || 'Customer', quote: quote || '',
        role: slots[`testimonial_${i}_role`] || '', rating: 5,
      })
    }
  }
  if (testimonialItems.length > 0) {
    sections.push({ type: 'testimonials', headline: slots.testimonials_headline || 'What Our Clients Say', items: testimonialItems })
  }

  // FAQ
  const faqItems: SectionItem[] = []
  for (let i = 1; i <= 8; i++) {
    const question = slots[`faq_${i}_question`] || slots[`faq_${i}_q`]
    const answer = slots[`faq_${i}_answer`] || slots[`faq_${i}_a`]
    if (question) faqItems.push({ question, answer: answer || '' })
  }
  if (faqItems.length > 0) {
    sections.push({ type: 'faq', headline: slots.faq_headline || 'Common Questions', items: faqItems })
  }

  // Footer
  sections.push({
    type: 'footer',
    phone: slots.phone || '',
    links: [
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms of Use', url: '/terms' },
    ],
  })

  return sections
}

// ─── Generate page-data.ts file content ───
function generatePageDataFile(
  slug: string,
  templateSlug: string,
  copySlots: Record<string, string>,
  brandKit: Record<string, unknown>,
  mediaAssets: Record<string, string>,
  providedSections?: unknown[],
): string {
  // Use AI-generated sections if available, otherwise convert from flat copy_slots
  const sections = providedSections && providedSections.length > 0
    ? providedSections
    : copySlotsToSections(copySlots)

  const pageData = {
    template: {
      slug: templateSlug || 'lead-capture-classic',
      name: templateSlug === 'lead-capture-classic' ? 'Lead Capture Classic' : templateSlug,
    },
    brandKit: {
      primary_color: (brandKit.primary_color as string) || '#2E86AB',
      secondary_color: (brandKit.secondary_color as string) || '#1B4965',
      accent_color: (brandKit.accent_color as string) || '#10b981',
      background_color: (brandKit.background_color as string) || '#FFFFFF',
      text_color: (brandKit.text_color as string) || '#1A1A2E',
      heading_font: (brandKit.heading_font as string) || 'Barlow Condensed, sans-serif',
      body_font: (brandKit.body_font as string) || 'Inter, sans-serif',
      button_style: (brandKit.button_style as Record<string, string>) || { borderRadius: '10px', textTransform: 'uppercase' },
      logo_url: (brandKit.logo_url as string) || undefined,
    },
    mediaAssets: {
      hero_image: mediaAssets.hero_image || undefined,
      parallax_image: mediaAssets.parallax_image || undefined,
      logo: mediaAssets.logo || undefined,
    },
    sections,
  }

  return `import type { PageData } from './types'

// Auto-generated page data for "${slug}"
// Edit sections, brand kit, and media assets below.
// Run \`npm run dev\` to preview changes locally.

export const pageData: PageData = ${JSON.stringify(pageData, null, 2)}
`
}

// ─── Generate page route file ───
function generatePageRouteFile(slug: string): string {
  return `import TemplateRenderer from '@/components/TemplateRenderer'
import { pageData } from '@/lib/page-data'

export const metadata = {
  title: pageData.sections.find(s => s.type === 'hero')?.headline || '${slug}',
}

export default function Page() {
  return <TemplateRenderer data={pageData} />
}
`
}

// ─── GitHub API helper: create or update file ───
async function pushFileToRepo(
  repo: string,
  filePath: string,
  content: string,
  message: string,
  branch: string,
): Promise<boolean> {
  if (!GITHUB_TOKEN) return false

  const encoded = btoa(unescape(encodeURIComponent(content)))

  // Check if file already exists (need SHA for updates)
  const checkRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
    { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' } }
  )
  let sha: string | undefined
  if (checkRes.ok) {
    const existing = await checkRes.json()
    sha = existing.sha
  }

  const body: Record<string, string> = { message, content: encoded, branch }
  if (sha) body.sha = sha

  const putRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  return putRes.ok
}

// ─── Detect default branch ───
async function getDefaultBranch(repo: string): Promise<string> {
  if (!GITHUB_TOKEN) return 'main'
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
  })
  if (res.ok) {
    const data = await res.json()
    return data.default_branch || 'main'
  }
  return 'main'
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      client_id,
      client_slug,
      client_name,
      template_id,
      slug,
      copy_slots,
      sections,
      brand_kit,
      media_assets,
      avatar_id,
      offer_id,
    } = await req.json()

    if (!client_id || !client_slug || !template_id || !slug) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_id, client_slug, template_id, copy_slots, slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ─── Step 1: Save to published_pages table ───
    const insertPayload: Record<string, unknown> = {
      client_id,
      client_slug,
      template_slug: template_id,
      slug,
      copy_slots: copy_slots || {},
      sections: sections || null,
      media_assets: media_assets || {},
      brand_kit_snapshot: brand_kit || {},
      status: 'published',
      published_at: new Date().toISOString(),
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (avatar_id && uuidRegex.test(avatar_id)) insertPayload.avatar_id = avatar_id
    if (offer_id && uuidRegex.test(offer_id)) insertPayload.offer_id = offer_id

    const { data: savedPage, error: saveError } = await supabase
      .from('published_pages')
      .insert(insertPayload)
      .select()
      .single()

    if (saveError) {
      if (saveError.code === '23505') {
        return new Response(
          JSON.stringify({ error: `Slug "${slug}" already exists for this client. Choose a different slug.` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Failed to save published page: ${saveError.message}`)
    }

    const previewUrl = `${HUB_URL}/p/${client_slug}/${slug}`

    // ─── Step 2: Create/update GitHub repo with full template + page data ───
    let githubRepo = ''
    let githubUrl = ''

    if (GITHUB_TOKEN) {
      const clientRepoName = `${client_slug}-pages`
      const clientRepoFull = `${TEMPLATE_REPO_OWNER}/${clientRepoName}`

      // Check if client repo exists
      const repoCheck = await fetch(`https://api.github.com/repos/${clientRepoFull}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
      })
      const repoExists = repoCheck.status === 200

      if (!repoExists) {
        // Create repo from template — gets FULL copy of template code, CSS, components
        console.log(`Creating repo ${clientRepoFull} from template...`)
        const createRes = await fetch(
          `https://api.github.com/repos/${TEMPLATE_REPO_OWNER}/${TEMPLATE_REPO_NAME}/generate`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.baptiste-preview+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              owner: TEMPLATE_REPO_OWNER,
              name: clientRepoName,
              description: `Landing pages for ${client_name || client_slug}`,
              private: true,
            }),
          }
        )
        if (!createRes.ok) {
          const err = await createRes.text()
          console.error(`Failed to create repo (non-fatal): ${err}`)
        } else {
          // Wait for repo to be ready
          await new Promise(r => setTimeout(r, 4000))
        }
      }

      // Detect the default branch
      const branch = await getDefaultBranch(clientRepoFull)

      // Generate page data file (replaces sample-data.ts with actual content)
      const pageDataContent = generatePageDataFile(
        slug,
        template_id,
        copy_slots || {},
        brand_kit || {},
        media_assets || {},
        sections,
      )

      // Generate page route file
      const pageRouteContent = generatePageRouteFile(slug)

      // Push files to repo
      const commitMsg = `Add landing page: ${slug}`

      // 1. Replace sample-data with actual page data
      await pushFileToRepo(clientRepoFull, 'src/lib/page-data.ts', pageDataContent, commitMsg, branch)

      // 2. Create the page route (renders at / by replacing test-page or adding new route)
      await pushFileToRepo(clientRepoFull, `src/app/${slug}/page.tsx`, pageRouteContent, `Add page route: /${slug}`, branch)

      // 3. Update the home page to link to this page
      const homePageContent = `import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center max-w-lg mx-auto px-4">
        <h1 className="text-4xl font-bold mb-4">${client_name || client_slug} Landing Pages</h1>
        <p className="text-gray-400 mb-8">Preview and edit landing pages</p>
        <div className="space-y-3">
          <Link
            href="/${slug}"
            className="block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
          >
            ${slug} — Preview
          </Link>
        </div>
      </div>
    </div>
  )
}
`
      await pushFileToRepo(clientRepoFull, 'src/app/page.tsx', homePageContent, `Update home page with ${slug} link`, branch)

      // 4. Push page data as JSON for webhook-based editing sync
      const pageJsonData = JSON.stringify({
        slug,
        template_slug: template_id || 'lead-capture-classic',
        sections: sections || copySlotsToSections(copy_slots || {}),
        copy_slots: copy_slots || {},
        media_assets: media_assets || {},
        brand_kit: brand_kit || {},
        avatar_id: avatar_id || null,
        offer_id: offer_id || null,
        updated_at: new Date().toISOString(),
      }, null, 2)
      await pushFileToRepo(clientRepoFull, `pages/${slug}.json`, pageJsonData, `Add page data: ${slug}`, branch)

      // 5. Push CLAUDE.md with editing instructions
      const claudeMd = `# ${client_name || client_slug} Landing Pages

## Editing Pages

Each page has a JSON data file in the \`pages/\` directory. Edit the JSON to update the live page.

### File Structure
\`\`\`
pages/
  ${slug}.json    ← Edit this to update the live page
\`\`\`

### How It Works
1. Edit the JSON file (sections, copy, media URLs)
2. Commit and push to this repo
3. A webhook automatically syncs changes to the live page at:
   ${HUB_URL}/p/${client_slug}/${slug}

### Section Types
- \`hero\` — Headline, subheadline, CTA, trust line
- \`feature_cards\` — Value prop cards with icons
- \`two_column_info\` — Details grid with CTA
- \`steps\` — Process steps (how it works)
- \`trust_bar\` — Stats overlay on parallax background
- \`benefits_grid\` — Benefit cards with icons
- \`testimonials\` — Customer quotes (real only)
- \`faq\` — Accordion Q&A
- \`footer\` — Links, phone, social
`
      await pushFileToRepo(clientRepoFull, 'CLAUDE.md', claudeMd, `Add editing instructions`, branch)

      githubRepo = clientRepoFull
      githubUrl = `https://github.com/${clientRepoFull}`

      // Update clients table with repo info
      await supabase
        .from('clients')
        .update({ github_repo: clientRepoFull })
        .eq('id', client_id)

      // Set up webhook for page data sync (only on new repos)
      if (!repoExists) {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        try {
          const webhookRes = await fetch(
            `https://api.github.com/repos/${clientRepoFull}/hooks`,
            {
              method: 'POST',
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: 'web',
                active: true,
                events: ['push'],
                config: {
                  url: `${SUPABASE_URL}/functions/v1/github-webhook`,
                  content_type: 'json',
                },
              }),
            }
          )
          if (!webhookRes.ok) {
            console.error('Failed to create webhook (non-fatal):', await webhookRes.text())
          }
        } catch (e) {
          console.error('Webhook setup failed (non-fatal):', e)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        preview_url: previewUrl,
        github_repo: githubRepo || null,
        github_url: githubUrl || null,
        published_page: savedPage,
        message: `Page published! Live at ${previewUrl}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Deploy error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Deploy failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
