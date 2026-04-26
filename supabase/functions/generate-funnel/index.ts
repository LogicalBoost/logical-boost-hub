// Workflow 4: Generate Funnel Instance (Spec v2.1)
// Trigger: User selects Avatar + Offer on Funnel page, no existing instance
// Generates ~130-180 copy components across ALL recommended angles
// Split into 3 PARALLEL API calls so nothing gets truncated
// One funnel_instance per Avatar+Offer — permanent, cannot be regenerated

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import {
  ALL_BATCHES,
  BATCH_VIDEO_HOOKS,
  BATCH_VIDEO_SCRIPTS,
  ANGLE_DEFINITIONS,
  buildBatchSystemPrompt,
  buildUserMessage,
  type BatchConfig,
} from '../_shared/copywriter-prompts.ts'
import { getSegment, resolveSegmentId } from '../_shared/segments.ts'
import { buildAiRulesContext } from '../_shared/ai-rules.ts'

// Parse AI response into component array (handles various response structures)
function extractComponents(response: string, recommendedAngles: string[]): Array<Record<string, unknown>> {
  const rawParsed = parseJsonResponse<Record<string, unknown>>(response)

  // Unwrap if AI nests under a top-level key
  const keys = Object.keys(rawParsed)
  const unwrapped = (keys.length === 1 && typeof rawParsed[keys[0]] === 'object' && !Array.isArray(rawParsed[keys[0]]))
    ? rawParsed[keys[0]] as Record<string, unknown>
    : rawParsed

  // Try to find copy_components array
  let components = (unwrapped.copy_components || unwrapped.components || unwrapped.campaign_assets || []) as Array<Record<string, unknown>>

  // If no array found, check if structured by type keys
  if (!Array.isArray(components) || components.length === 0) {
    components = []
    const typeKeys = [
      'banner_headline', 'banner_headlines',
      'headline', 'headlines', 'subheadline', 'subheadlines',
      'primary_text', 'primary_texts',
      'google_headline', 'google_headlines',
      'google_description', 'google_descriptions',
      'benefit', 'benefits', 'proof', 'proofs',
      'urgency', 'urgency_elements',
      'fear_point', 'fear_points',
      'value_point', 'value_points',
      'cta', 'ctas',
      'video_hook', 'video_hooks',
      'short_script', 'short_scripts',
      'long_script', 'long_scripts',
      'video_script', 'video_scripts',
      'objection_handler', 'objection_handlers',
      'description', 'descriptions',
      'hero_headline', 'hero_headlines',
      'hero_subheadline', 'hero_subheadlines',
      'hero_cta', 'hero_ctas',
      'urgency_bar', 'urgency_bars',
    ]
    for (const tk of typeKeys) {
      const items = unwrapped[tk]
      if (Array.isArray(items)) {
        const normalizedType = tk.replace(/s$/, '')
        for (const item of items) {
          if (typeof item === 'string') {
            components.push({ type: normalizedType, text: item, platform: 'all', angle_ids: recommendedAngles.slice(0, 1) })
          } else if (typeof item === 'object' && item !== null) {
            components.push({ ...item as Record<string, unknown>, type: (item as Record<string, unknown>).type || normalizedType })
          }
        }
      }
    }
  }

  return components
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    // mode: "full" (default) = create new instance with all components
    //        "fill_all" = add all missing component types to existing instance
    //        "video_only" = only generate video batch for existing instance
    const { avatar_id, offer_id, mode = 'full' } = await req.json()

    if (!avatar_id || !offer_id) {
      return errorResponse('avatar_id and offer_id are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if funnel instance already exists for this Avatar + Offer
    const { data: existing } = await supabase
      .from('funnel_instances')
      .select('id')
      .eq('avatar_id', avatar_id)
      .eq('offer_id', offer_id)
      .eq('status', 'active')
      .single()

    // For fill_all or video_only modes, we NEED an existing instance
    if ((mode === 'fill_all' || mode === 'video_only') && !existing) {
      return errorResponse('No existing funnel instance found. Use full mode to create one first.')
    }

    if (existing && mode === 'full') {
      const { count } = await supabase
        .from('copy_components')
        .select('*', { count: 'exact', head: true })
        .eq('funnel_instance_id', existing.id)

      if (count && count > 0) {
        return errorResponse('A funnel instance already exists for this Avatar + Offer. Use Generate More to add items.')
      }

      // Empty instance from failed generation — delete and retry
      await supabase.from('funnel_instances').delete().eq('id', existing.id)
    }

    // Fetch all required data
    const { data: avatar } = await supabase.from('avatars').select('*').eq('id', avatar_id).single()
    const { data: offer } = await supabase.from('offers').select('*').eq('id', offer_id).single()
    if (!avatar || !offer) return errorResponse('Avatar or offer not found')

    const { data: client } = await supabase.from('clients').select('*').eq('id', avatar.client_id).single()
    if (!client) return errorResponse('Client not found')

    // Segment is derived from the avatar. Both avatar and offer must share it.
    // Fall back to default segment if missing (older rows that pre-date migration 028).
    const segment_id: string = avatar.segment_id || await resolveSegmentId(supabase, avatar.client_id, null)
    if (offer.segment_id && avatar.segment_id && avatar.segment_id !== offer.segment_id) {
      return errorResponse('Avatar and offer belong to different segments and cannot be combined.')
    }
    const segment = await getSegment(supabase, segment_id)
    const { data: proof } = await supabase.from('proof_items').select('*').eq('segment_id', segment_id)
    const { data: segAvatars } = await supabase.from('avatars').select('*').eq('segment_id', segment_id).eq('status', 'approved')
    const { data: segOffers } = await supabase.from('offers').select('*').eq('segment_id', segment_id).eq('status', 'approved')
    const aiRules = buildAiRulesContext({ segment, avatars: segAvatars, offers: segOffers, proof })

    // Get recommended angles
    let recommendedAngles = avatar.recommended_angles as string[] || []
    if (recommendedAngles.length === 0) {
      recommendedAngles = ['problem', 'outcome', 'proof', 'curiosity']
    }
    if (recommendedAngles.length < 3) {
      const fallbacks = ['mechanism', 'fear', 'speed', 'authority']
      for (const f of fallbacks) {
        if (!recommendedAngles.includes(f)) recommendedAngles.push(f)
        if (recommendedAngles.length >= 3) break
      }
    }
    if (recommendedAngles.length > 5) recommendedAngles = recommendedAngles.slice(0, 5)

    // Use existing instance for fill/video modes, create new for full mode
    let funnelInstance: Record<string, unknown>
    if (mode === 'fill_all' || mode === 'video_only') {
      funnelInstance = existing as Record<string, unknown>
      console.log(`Using existing funnel instance ${existing!.id} for mode=${mode}`)
    } else {
      const { data: newInstance, error: fiError } = await supabase
        .from('funnel_instances')
        .insert({
          client_id: client.id,
          segment_id,
          avatar_id,
          offer_id,
          generated_at: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single()

      if (fiError || !newInstance) {
        return errorResponse(`Failed to create funnel instance: ${fiError?.message}`)
      }
      funnelInstance = newInstance as Record<string, unknown>
    }

    // Build user message (shared across all batches). Append the segment's
    // AI Rules block so every batch respects voice/guardrails/approved-proof,
    // plus a hard-enforced service-area block so copy never mixes markets.
    const serviceArea = (avatar as Record<string, unknown>).service_area as string | null
    const serviceAreaBlock = serviceArea
      ? `\n\n## SERVICE AREA
This campaign targets the **${serviceArea}** market. Guidance, not a straitjacket:
- Weave the locale in where it adds specificity — local trust cues, local urgency, local proof. Aim for roughly 20-30% of items to reference it naturally.
- Most items should focus on the service value, pain points, and outcome — no need to force location into every headline or hook.
- The one hard rule: do NOT reference OTHER markets the business also serves (if they also operate elsewhere, ignore those markets for this run).`
      : ''

    const userMessage = buildUserMessage(
      avatar as unknown as Record<string, unknown>,
      offer as unknown as Record<string, unknown>,
      client as unknown as Record<string, unknown>,
      recommendedAngles,
    ) + `\n\n${aiRules}${serviceAreaBlock}`

    // ── Select which batches to run based on mode ──────────────────────
    // Nine small focused batches run in parallel. Each asks for 12-32 items
    // across 1-3 related types, well under the JSON-truncation threshold.
    // Old behavior was 3 big batches — BATCH_2 routinely truncated and
    // dropped Proof/Urgency/CTAs/Objection Handlers.
    let batches: BatchConfig[]
    if (mode === 'video_only') {
      batches = [BATCH_VIDEO_HOOKS, BATCH_VIDEO_SCRIPTS]
    } else {
      batches = ALL_BATCHES
    }

    console.log(`Starting ${batches.length} parallel generation batches (mode=${mode}) for funnel ${funnelInstance.id}`)

    const batchResults = await Promise.allSettled(
      batches.map(async (batch) => {
        const systemPrompt = buildBatchSystemPrompt(batch, recommendedAngles, client.ad_copy_rules, client.ad_copy_notes)
        // Video script bodies can be 240-word scripts x 3 + 150-word scripts
        // x 4 + 75-word scripts x 5 — still large enough to benefit from
        // extra headroom. All other batches are tight enough for 8K.
        const maxTokens = batch === BATCH_VIDEO_SCRIPTS ? 12288 : 8192
        console.log(`[${batch.name}] Calling Claude (maxTokens=${maxTokens})...`)

        const response = await callClaude(systemPrompt, userMessage, {
          model: 'claude-sonnet-4-20250514',
          maxTokens,
        })

        const components = extractComponents(response, recommendedAngles)
        console.log(`[${batch.name}] Parsed ${components.length} components`)
        return { name: batch.name, components }
      })
    )

    // ── Collect all components from successful batches ──────────────────
    let allComponents: Array<Record<string, unknown>> = []
    const batchSummary: string[] = []

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allComponents = allComponents.concat(result.value.components)
        batchSummary.push(`${result.value.name}: ${result.value.components.length} items`)
      } else {
        console.error(`Batch failed:`, result.reason)
        batchSummary.push(`FAILED: ${result.reason}`)
      }
    }

    console.log(`Total components from all batches: ${allComponents.length}`)
    console.log(`Batch summary: ${batchSummary.join(' | ')}`)

    // ── Insert all components ──────────────────────────────────────────
    let componentsCreated = 0
    if (allComponents.length > 0) {
      const records = allComponents.map(c => {
        const text = String(c.text || '')
        return {
          client_id: client.id,
          segment_id,
          type: String(c.type || 'headline'),
          text,
          character_count: typeof c.character_count === 'number' ? c.character_count : text.length,
          avatar_ids: [avatar_id],
          offer_ids: [offer_id],
          angle_ids: Array.isArray(c.angle_ids) ? c.angle_ids : recommendedAngles.slice(0, 1),
          platform: String(c.platform || 'all'),
          status: 'approved',
          funnel_instance_id: funnelInstance.id,
        }
      }).filter(r => r.text.length > 0)

      // Insert in batches of 50
      const batchSize = 50
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        const { error: insertError } = await supabase.from('copy_components').insert(batch)
        if (insertError) {
          console.error(`Insert error (batch ${i / batchSize}):`, JSON.stringify(insertError))
        } else {
          componentsCreated += batch.length
        }
      }
    }

    return jsonResponse({
      success: true,
      funnel_instance_id: funnelInstance.id,
      components_created: componentsCreated,
      recommended_angles: recommendedAngles,
      batch_summary: batchSummary,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
