// Workflow 5: Generate More — Per Section (Spec v2.1)
// Trigger: User clicks "Generate More" or uses the AI prompter
// Supports: user_prompt for directed generation, quantity control, angle filtering

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const FTC_COMPLIANCE = `
FTC & PLATFORM COMPLIANCE (MANDATORY):
- NEVER fabricate testimonials, reviews, or case studies.
- NEVER invent statistics or numerical claims unless from real business data.
- NEVER make income guarantees or unrealistic promises.
- All claims must be truthful and substantiatable.
- Be aggressive and compelling, but NEVER illegal, untrue, or fake.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { funnel_instance_id, section_type, user_prompt, quantity, angle_filter } = await req.json()

    if (!funnel_instance_id || !section_type) {
      return errorResponse('funnel_instance_id and section_type are required')
    }

    const generateCount = quantity || 5

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch funnel instance and related data
    const { data: fi } = await supabase.from('funnel_instances').select('*').eq('id', funnel_instance_id).single()
    if (!fi) return errorResponse('Funnel instance not found')

    const { data: avatar } = await supabase.from('avatars').select('*').eq('id', fi.avatar_id).single()
    const { data: offer } = await supabase.from('offers').select('*').eq('id', fi.offer_id).single()
    const { data: client } = await supabase.from('clients').select('*').eq('id', fi.client_id).single()
    if (!avatar || !offer || !client) return errorResponse('Related data not found')

    // Get existing items in this section
    const { data: existing } = await supabase
      .from('copy_components')
      .select('*')
      .eq('funnel_instance_id', funnel_instance_id)
      .eq('type', section_type)
      .eq('status', 'approved')

    const existingText = (existing || []).map((c: Record<string, unknown>) => `- "${c.text}"`).join('\n')

    // Infer angles from existing components if no angle columns on instance
    const existingAngles = new Set<string>()
    ;(existing || []).forEach((c: Record<string, unknown>) => {
      const aids = c.angle_ids as string[] || []
      aids.forEach(a => existingAngles.add(a))
    })
    const angles = avatar.recommended_angles as string[] || Array.from(existingAngles) || ['problem', 'outcome']

    const rules = (client.ad_copy_rules || {}) as Record<string, unknown>
    const platformRules = (rules.platform_rules || {}) as Record<string, Record<string, number>>

    const angleContext = angle_filter
      ? `Focus specifically on the "${angle_filter}" angle. All generated items should use this angle.`
      : `Distribute across these angles: ${angles.join(', ')}`

    const userDirection = user_prompt
      ? `\n\nUSER DIRECTION (follow this guidance closely):\n${user_prompt}`
      : ''

    const systemPrompt = `You are an elite direct-response copywriter. You are adding ${generateCount} new items to an existing campaign section. You must generate fresh, complementary copy that does NOT duplicate what already exists.

SECTION TYPE: ${section_type}
QUANTITY: Generate exactly ${generateCount} new items.
ANGLE INSTRUCTIONS: ${angleContext}

AD COPY RULES (MANDATORY):
Tone: ${JSON.stringify(rules.tone_descriptors || [])}
Banned Words (NEVER USE): ${JSON.stringify(rules.banned_words || [])}
Required Disclaimers: ${JSON.stringify(rules.required_disclaimers || [])}
Platform Rules:
  - Google Ads: Headlines max ${platformRules.google?.headline_max_chars || 30} chars, Descriptions max ${platformRules.google?.description_max_chars || 90} chars
  - Meta Ads: Primary text max ${platformRules.meta?.primary_text_max_chars || 125} chars, Headlines max ${platformRules.meta?.headline_max_chars || 40} chars
Brand Constraints: ${String(rules.brand_constraints || 'None')}
Compliance Notes: ${String(rules.compliance_notes || 'None')}
${FTC_COMPLIANCE}

FORMATTING RULES (HARD CONSTRAINTS):
- NEVER use em dashes (—) in any copy. Use commas, periods, colons, or separate sentences instead.

SECTION-SPECIFIC RULES:
- If section_type is "benefit" or "value_point": Write SHORT, punchy bullet points (5-10 words max). Think banner copy and landing page bullet lists. No full sentences. Examples: "24/7 Emergency Response", "Licensed & Insured Technicians", "Same-Day Service Available".

RULES:
- Read every existing item below. Your new items must be DIFFERENT: different angles, different phrasing, different emotional triggers.
- Stay aligned with the Avatar + Offer combination.
- Maintain the same quality bar as existing items. No filler.
- Respect all character limits for the target platform.
- Each item must include angle_ids array.

Respond ONLY with valid JSON: { "new_components": [{ "type": "...", "text": "...", "platform": "...", "angle_ids": ["..."] }] }`

    const userMessage = `AVATAR:
Name: ${avatar.name}
Pain Points: ${avatar.pain_points}
Motivations: ${avatar.motivations}
Messaging Style: ${avatar.messaging_style}

OFFER:
Name: ${offer.name}
Primary CTA: ${offer.primary_cta}
Benefits: ${JSON.stringify(offer.benefits)}

BUSINESS:
Company: ${client.name}
Trust Signals: ${client.trust_signals}
Differentiators: ${client.differentiators}

EXISTING ITEMS IN THIS SECTION (DO NOT DUPLICATE):
${existingText || 'None yet'}${userDirection}`

    const response = await callClaude(systemPrompt, userMessage)
    const parsed = parseJsonResponse<{
      new_components: Array<{
        type: string
        text: string
        character_count?: number
        platform: string
        angle_ids: string[]
      }>
    }>(response)

    // Insert new components
    let created = 0
    const components = parsed.new_components || []
    if (components.length > 0) {
      const records = components.map(c => ({
        client_id: client.id,
        type: c.type || section_type,
        text: c.text,
        character_count: c.character_count || c.text.length,
        avatar_ids: [fi.avatar_id],
        offer_ids: [fi.offer_id],
        angle_ids: c.angle_ids || (angle_filter ? [angle_filter] : angles.slice(0, 1)),
        platform: c.platform || 'all',
        status: 'approved',
        funnel_instance_id,
      })).filter(r => r.text && r.text.length > 0)
      const { error: insertError } = await supabase.from('copy_components').insert(records)
      if (!insertError) created = records.length
    }

    return jsonResponse({
      success: true,
      components_created: created,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
