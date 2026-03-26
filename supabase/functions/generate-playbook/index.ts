// Generate Industry Playbook for Landing Page Creation
// Synthesizes competitive analysis, brand kit, client data, and approved avatars/offers
// into actionable patterns, gaps, and concept briefs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior landing page strategist at a performance marketing agency. You have deep expertise in conversion rate optimization, direct response copywriting, and competitive analysis.

You are generating an Industry Playbook that will guide the creation of high-converting landing pages for a client. You have been given:
- The client's business data (summary, services, differentiators, trust signals, tone)
- Their brand kit (colors, fonts, logo, style guidelines)
- Approved audience avatars (target segments with pain points, motivations, objections)
- Approved offers (conversion offers with headlines, CTAs, benefits)
- Competitor intelligence (especially landing page analyses)

Your job is to synthesize ALL of this into a strategic playbook that identifies industry patterns, market gaps, and concrete landing page concepts.

You must produce a JSON object with this exact structure:

{
  "industry_patterns": {
    "above_fold_patterns": ["What most competitors do above the fold"],
    "common_sections": ["Sections that appear on most competitor pages"],
    "dominant_cta_styles": ["Most common CTA approaches"],
    "proof_patterns": ["How competitors present social proof and trust"],
    "pricing_patterns": ["How pricing and offers are presented"]
  },
  "market_gaps": [
    { "gap": "Description of what competitors miss", "opportunity": "How to exploit this" }
  ],
  "strategic_recommendations": [
    { "recommendation": "What to do", "rationale": "Why this works", "priority": "high|medium|low" }
  ],
  "concept_briefs": [
    {
      "name": "Concept name",
      "strategy": "1-2 sentence strategy description",
      "above_fold": "What the hero section should contain",
      "key_sections": ["List of page sections in order"],
      "tone": "Tone description",
      "differentiator": "What makes this concept unique vs competitors"
    }
  ],
  "copy_direction": {
    "headline_angles": ["Best headline approaches for this market"],
    "proof_strategy": "How to present proof and trust signals",
    "urgency_approach": "What urgency tactics fit this market",
    "cta_recommendations": ["CTA text and style recommendations"]
  }
}

CONCEPT BRIEFS RULES:
You must generate exactly 4 concept briefs:
1. "Proven Pattern, Clean" - Uses the dominant market formula but executed sharper, cleaner, and more professionally than competitors.
2. "Proven Pattern, Bold" - Same proven strategy but with bolder visuals, stronger urgency, and more aggressive positioning.
3. "Gap Play" - Exploits the biggest gap that competitors miss. This is the contrarian play.
4. "Aggressive DR" - Pure direct response conversion machine. Maximum CTAs, stacked proof, urgency everywhere. Built to convert cold traffic.

ANALYSIS RULES:
- Be specific to THIS industry and THIS client. No generic advice.
- Reference actual competitor patterns you see in the data.
- Every recommendation must tie back to something in the competitive data or client strengths.
- Market gaps should be genuine missed opportunities, not trivial observations.
- Prioritize recommendations by impact on conversion rate.

