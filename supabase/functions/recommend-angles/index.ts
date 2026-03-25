// Prompt 0: Angle Recommendation
// Trigger: User selects Avatar + Offer on Funnel page
// Returns: 3-5 recommended angles with reasoning

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior direct-response strategist working inside a marketing agency. Your job is to recommend the best messaging angles for a specific audience + offer combination.

You have access to a framework of 15 canonical angles:

- problem: Pain Point — Focus on a pain the audience is currently experiencing
- outcome: Desired Result — Focus on the transformation or end result
- fear: Fear & Risk — Focus on what the audience risks losing or doing wrong
- opportunity: New Opportunity — Highlight a new advantage, trend, or method
- curiosity: Curiosity Hook — Create intrigue or a pattern interrupt
- proof: Social Proof — Show measurable results or case studies
- authority: Authority & Trust — Establish expertise, scale, or credibility
- mechanism: How It Works — Explain how the solution works (unique method/system)
- speed: Fast Results — Emphasize quick results or rapid setup
- cost: Cost Savings — Focus on saving money or improving efficiency
- comparison: Us vs. Them — Contrast against current alternatives
- identity: Audience Callout — Call out a specific audience segment directly
- mistake: Common Mistakes — Highlight errors the audience is making
- hidden_truth: Hidden Truth — Reveal something counterintuitive or unknown
- before_after: Before & After — Show contrast between current state and improved state

SELECTION RULES:
- If the product/service is technical or unique → prioritize "mechanism"
- If the audience is high intent / aware → use "problem" + "mechanism"
- If the market is saturated → add "curiosity" or "hidden_truth"
- If trust is low → add "proof" or "authority"
- If targeting a specific segment → always include "identity"

Recommend exactly 3-5 angles. For each, explain in one sentence WHY this angle works for this specific avatar + offer combo. Rank them from strongest to weakest.

NEVER use em dashes (—) in any generated text. Use commas, periods, colons, or separate sentences instead.

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { avatar_id, offer_id } = await req.json()

    if (!avatar_id || !offer_id) {
      return errorResponse('avatar_id and offer_id are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch avatar, offer, and client data
    const { data: avatar } = await supabase.from('avatars').select('*').eq('id', avatar_id).single()
    const { data: offer } = await supabase.from('offers').select('*').eq('id', offer_id).single()

    if (!avatar || !offer) {
      return errorResponse('Avatar or offer not found')
    }

    const { data: client } = await supabase.from('clients').select('*').eq('id', avatar.client_id).single()

    const userMessage = `AVATAR:
Name: ${avatar.name}
Type: ${avatar.avatar_type}
Description: ${avatar.description}
Pain Points: ${avatar.pain_points}
Motivations: ${avatar.motivations}
Objections: ${avatar.objections}
Desired Outcome: ${avatar.desired_outcome}
Trigger Events: ${avatar.trigger_events}
Messaging Style: ${avatar.messaging_style}

OFFER:
Name: ${offer.name}
Type: ${offer.offer_type}
Headline: ${offer.headline}
Description: ${offer.description}
Primary CTA: ${offer.primary_cta}
Benefits: ${JSON.stringify(offer.benefits)}

BUSINESS CONTEXT:
Company: ${client?.name}
Services: ${client?.services}
Differentiators: ${client?.differentiators}
Industry/Market Notes: ${client?.business_summary}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage)
    const parsed = parseJsonResponse<{ recommended_angles: Array<{ slug: string; label: string; rank: number; reasoning: string }> }>(response)

    return jsonResponse(parsed)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
