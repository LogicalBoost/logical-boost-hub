// Generate Landing Page — creates structured section data + rendered HTML
// for a specific avatar/offer/template combination

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import { COPYWRITER_IDENTITY, QUALITY_RULES, FORMATTING_RULES, FTC_COMPLIANCE } from '../_shared/copywriter-prompts.ts'
import { renderLandingPage } from '../_shared/template-renderer.ts'

// Template section orders
const TEMPLATE_SECTIONS: Record<string, string[]> = {
  clean_authority: ['hero', 'problem', 'solution', 'benefits', 'proof', 'faq', 'final_cta'],
  bold_conversion: ['hero', 'urgency_bar', 'trust_strip', 'problem', 'solution', 'benefits', 'proof', 'faq', 'final_cta'],
  gap_play: ['hero', 'problem', 'process_steps', 'benefits', 'proof', 'faq', 'final_cta'],
  aggressive_dr: ['hero', 'urgency_bar', 'trust_strip', 'benefits', 'proof', 'problem', 'process_steps', 'proof', 'faq', 'final_cta'],
}

// Content shape descriptions per section type for the prompt
const SECTION_CONTENT_SHAPES: Record<string, string> = {
  hero: `"headline": "...", "subheadline": "...", "cta": "...", "trust_items": ["50+ Happy Clients", "4.9 Rating", "Free Consultation"]`,
  problem: `"headline": "...", "content": "2-3 paragraphs describing the prospect's pain points and current frustrations"`,
  solution: `"headline": "...", "content": "2-3 paragraphs positioning the offer as the solution", "features": [{"title": "...", "description": "..."}]`,
  benefits: `"headline": "...", "items": [{"title": "Benefit Name", "description": "1-2 sentences on why this matters"}] (4-6 items)`,
  proof: `"headline": "...", "testimonials": [{"quote": "...", "author": "...", "role": "..."}], "stats": [{"number": "500+", "label": "Clients Served"}]`,
  faq: `"headline": "...", "items": [{"question": "...", "answer": "..."}] (4-6 items)`,
  final_cta: `"headline": "...", "subheadline": "...", "cta": "...", "urgency_text": "..."`,
  urgency_bar: `"text": "Limited time offer text or deadline-driven message"`,
  trust_strip: `"items": ["Trust badge or credential 1", "Trust badge 2", "Trust badge 3", "Trust badge 4"]`,
  process_steps: `"headline": "...", "steps": [{"step_number": 1, "title": "...", "description": "..."}] (3-4 steps)`,
}

function buildSectionSchema(templateId: string): string {
  const sectionTypes = TEMPLATE_SECTIONS[templateId]
  if (!sectionTypes) return ''

  // Track duplicate types for unique IDs (e.g. aggressive_dr has two "proof" sections)
  const typeCounts: Record<string, number> = {}

  return sectionTypes.map((type, i) => {
    typeCounts[type] = (typeCounts[type] || 0) + 1
    const id = `${type}_${typeCounts[type]}`
    const shape = SECTION_CONTENT_SHAPES[type] || `"headline": "...", "content": "..."`
    return `    {
      "id": "${id}",
      "type": "${type}",
      "order": ${i + 1},
      "content": { ${shape} }
    }`
  }).join(',\n')
}

const SYSTEM_PROMPT = (templateId: string) => `${COPYWRITER_IDENTITY}

${QUALITY_RULES}

${FORMATTING_RULES}

${FTC_COMPLIANCE}

You are now generating structured content for a high-converting landing page. You have been given a specific template layout, a target avatar, an offer, brand voice information, and existing approved copy components to draw from.

YOUR TASK:
Generate the content for every section of the landing page according to the template structure below. Each section must have a specific JSON shape.

TEMPLATE: "${templateId}"
SECTIONS (in order):
${buildSectionSchema(templateId)}

You must produce a JSON object with this exact structure:

{
  "sections": [
${buildSectionSchema(templateId)}
  ],
  "meta": {
    "headline": "The primary page headline (same as hero headline)",
    "subheadline": "The primary page subheadline (same as hero subheadline)",
    "cta": "The primary CTA text (same as hero CTA)"
  }
}

LANDING PAGE COPY RULES:
- Write for progressive conviction: hero hooks them, problem validates their pain, solution gives hope, benefits stack value, proof removes doubt, CTA converts.
- Every section must flow naturally into the next. The page is a single persuasion arc.
- Use the avatar's language and pain points throughout. Mirror their words.
- Reference specific details from the business data: real services, real differentiators, real proof.
- CTAs should be action-specific, not generic. "Get My Free Roof Quote" not "Learn More".
- Keep paragraphs short (2-3 sentences max). Use white space for readability.
- Proof section must ONLY reference real data provided. Do not fabricate testimonials or statistics.
- NEVER use em dashes. Use commas, periods, colons, or separate sentences instead.

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, avatar_id, offer_id, template_id, concept_brief_index } = await req.json()

    if (!client_id || !avatar_id || !offer_id || !template_id) {
      return errorResponse('client_id, avatar_id, offer_id, and template_id are required')
    }

    if (!TEMPLATE_SECTIONS[template_id]) {
      return errorResponse(`Invalid template_id: ${template_id}. Must be one of: ${Object.keys(TEMPLATE_SECTIONS).join(', ')}`)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch all required data in parallel
    const [clientRes, avatarRes, offerRes, copyRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('avatars').select('*').eq('id', avatar_id).single(),
      supabase.from('offers').select('*').eq('id', offer_id).single(),
      supabase.from('copy_components').select('*')
        .eq('client_id', client_id)
        .eq('status', 'approved')
        .in('component_type', ['headline', 'subheadline', 'google_headline', 'primary_text', 'cta', 'benefit', 'proof_item'])
        .limit(100),
    ])

    if (clientRes.error || !clientRes.data) {
      return errorResponse(`Client not found: ${clientRes.error?.message || 'No data'}`)
    }
    if (avatarRes.error || !avatarRes.data) {
      return errorResponse(`Avatar not found: ${avatarRes.error?.message || 'No data'}`)
    }
    if (offerRes.error || !offerRes.data) {
      return errorResponse(`Offer not found: ${offerRes.error?.message || 'No data'}`)
    }

    const client = clientRes.data
    const avatar = avatarRes.data
    const offer = offerRes.data
    const copyComponents = copyRes.data || []

    // Get concept brief if index provided
    let conceptBrief = null
    if (concept_brief_index !== undefined && concept_brief_index !== null && client.landing_page_playbook?.concept_briefs) {
      conceptBrief = client.landing_page_playbook.concept_briefs[concept_brief_index] || null
    }

    // Group copy components by type for the prompt
    const copyByType: Record<string, string[]> = {}
    for (const comp of copyComponents) {
      const type = comp.component_type
      if (!copyByType[type]) copyByType[type] = []
      copyByType[type].push(comp.content)
    }

    // Build user message with all context
    const userMessage = `BUSINESS CONTEXT:

