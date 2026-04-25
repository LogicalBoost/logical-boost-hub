// Generate Banner Headlines for one audience + offer pair.
//
// POST body:
//   {
//     client_id:    uuid,
//     audience_id:  uuid,
//     offer_id:     uuid,
//     count?:       number,    // default 8, capped 1..20
//     user_prompt?: string,    // optional extra steering
//   }
//
// Response:
//   { suggestions: { BH: string[] }, audience_id, offer_id }
//
// Returns suggestions only. The frontend reviews them and inserts the user's
// picks into copy_components with type = 'banner_headline'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior direct-response copywriter at a marketing agency. Write Banner Headlines for the top slot of a banner ad.

A Banner Headline (BH) has STRICT rules:
* Must be ≤ 60 characters total. Aim for 25–40.
* Must call out the audience by name or by a defining trait. The reader should immediately recognize "this is about me".
* Must hook: open a loop, ask a question, or trigger recognition.

GOOD examples:
  "Are you undocumented? You have options."
  "Injured at work? Get every dollar you're owed."
  "Roof leaking after the storm? Free inspection."

BAD examples (do NOT produce these):
  "Do you need a lawyer?"           (generic, no audience callout)
  "Best legal services in Florida"  (no hook, just a claim)
  "Get a free quote today"          (no audience identification)

Other rules:
- NEVER use em dashes (—). Use commas, periods, colons, or separate sentences.
- Avoid clichéd direct-response language ("Don't miss out!", "Act now!") unless the offer explicitly creates urgency.
- Match the audience's voice. If the audience is anxious immigrants, do not write like a luxury car ad.
- Each suggestion must be DISTINCT from the others — no near-duplicates.
- Each suggestion must be DISTINCT from the existing BHs already on file.
- Output ONLY valid JSON. No markdown fences, no commentary.

Response format:
{
  "BH": ["...", "...", ...]
}

Produce exactly the requested count.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const body = await req.json() as {
      client_id?: string
      audience_id?: string
      offer_id?: string
      count?: number
      user_prompt?: string
    }
    const { client_id, audience_id, offer_id, user_prompt } = body
    const count = Math.min(Math.max(body.count ?? 8, 1), 20)

    if (!client_id)   return errorResponse('client_id is required')
    if (!audience_id) return errorResponse('audience_id is required')
    if (!offer_id)    return errorResponse('offer_id is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Existing Banner Headlines for THIS audience — fed back so the model
    // doesn't repeat or paraphrase them. avatar_ids on copy_components is JSONB
    // so we use the contains operator.
    const [{ data: client }, { data: audience }, { data: offer }, { data: existingBhs }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('avatars').select('*').eq('id', audience_id).single(),
      supabase.from('offers').select('*').eq('id', offer_id).single(),
      supabase
        .from('copy_components')
        .select('text')
        .eq('client_id', client_id)
        .eq('type', 'banner_headline')
        .contains('avatar_ids', [audience_id]),
    ])

    if (!client)   return errorResponse('Client not found',   404)
    if (!audience) return errorResponse('Audience not found', 404)
    if (!offer)    return errorResponse('Offer not found',    404)

    const existing = (existingBhs || []).map((r: { text: string }) => `- ${r.text}`).join('\n')

    const userMessage = `AUDIENCE:
Name: ${audience.name}
${audience.avatar_type ? `Type: ${audience.avatar_type}` : ''}
Description: ${audience.description ?? ''}
Pain Points: ${audience.pain_points ?? ''}
Motivations: ${audience.motivations ?? ''}
Objections: ${audience.objections ?? ''}
Desired Outcome: ${audience.desired_outcome ?? ''}
Trigger Events: ${audience.trigger_events ?? ''}
Messaging Style: ${audience.messaging_style ?? ''}

OFFER:
Name: ${offer.name}
${offer.offer_type ? `Type: ${offer.offer_type}` : ''}
Headline: ${offer.headline ?? ''}
Subheadline: ${offer.subheadline ?? ''}
Description: ${offer.description ?? ''}
Primary CTA: ${offer.primary_cta ?? ''}
Benefits: ${Array.isArray(offer.benefits) ? offer.benefits.join('; ') : ''}

BUSINESS CONTEXT:
Company: ${client.name}
Summary: ${client.business_summary ?? ''}
Services: ${client.services ?? ''}
Differentiators: ${client.differentiators ?? ''}
Trust Signals: ${client.trust_signals ?? ''}
Tone: ${client.tone ?? ''}

EXISTING BANNER HEADLINES FOR THIS AUDIENCE (DO NOT DUPLICATE OR PARAPHRASE):
${existing || '(none yet)'}

REQUEST:
Generate exactly ${count} Banner Headlines.
${user_prompt ? `\nADDITIONAL DIRECTION FROM THE USER:\n${user_prompt}\n` : ''}
Output JSON: { "BH": [...] }`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, { maxTokens: 2000 })

    let parsed: { BH?: string[] }
    try {
      parsed = parseJsonResponse<{ BH?: string[] }>(response)
    } catch (err) {
      console.error('parse error', err, response.substring(0, 500))
      return errorResponse('Could not parse AI response: ' + (err as Error).message, 500)
    }

    const list = Array.isArray(parsed.BH) ? parsed.BH : []
    const cleaned = list
      .map(s => (typeof s === 'string' ? s.trim() : ''))
      .filter(s => s.length > 0 && s.length <= 60)

    return jsonResponse({ suggestions: { BH: cleaned }, audience_id, offer_id })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
