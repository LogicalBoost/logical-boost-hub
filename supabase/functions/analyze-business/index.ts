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
      model: 'claude-sonnet-4-6',
      maxTokens: 8192,
    })

    const parsed = parseJsonResponse<{
      business_summary: string
      services: string
      differentiators: string
      trust_signals: string
      tone: string
      avatars: Array<Record<string, unknown>>
      offers: Array<Record<string, unknown>>
    }>(response)

    // Update client record
    await supabase.from('clients').update({
      business_summary: parsed.business_summary,
      services: parsed.services,
      differentiators: parsed.differentiators,
      trust_signals: parsed.trust_signals,
      tone: parsed.tone,
      website: website_url,
      updated_at: new Date().toISOString(),
    }).eq('id', client_id)

    // Insert avatars
    if (parsed.avatars?.length) {
      const avatarRecords = parsed.avatars.map(a => ({
        client_id,
        name: a.name,
        avatar_type: a.avatar_type,
        description: a.description,
        pain_points: a.pain_points,
        motivations: a.motivations,
        objections: a.objections,
        desired_outcome: a.desired_outcome,
        trigger_events: a.trigger_events,
        messaging_style: a.messaging_style,
        preferred_platforms: a.preferred_platforms,
        recommended_angles: a.recommended_angles,
        status: 'approved',
      }))
      await supabase.from('avatars').insert(avatarRecords)
    }

    // Insert offers
    if (parsed.offers?.length) {
      const offerRecords = parsed.offers.map(o => ({
        client_id,
        name: o.name,
        offer_type: o.offer_type,
        headline: o.headline,
        subheadline: o.subheadline,
        description: o.description,
        primary_cta: o.primary_cta,
        conversion_type: o.conversion_type,
        benefits: o.benefits,
        proof_elements: o.proof_elements,
        urgency_elements: o.urgency_elements,
        faq: o.faq,
        landing_page_type: o.landing_page_type,
        status: 'approved',
      }))
      await supabase.from('offers').insert(offerRecords)
    }

    return jsonResponse({
      success: true,
      avatars_created: parsed.avatars?.length || 0,
      offers_created: parsed.offers?.length || 0,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
