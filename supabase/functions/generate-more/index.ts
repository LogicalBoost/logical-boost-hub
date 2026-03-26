// Workflow 5: Generate More — Per Section (Spec v2.1)
// Trigger: User clicks "Generate More" or uses the AI prompter
// Supports: user_prompt for directed generation, quantity control, angle filtering

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import { buildGenerateMoreSystemPrompt } from '../_shared/copywriter-prompts.ts'

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

    const angleContext = angle_filter
      ? `Focus specifically on the "${angle_filter}" angle. All generated items should use this angle.`
      : `Distribute across these angles: ${angles.join(', ')}`

    const userDirection = user_prompt
      ? `\n\nUSER DIRECTION (follow this guidance closely):\n${user_prompt}`
      : ''

    const systemPrompt = buildGenerateMoreSystemPrompt(
      section_type,
      generateCount,
      angleContext,
      (client.ad_copy_rules || {}) as Record<string, unknown>,
      client.ad_copy_notes,
      existingText,
    )

    const userMessage = `AVATAR:
Name: ${avatar.name}
Type: ${avatar.avatar_type}
Description: ${avatar.description}
Pain Points: ${avatar.pain_points}
Motivations: ${avatar.motivations}
Objections: ${avatar.objections}
Desired Outcome: ${avatar.desired_outcome}
Messaging Style: ${avatar.messaging_style}

OFFER:
Name: ${offer.name}
Type: ${offer.offer_type}
Headline: ${offer.headline}
Description: ${offer.description}
Primary CTA: ${offer.primary_cta}
Conversion Type: ${offer.conversion_type}
Benefits: ${JSON.stringify(offer.benefits)}
Proof Elements: ${JSON.stringify(offer.proof_elements)}

BUSINESS:
Company: ${client.name}
Website: ${client.website}
Summary: ${client.business_summary}
Services: ${client.services}
Trust Signals: ${client.trust_signals}
Differentiators: ${client.differentiators}${userDirection}`

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
