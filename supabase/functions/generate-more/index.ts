// Workflow 5: Generate More — Per Section (Spec v2.1)
// Trigger: User clicks "Generate More" or uses the AI prompter
// Supports: user_prompt for directed generation, quantity control, angle filtering

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import { buildGenerateMoreSystemPrompt } from '../_shared/copywriter-prompts.ts'
import { getSegment, resolveSegmentId } from '../_shared/segments.ts'
import { buildAiRulesContext } from '../_shared/ai-rules.ts'

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

    const segment_id: string = fi.segment_id || await resolveSegmentId(supabase, fi.client_id, null)
    const segment = await getSegment(supabase, segment_id)
    const { data: proof } = await supabase.from('proof_items').select('*').eq('segment_id', segment_id)
    const aiRules = buildAiRulesContext({ segment, avatars: [avatar], offers: [offer], proof })

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

    // For video/long-form content, pull a sample of existing short-form copy
    // so the AI can riff off the validated tone and proof points. Video hooks
    // especially benefit from seeing headlines, primary text, and benefits.
    const LONG_FORM_SECTIONS = new Set(['video_hook', 'short_script', 'long_script', 'video_script'])
    const isLongForm = LONG_FORM_SECTIONS.has(section_type)
    let inspirationContext = ''
    if (isLongForm) {
      const { data: others } = await supabase
        .from('copy_components')
        .select('type, text')
        .eq('funnel_instance_id', funnel_instance_id)
        .eq('status', 'approved')
        .in('type', ['headline', 'google_headline', 'primary_text', 'benefit', 'proof', 'cta', 'urgency'])
        .limit(40)
      if (others && others.length > 0) {
        const grouped: Record<string, string[]> = {}
        for (const c of others) {
          const t = String(c.type)
          if (!grouped[t]) grouped[t] = []
          grouped[t].push(String(c.text))
        }
        const blocks: string[] = []
        for (const [t, items] of Object.entries(grouped)) {
          blocks.push(`${t.toUpperCase()}:\n${items.slice(0, 8).map(x => `- ${x}`).join('\n')}`)
        }
        inspirationContext = `\n\n## PROVEN COPY FROM THIS CAMPAIGN (use as inspiration — match the tone, pull hooks and proof points)\n${blocks.join('\n\n')}`
      }
    }

    // Service area should INFORM the copy, not lock it down. The old strict
    // "DO NOT reference any other city/state/market" block was causing the AI
    // to refuse generations for Micro Hooks / Proof when it couldn't find
    // market-specific angles. Make it a soft rule: focus on service value,
    // sprinkle location in where natural, never reference OTHER markets.
    const serviceAreaBlock = avatar.service_area
      ? `\n\n## SERVICE AREA
This avatar is for the **${avatar.service_area}** market. Weave the locale into some items where it adds specificity (trust, urgency, local proof), but DON'T force it into every item — most copy should focus on the service value and pain points. The only hard rule: do NOT reference OTHER markets the business also serves.`
      : ''

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
Differentiators: ${client.differentiators}

${aiRules}${serviceAreaBlock}${inspirationContext}${userDirection}`

    // Video scripts (especially long_script and video_script) need more tokens
    // than shorter sections or they truncate mid-sentence.
    const LONG_SCRIPT_SECTIONS = new Set(['long_script', 'video_script'])
    const maxTokens = LONG_SCRIPT_SECTIONS.has(section_type) ? 16384 : 8192

    const response = await callClaude(systemPrompt, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens,
    })

    let parsed: { new_components?: Array<Record<string, unknown>> }
    try {
      parsed = parseJsonResponse<{ new_components: Array<Record<string, unknown>> }>(response)
    } catch (parseErr) {
      console.error('[generate-more] AI JSON parse failed. Raw (first 500 chars):', response.slice(0, 500))
      return errorResponse(`AI returned invalid JSON: ${(parseErr as Error).message}. Response length: ${response.length}`, 500)
    }

    // Some models wrap under alternative keys
    const components = (parsed.new_components
      || (parsed as Record<string, unknown>).components
      || (parsed as Record<string, unknown>).items
      || []) as Array<Record<string, unknown>>

    if (components.length === 0) {
      console.error('[generate-more] AI returned 0 components. Raw (first 400):', response.slice(0, 400))
      return errorResponse(
        `AI returned no "${section_type}" items. The prompt may have been too restrictive or the model rejected the request. Try again or use "Prompt AI" to add direction.`,
        502,
      )
    }

    const records = components.map(c => {
      const text = typeof c.text === 'string' ? c.text : ''
      return {
        client_id: client.id,
        segment_id,
        type: typeof c.type === 'string' ? c.type : section_type,
        text,
        character_count: typeof c.character_count === 'number' ? c.character_count : text.length,
        avatar_ids: [fi.avatar_id],
        offer_ids: [fi.offer_id],
        angle_ids: Array.isArray(c.angle_ids) ? c.angle_ids : (angle_filter ? [angle_filter] : angles.slice(0, 1)),
        platform: typeof c.platform === 'string' ? c.platform : 'all',
        status: 'approved',
        funnel_instance_id,
      }
    }).filter(r => r.text && r.text.length > 0)

    if (records.length === 0) {
      return errorResponse(`AI returned ${components.length} items but none had valid "text". Retry.`, 502)
    }

    const { error: insertError } = await supabase.from('copy_components').insert(records)
    if (insertError) {
      console.error('[generate-more] DB insert failed:', JSON.stringify(insertError))
      return errorResponse(`Database insert failed: ${insertError.message}`, 500)
    }

    return jsonResponse({
      success: true,
      components_created: records.length,
      section_type,
    })
  } catch (err) {
    console.error('[generate-more] Uncaught error:', err)
    return errorResponse((err as Error).message, 500)
  }
})
