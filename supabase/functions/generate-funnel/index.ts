// Prompt 4: Generate Funnel Instance (Workflow 4)
// Trigger: User selects Avatar + Offer + Angle on Funnel page, no existing instance
// Returns: Creates funnel_instance + copy_components + creatives + landing_page

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

function buildSystemPrompt(
  primaryAngle: string,
  secondaryAngles: string[],
  adCopyRules: Record<string, unknown> | null,
  adCopyNotes: string | null
): string {
  const angleDefinitions: Record<string, string> = {
    problem: 'Focus on a pain the audience is currently experiencing',
    outcome: 'Focus on the transformation or end result',
    fear: 'Focus on what the audience risks losing or doing wrong',
    opportunity: 'Highlight a new advantage, trend, or method',
    curiosity: 'Create intrigue or a pattern interrupt',
    proof: 'Show measurable results or case studies',
    authority: 'Establish expertise, scale, or credibility',
    mechanism: 'Explain how the solution works',
    speed: 'Emphasize quick results or rapid setup',
    cost: 'Focus on saving money or improving efficiency',
    comparison: 'Contrast against current alternatives',
    identity: 'Call out a specific audience segment directly',
    mistake: 'Highlight errors the audience is making',
    hidden_truth: 'Reveal something counterintuitive or unknown',
    before_after: 'Show contrast between current state and improved state',
  }

  const rules = adCopyRules as Record<string, unknown> || {}
  const platformRules = rules.platform_rules as Record<string, Record<string, number>> || {}

  return `You are an elite direct-response copywriter and campaign strategist working inside a performance marketing agency. You are generating a complete campaign asset set for a specific Avatar + Offer + Angle combination.

ANGLE FRAMEWORK:
- Primary Angle: ${primaryAngle} — ${angleDefinitions[primaryAngle] || primaryAngle}
- Secondary Angle(s): ${secondaryAngles.join(', ')}

The primary angle is the dominant messaging theme. Secondary angles are woven in to add depth.

AD COPY RULES (MANDATORY — THESE ARE HARD CONSTRAINTS):
Tone: ${JSON.stringify((rules.tone_descriptors as string[]) || [])}
Banned Words (NEVER USE): ${JSON.stringify((rules.banned_words as string[]) || [])}
Required Disclaimers: ${JSON.stringify((rules.required_disclaimers as string[]) || [])}
Platform Rules:
  - Google Ads: Headlines max ${platformRules.google?.headline_max_chars || 30} chars, Descriptions max ${platformRules.google?.description_max_chars || 90} chars
  - Meta Ads: Primary text max ${platformRules.meta?.primary_text_max_chars || 125} chars, Headlines max ${platformRules.meta?.headline_max_chars || 40} chars
Brand Constraints: ${rules.brand_constraints || 'None specified'}
Compliance Notes: ${rules.compliance_notes || 'None specified'}
Additional Notes: ${adCopyNotes || 'None'}

You MUST obey every rule above.

QUALITY STANDARDS:
- Every headline must be specific to this avatar and offer. No generic copy.
- Benefits must be concrete and measurable where possible.
- Proof statements must reference real trust signals — do not invent claims.
- CTAs must be action-oriented and specific to the offer's conversion type.
- Video hooks must create pattern interrupts.
- Social copy must read naturally, not like an ad.

Generate the following copy_components:
- headline: 6 (mix of meta and google lengths)
- primary_text: 3 (meta social copy)
- google_headline: 5
- google_description: 3
- benefit: 6
- proof: 3
- urgency: 2
- fear_point: 2
- value_point: 2
- cta: 4
- video_hook: 2
- video_script: 1
- objection_handler: 2
- subheadline: 2

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { avatar_id, offer_id, primary_angle, secondary_angles } = await req.json()

    if (!avatar_id || !offer_id || !primary_angle) {
      return errorResponse('avatar_id, offer_id, and primary_angle are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if funnel instance already exists
    const { data: existing } = await supabase
      .from('funnel_instances')
      .select('id')
      .eq('avatar_id', avatar_id)
      .eq('offer_id', offer_id)
      .eq('primary_angle', primary_angle)
      .single()

    if (existing) {
      return errorResponse('A funnel instance already exists for this combination. Use generate-more to add items.')
    }

    // Fetch all required data
    const { data: avatar } = await supabase.from('avatars').select('*').eq('id', avatar_id).single()
    const { data: offer } = await supabase.from('offers').select('*').eq('id', offer_id).single()
    if (!avatar || !offer) return errorResponse('Avatar or offer not found')

    const { data: client } = await supabase.from('clients').select('*').eq('id', avatar.client_id).single()
    if (!client) return errorResponse('Client not found')

    const sAngles = secondary_angles || []

    // Create funnel instance
    const { data: funnelInstance, error: fiError } = await supabase
      .from('funnel_instances')
      .insert({
        client_id: client.id,
        avatar_id,
        offer_id,
        primary_angle,
        secondary_angles: sAngles,
        generated_at: new Date().toISOString(),
        status: 'active',
      })
      .select()
      .single()

    if (fiError || !funnelInstance) {
      return errorResponse(`Failed to create funnel instance: ${fiError?.message}`)
    }

    // Build and call AI for copy components
    const systemPrompt = buildSystemPrompt(primary_angle, sAngles, client.ad_copy_rules, client.ad_copy_notes)

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
Subheadline: ${offer.subheadline}
Description: ${offer.description}
Primary CTA: ${offer.primary_cta}
Conversion Type: ${offer.conversion_type}
Benefits: ${JSON.stringify(offer.benefits)}
Proof Elements: ${JSON.stringify(offer.proof_elements)}
Urgency Elements: ${JSON.stringify(offer.urgency_elements)}
FAQ: ${JSON.stringify(offer.faq)}

BUSINESS CONTEXT:
Company: ${client.name}
Summary: ${client.business_summary}
Services: ${client.services}
Differentiators: ${client.differentiators}
Trust Signals: ${client.trust_signals}`

    const response = await callClaude(systemPrompt, userMessage, {
      model: 'claude-sonnet-4-6',
      maxTokens: 8192,
    })

    const parsed = parseJsonResponse<{
      copy_components: Array<{
        type: string
        text: string
        character_count: number
        platform: string
        angle_ids: string[]
      }>
    }>(response)

    // Insert copy components
    let componentsCreated = 0
    if (parsed.copy_components?.length) {
      const records = parsed.copy_components.map(c => ({
        client_id: client.id,
        type: c.type,
        text: c.text,
        character_count: c.character_count || c.text.length,
        avatar_ids: [avatar_id],
        offer_ids: [offer_id],
        angle_ids: c.angle_ids || [primary_angle],
        platform: c.platform || 'all',
        status: 'approved',
        funnel_instance_id: funnelInstance.id,
      }))
      const { error: insertError } = await supabase.from('copy_components').insert(records)
      if (!insertError) componentsCreated = records.length
    }

    return jsonResponse({
      success: true,
      funnel_instance_id: funnelInstance.id,
      components_created: componentsCreated,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
