// Prompt 5: Generate More — Per Section (Workflow 5)
// Trigger: User clicks "Generate More" on a specific section
// Returns: 3-5 new copy components for that section

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT_TEMPLATE = `You are an elite direct-response copywriter. You are adding new items to an existing campaign section. You must generate fresh, complementary copy that does NOT duplicate what already exists.

SECTION TYPE: {{section_type}}
QUANTITY: Generate 3–5 new items.

AD COPY RULES (MANDATORY):
Tone: {{tone}}
Banned Words (NEVER USE): {{banned_words}}
Required Disclaimers: {{disclaimers}}
Platform Rules:
  - Google Ads: Headlines max {{google_headline_chars}} chars, Descriptions max {{google_desc_chars}} chars
  - Meta Ads: Primary text max {{meta_text_chars}} chars, Headlines max {{meta_headline_chars}} chars
Brand Constraints: {{brand_constraints}}
Compliance Notes: {{compliance_notes}}

RULES:
- Read every existing item below. Your new items must be DIFFERENT — different angles, different phrasing, different emotional triggers.
- Stay aligned with the Avatar + Offer + Angle combination.
- Maintain the same quality bar as existing items. No filler.
- Respect all character limits for the target platform.

Respond ONLY with valid JSON array of copy_component objects.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { funnel_instance_id, section_type } = await req.json()

    if (!funnel_instance_id || !section_type) {
      return errorResponse('funnel_instance_id and section_type are required')
    }

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

    const existingText = (existing || []).map((c: Record<string, unknown>) => `- "${c.text}" (${c.platform})`).join('\n')

    const rules = (client.ad_copy_rules || {}) as Record<string, unknown>
    const platformRules = (rules.platform_rules || {}) as Record<string, Record<string, number>>

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace('{{section_type}}', section_type)
      .replace('{{tone}}', JSON.stringify(rules.tone_descriptors || []))
      .replace('{{banned_words}}', JSON.stringify(rules.banned_words || []))
      .replace('{{disclaimers}}', JSON.stringify(rules.required_disclaimers || []))
      .replace('{{google_headline_chars}}', String(platformRules.google?.headline_max_chars || 30))
      .replace('{{google_desc_chars}}', String(platformRules.google?.description_max_chars || 90))
      .replace('{{meta_text_chars}}', String(platformRules.meta?.primary_text_max_chars || 125))
      .replace('{{meta_headline_chars}}', String(platformRules.meta?.headline_max_chars || 40))
      .replace('{{brand_constraints}}', String(rules.brand_constraints || 'None'))
      .replace('{{compliance_notes}}', String(rules.compliance_notes || 'None'))

    const userMessage = `AVATAR:
Name: ${avatar.name}
Pain Points: ${avatar.pain_points}
Motivations: ${avatar.motivations}
Messaging Style: ${avatar.messaging_style}

OFFER:
Name: ${offer.name}
Primary CTA: ${offer.primary_cta}
Benefits: ${JSON.stringify(offer.benefits)}

PRIMARY ANGLE: ${fi.primary_angle}
SECONDARY ANGLES: ${JSON.stringify(fi.secondary_angles)}

BUSINESS:
Company: ${client.name}
Trust Signals: ${client.trust_signals}
Differentiators: ${client.differentiators}

EXISTING ITEMS IN THIS SECTION (DO NOT DUPLICATE):
${existingText || 'None yet'}`

    const response = await callClaude(systemPrompt, userMessage)
    const parsed = parseJsonResponse<{
      new_components: Array<{
        type: string
        text: string
        character_count: number
        platform: string
        angle_ids: string[]
      }>
    }>(response)

    // Insert new components
    let created = 0
    if (parsed.new_components?.length) {
      const records = parsed.new_components.map(c => ({
        client_id: client.id,
        type: c.type || section_type,
        text: c.text,
        character_count: c.character_count || c.text.length,
        avatar_ids: [fi.avatar_id],
        offer_ids: [fi.offer_id],
        angle_ids: c.angle_ids || [fi.primary_angle],
        platform: c.platform || 'all',
        status: 'approved',
        funnel_instance_id,
      }))
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