Name: ${client.name || 'N/A'}
Website: ${client.website || 'N/A'}
Business Summary: ${client.business_summary || 'Not available'}
Services: ${client.services || 'Not available'}
Differentiators: ${client.differentiators || 'Not available'}
Trust Signals: ${client.trust_signals || 'Not available'}
Tone: ${client.tone || 'Not available'}
Ad Copy Rules: ${client.ad_copy_rules || 'Not available'}

BRAND KIT:
${client.brand_kit ? JSON.stringify(client.brand_kit, null, 2) : 'No brand kit available'}

TARGET AVATAR:
Name: ${avatar.name}
Type: ${avatar.avatar_type || 'N/A'}
Description: ${avatar.description || 'N/A'}
Pain Points: ${avatar.pain_points || 'N/A'}
Motivations: ${avatar.motivations || 'N/A'}
Objections: ${avatar.objections || 'N/A'}
Desired Outcome: ${avatar.desired_outcome || 'N/A'}
Trigger Events: ${avatar.trigger_events || 'N/A'}
Messaging Style: ${avatar.messaging_style || 'N/A'}

OFFER:
Name: ${offer.name}
Headline: ${offer.headline || 'N/A'}
Subheadline: ${offer.subheadline || 'N/A'}
Description: ${offer.description || 'N/A'}
Primary CTA: ${offer.primary_cta || 'N/A'}
Conversion Type: ${offer.conversion_type || 'N/A'}
Benefits: ${Array.isArray(offer.benefits) ? offer.benefits.join(', ') : offer.benefits || 'N/A'}
Proof Elements: ${Array.isArray(offer.proof_elements) ? offer.proof_elements.join(', ') : offer.proof_elements || 'N/A'}
Urgency Elements: ${Array.isArray(offer.urgency_elements) ? offer.urgency_elements.join(', ') : offer.urgency_elements || 'N/A'}
FAQ: ${Array.isArray(offer.faq) ? offer.faq.map((f: { q: string; a: string }) => `Q: ${f.q} A: ${f.a}`).join(' | ') : offer.faq || 'N/A'}
Landing Page Type: ${offer.landing_page_type || 'N/A'}

EXISTING APPROVED COPY COMPONENTS (use these as raw material and inspiration):
${Object.entries(copyByType).map(([type, items]) => `
${type.toUpperCase()} (${items.length}):
${items.slice(0, 15).map((item, i) => `  ${i + 1}. ${item}`).join('\n')}
`).join('\n')}
${conceptBrief ? `
CONCEPT BRIEF (strategic direction for this page):
Name: ${conceptBrief.name || 'N/A'}
Strategy: ${conceptBrief.strategy || 'N/A'}
Above the Fold: ${conceptBrief.above_fold || 'N/A'}
Key Sections: ${Array.isArray(conceptBrief.key_sections) ? conceptBrief.key_sections.join(', ') : 'N/A'}
Tone: ${conceptBrief.tone || 'N/A'}
Differentiator: ${conceptBrief.differentiator || 'N/A'}
` : ''}
TEMPLATE: ${template_id}

Generate the complete landing page content for the "${template_id}" template, targeting the "${avatar.name}" avatar with the "${offer.name}" offer. Make every section specific, persuasive, and on-brand.`

    const response = await callClaude(SYSTEM_PROMPT(template_id), userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
    })

    const parsed = parseJsonResponse<{ sections: unknown[]; meta: { headline: string; subheadline: string; cta: string } }>(response)

    // Render HTML from section data
    const pageHtml = renderLandingPage(template_id, parsed.sections as any[], client.brand_kit || {}, offer, client.name, client.logo_url)

    // Insert landing page record
    const { data: landingPage, error: insertError } = await supabase
      .from('landing_pages')
      .insert({
        client_id,
        avatar_id,
        offer_id,
        template_id,
        section_data: parsed.sections,
        page_html: pageHtml,
        headline: parsed.meta?.headline || '',
        subheadline: parsed.meta?.subheadline || '',
        cta: parsed.meta?.cta || '',
        brand_kit_snapshot: client.brand_kit || {},
        deploy_status: 'draft',
        status: 'approved',
        funnel_instance_id: null,
        copy_component_ids: [],
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
