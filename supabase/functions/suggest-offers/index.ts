// Prompt 8: Suggest Offers (Offers Page)
// Trigger: User clicks "Suggest Offers" on the Offers page
// Returns: 2-4 new offer suggestions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior marketing strategist specializing in offer creation for local service businesses and lead generation campaigns. Your job is to suggest high-converting offers based on the client's business, audience, and competitive landscape.

RULES:
- Suggest 2–4 offers that are DIFFERENT from existing offers.
- Each offer should target a specific conversion scenario: some for cold traffic (low commitment), some for warm traffic (higher commitment).
- Include at least one "no-brainer" low-barrier offer (free inspection, free quote, free consultation).
- Include at least one offer that creates urgency (seasonal, limited, deadline-driven).
- Consider what competitors are offering and suggest something that differentiates.
- Every offer must be realistic and deliverable by this specific business.
- NEVER use em dashes (—) in any generated text. Use commas, periods, colons, or separate sentences instead.
- Benefits must be SHORT bullet points (5-10 words each), suitable for banners and landing pages.

Respond ONLY with valid JSON array of offer objects matching the offers schema.`

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

    const response = await callClaude(SYSTEM_PROMPT, userMessage)
    const parsed = parseJsonResponse<{
      suggested_offers: Array<Record<string, unknown>>
    }>(response)

    return jsonResponse(parsed)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