FORMATTING RULES:
- NEVER use em dashes in any generated text. Use commas, periods, colons, or separate sentences instead.
- Keep descriptions concise and actionable.
- Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id } = await req.json()

    if (!client_id) {
      return errorResponse('client_id is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    if (clientError || !client) {
      return errorResponse(`Client not found: ${clientError?.message || 'No data'}`)
    }

    // Fetch approved avatars
    const { data: avatars } = await supabase
      .from('avatars')
      .select('*')
      .eq('client_id', client_id)
      .eq('status', 'approved')

    // Fetch approved offers
    const { data: offers } = await supabase
      .from('offers')
      .select('*')
      .eq('client_id', client_id)
      .eq('status', 'approved')

    // Fetch competitor intel (all, with emphasis on landing pages)
    const { data: competitors } = await supabase
      .from('competitor_intel')
      .select('*')
      .eq('client_id', client_id)

    const landingPageCompetitors = competitors?.filter(c => c.ad_type === 'landing_page') || []
    const otherCompetitors = competitors?.filter(c => c.ad_type !== 'landing_page') || []

    // Build the user message with all context
    const userMessage = `CLIENT BUSINESS DATA:

Name: ${client.name || 'N/A'}
Website: ${client.website || 'N/A'}
Business Summary: ${client.business_summary || 'Not available'}
Services: ${client.services || 'Not available'}
Differentiators: ${client.differentiators || 'Not available'}
Trust Signals: ${client.trust_signals || 'Not available'}
Tone: ${client.tone || 'Not available'}

BRAND KIT:
${client.brand_kit ? JSON.stringify(client.brand_kit, null, 2) : 'No brand kit available'}

APPROVED AVATARS (${avatars?.length || 0}):
${avatars?.length ? avatars.map((a, i) => `
Avatar ${i + 1}: ${a.name}
Type: ${a.avatar_type || 'N/A'}
Description: ${a.description || 'N/A'}
Pain Points: ${a.pain_points || 'N/A'}
Motivations: ${a.motivations || 'N/A'}
Objections: ${a.objections || 'N/A'}
Desired Outcome: ${a.desired_outcome || 'N/A'}
Trigger Events: ${a.trigger_events || 'N/A'}
Messaging Style: ${a.messaging_style || 'N/A'}
`).join('\n') : 'No approved avatars yet.'}

APPROVED OFFERS (${offers?.length || 0}):
${offers?.length ? offers.map((o, i) => `
Offer ${i + 1}: ${o.name}
Type: ${o.offer_type || 'N/A'}
Headline: ${o.headline || 'N/A'}
Subheadline: ${o.subheadline || 'N/A'}
Description: ${o.description || 'N/A'}
Primary CTA: ${o.primary_cta || 'N/A'}
Conversion Type: ${o.conversion_type || 'N/A'}
Benefits: ${Array.isArray(o.benefits) ? o.benefits.join(', ') : o.benefits || 'N/A'}
Proof Elements: ${Array.isArray(o.proof_elements) ? o.proof_elements.join(', ') : o.proof_elements || 'N/A'}
Urgency Elements: ${Array.isArray(o.urgency_elements) ? o.urgency_elements.join(', ') : o.urgency_elements || 'N/A'}
Landing Page Type: ${o.landing_page_type || 'N/A'}
`).join('\n') : 'No approved offers yet.'}

COMPETITOR LANDING PAGE ANALYSES (${landingPageCompetitors.length}):
${landingPageCompetitors.length ? landingPageCompetitors.map((c, i) => `
Competitor LP ${i + 1}: ${c.competitor_name || c.name || 'Unknown'}
URL: ${c.url || 'N/A'}
Analysis: ${c.analysis || c.notes || 'N/A'}
Strengths: ${c.strengths || 'N/A'}
Weaknesses: ${c.weaknesses || 'N/A'}
`).join('\n') : 'No landing page competitor data available.'}

OTHER COMPETITOR INTEL (${otherCompetitors.length}):
${otherCompetitors.length ? otherCompetitors.map((c, i) => `
Competitor ${i + 1}: ${c.competitor_name || c.name || 'Unknown'}
Type: ${c.ad_type || 'N/A'}
URL: ${c.url || 'N/A'}
Analysis: ${c.analysis || c.notes || 'N/A'}
`).join('\n') : 'No other competitor data available.'}

Based on all the above data, generate a comprehensive Industry Playbook for this client's landing page strategy. Identify patterns across competitors, find gaps to exploit, and produce 4 distinct concept briefs as specified.`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
    })

    const parsed = parseJsonResponse<Record<string, unknown>>(response)

    // Save playbook to client record
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        landing_page_playbook: parsed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client_id)

    if (updateError) {
      console.error('Playbook save error:', JSON.stringify(updateError))
    }

    return jsonResponse({
      success: true,
      playbook: parsed,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
