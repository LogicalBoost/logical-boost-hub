// Prompt 1: Analyze Business (Workflow 1)
// Trigger: New client setup — team provides website, call notes, etc.
// Returns: business_summary, services, differentiators, trust_signals, tone, avatars, offers

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior marketing strategist at a performance marketing agency. You are analyzing a new client's business to build the foundation for their entire campaign system.

Your job is to extract and synthesize everything relevant about this business into structured data that will power all downstream marketing — avatars, offers, ad copy, landing pages, video scripts, and creatives.

You must produce:

1. BUSINESS SUMMARY — A concise 2–3 paragraph overview of what this company does, who they serve, and what makes them notable.

2. SERVICES — A clear list of what the business offers. Be specific.

3. DIFFERENTIATORS — What makes this company different from competitors.

4. TRUST SIGNALS — Specific credibility elements: awards, certifications, years in business, number of projects, ratings, partnerships.

5. TONE — Describe the brand's voice. Provide 3–5 tone descriptors and a one-sentence summary.

6. INITIAL AVATARS — Generate 2–4 distinct audience segments with ALL fields: name, avatar_type, description, pain_points, motivations, objections, desired_outcome, trigger_events, messaging_style, preferred_platforms, recommended_angles.

7. INITIAL OFFERS — Suggest 2–4 conversion offers with ALL fields: name, offer_type, headline, subheadline, description, primary_cta, conversion_type, benefits, proof_elements, urgency_elements, faq, landing_page_type.

FORMATTING RULES:
- NEVER use em dashes (—) in any generated text. Use commas, periods, colons, or separate sentences instead.
- Benefits must be SHORT bullet points (5-10 words each), suitable for banners and landing pages.

Be thorough. Be specific. No generic filler.
Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, website_url, call_notes, landing_page_content, team_notes } = await req.json()

    if (!client_id) {
      return errorResponse('client_id is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const userMessage = `CLIENT INPUTS:

Website URL: ${website_url || 'Not provided'}
Website Content: ${landing_page_content || 'Not provided'}

Call Notes:
${call_notes || 'None provided'}

Additional Notes from Team:
${team_notes || 'None provided'}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, {
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 8192,
    })

    const rawParsed = parseJsonResponse<Record<string, unknown>>(response)

    // The AI may nest everything under a top-level key (e.g. "client_analysis")
    // Unwrap it if needed
    const keys = Object.keys(rawParsed)
    const parsed = (keys.length === 1 && typeof rawParsed[keys[0]] === 'object' && !Array.isArray(rawParsed[keys[0]]))
      ? rawParsed[keys[0]] as Record<string, unknown>
      : rawParsed

    // Extract fields, handling nested structures like "initial_avatars" or "avatars"
    const businessSummary = parsed.business_summary as string || ''
    const services = parsed.services as string || ''
    const differentiators = parsed.differentiators as string || ''
    const trustSignals = parsed.trust_signals as string || ''
    const tone = parsed.tone as string || ''
    const avatarsData = (parsed.avatars || parsed.initial_avatars || []) as Array<Record<string, unknown>>
    const offersData = (parsed.offers || parsed.initial_offers || []) as Array<Record<string, unknown>>

    // Update client record
    await supabase.from('clients').update({
      business_summary: businessSummary,
      services: typeof services === 'string' ? services : JSON.stringify(services),
      differentiators: typeof differentiators === 'string' ? differentiators : JSON.stringify(differentiators),
      trust_signals: typeof trustSignals === 'string' ? trustSignals : JSON.stringify(trustSignals),
      tone: typeof tone === 'string' ? tone : JSON.stringify(tone),
      website: website_url,
      updated_at: new Date().toISOString(),
    }).eq('id', client_id)

    // Insert avatars
    let avatarsCreated = 0
    if (avatarsData?.length) {
      const avatarRecords = avatarsData.map(a => ({
        client_id,
        name: String(a.name || 'Unnamed Avatar'),
        avatar_type: a.avatar_type ? String(a.avatar_type) : null,
        description: a.description ? String(a.description) : null,
        pain_points: a.pain_points ? String(a.pain_points) : null,
        motivations: a.motivations ? String(a.motivations) : null,
        objections: a.objections ? String(a.objections) : null,
        desired_outcome: a.desired_outcome ? String(a.desired_outcome) : null,
        trigger_events: a.trigger_events ? String(a.trigger_events) : null,
        messaging_style: a.messaging_style ? String(a.messaging_style) : null,
        preferred_platforms: Array.isArray(a.preferred_platforms) ? a.preferred_platforms : null,
        recommended_angles: Array.isArray(a.recommended_angles) ? a.recommended_angles : null,
        status: 'approved',
      }))
      const { error: avatarError } = await supabase.from('avatars').insert(avatarRecords)
      if (avatarError) {
        console.error('Avatar insert error:', JSON.stringify(avatarError))
      } else {
        avatarsCreated = avatarRecords.length
      }
    }

    // Insert offers
    let offersCreated = 0
    if (offersData?.length) {
      const offerRecords = offersData.map(o => ({
        client_id,
        name: String(o.name || 'Unnamed Offer'),
        offer_type: o.offer_type ? String(o.offer_type) : null,
        headline: o.headline ? String(o.headline) : null,
        subheadline: o.subheadline ? String(o.subheadline) : null,
        description: o.description ? String(o.description) : null,
        primary_cta: o.primary_cta ? String(o.primary_cta) : null,
        conversion_type: o.conversion_type ? String(o.conversion_type) : null,
        benefits: Array.isArray(o.benefits) ? o.benefits : null,
        proof_elements: Array.isArray(o.proof_elements) ? o.proof_elements : null,
        urgency_elements: Array.isArray(o.urgency_elements) ? o.urgency_elements : null,
        faq: Array.isArray(o.faq) ? o.faq : null,
        landing_page_type: o.landing_page_type ? String(o.landing_page_type) : null,
        status: 'approved',
      }))
      const { error: offerError } = await supabase.from('offers').insert(offerRecords)
      if (offerError) {
        console.error('Offer insert error:', JSON.stringify(offerError))
      } else {
        offersCreated = offerRecords.length
      }
    }

    return jsonResponse({
      success: true,
      avatars_created: avatarsCreated,
      offers_created: offersCreated,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
