// Prompt 8: Suggest Offers (Offers Page)
// Trigger: User clicks "Suggest Offers" on the Offers page
// Returns: 2-4 new offer suggestions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse, getCustomPrompt } from '../_shared/ai-client.ts'

const DEFAULT_SYSTEM_PROMPT = `You are a senior marketing strategist specializing in offer creation for local service businesses and lead generation campaigns. Your job is to suggest high-converting offers based on the client's business, audience, and competitive landscape.

RULES:
- Suggest 2–4 offers that are DIFFERENT from existing offers.
- Each offer should target a specific conversion scenario: some for cold traffic (low commitment), some for warm traffic (higher commitment).
- Include at least one "no-brainer" low-barrier offer (free inspection, free quote, free consultation).
- Include at least one offer that creates urgency (seasonal, limited, deadline-driven).
- Consider what competitors are offering and suggest something that differentiates.
- Every offer must be realistic and deliverable by this specific business.
- NEVER use em dashes (—) in any generated text. Use commas, periods, colons, or separate sentences instead.
- Benefits must be SHORT bullet points (5-10 words each), suitable for banners and landing pages.

Respond ONLY with valid JSON object: { "offers": [ { "name": "...", "offer_type": "...", "headline": "...", "subheadline": "...", "description": "...", "primary_cta": "...", "conversion_type": "...", "benefits": ["..."], "proof_elements": ["..."], "urgency_elements": ["..."], "faq": [{"question": "...", "answer": "..."}], "landing_page_type": "..." } ] }

No markdown, no explanation outside the JSON.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id } = await req.json()
    if (!client_id) return errorResponse('client_id is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: client } = await supabase.from('clients').select('*').eq('id', client_id).single()
    const { data: offers } = await supabase.from('offers').select('*').eq('client_id', client_id).eq('status', 'approved')
    const { data: avatars } = await supabase.from('avatars').select('*').eq('client_id', client_id).eq('status', 'approved')

    if (!client) return errorResponse('Client not found')

    // Try custom prompt, fall back to default
    const customPrompt = await getCustomPrompt(supabase, client_id, 'suggest_offers')
    const systemPrompt = customPrompt || DEFAULT_SYSTEM_PROMPT

    const existingOffers = (offers || []).map((o: Record<string, unknown>) => `- ${o.name} (${o.offer_type}): ${o.description}`).join('\n')
    const avatarContext = (avatars || []).map((a: Record<string, unknown>) => `- ${a.name}: ${a.pain_points}`).join('\n')

    const userMessage = `BUSINESS:
Company: ${client.name}
Summary: ${client.business_summary}
Services: ${client.services}
Differentiators: ${client.differentiators}
Trust Signals: ${client.trust_signals}

EXISTING OFFERS (DO NOT DUPLICATE):
${existingOffers || 'None yet'}

EXISTING AVATARS:
${avatarContext || 'None yet'}

COMPETITOR INFO:
${client.competitors ? JSON.stringify(client.competitors) : 'None yet'}`

    const response = await callClaude(systemPrompt, userMessage)

    // Handle both array and object responses from AI
    let offersData: Array<Record<string, unknown>>
    try {
      const parsed = parseJsonResponse<Record<string, unknown>>(response)
      // AI might return { offers: [...] } or { suggested_offers: [...] }
      offersData = (parsed.offers || parsed.suggested_offers || []) as Array<Record<string, unknown>>
    } catch {
      // If parseJsonResponse fails, try parsing as array directly
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const raw = JSON.parse(cleaned)
      offersData = Array.isArray(raw) ? raw : (raw.offers || raw.suggested_offers || [])
    }

    // Insert offers into database
    if (offersData.length > 0) {
      const records = offersData.map(o => ({
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

      const { error: insertError } = await supabase.from('offers').insert(records)
      if (insertError) {
        console.error('Offer insert error:', JSON.stringify(insertError))
        return errorResponse(`Failed to insert offers: ${insertError.message}`)
      }
    }

    return jsonResponse({ success: true, offers_created: offersData.length })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
