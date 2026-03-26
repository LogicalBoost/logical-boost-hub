// Workflow 4: Generate Funnel Instance (Spec v2.1)
// Trigger: User selects Avatar + Offer on Funnel page, no existing instance
// Generates ~130-180 copy components across ALL recommended angles
// Split into 3 PARALLEL API calls so nothing gets truncated
// One funnel_instance per Avatar+Offer — permanent, cannot be regenerated

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import {
  BATCH_1_ADS,
  BATCH_2_PERSUASION,
  BATCH_3_VIDEO,
  ANGLE_DEFINITIONS,
  buildBatchSystemPrompt,
  buildUserMessage,
  type BatchConfig,
} from '../_shared/copywriter-prompts.ts'

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

    // Build user message (shared across all batches)
    const userMessage = buildUserMessage(
      avatar as unknown as Record<string, unknown>,
      offer as unknown as Record<string, unknown>,
      client as unknown as Record<string, unknown>,
      recommendedAngles,
    )

    // ── Select which batches to run based on mode ──────────────────────
    let batches: BatchConfig[]
    if (mode === 'video_only') {
      batches = [BATCH_3_VIDEO]
    } else {
      // full or fill_all: run all 3 batches
      batches = [BATCH_1_ADS, BATCH_2_PERSUASION, BATCH_3_VIDEO]
    }

    console.log(`Starting ${batches.length} parallel generation batches (mode=${mode}) for funnel ${funnelInstance.id}`)

    const batchResults = await Promise.allSettled(
      batches.map(async (batch) => {
        const systemPrompt = buildBatchSystemPrompt(batch, recommendedAngles, client.ad_copy_rules, client.ad_copy_notes)
        console.log(`[${batch.name}] Calling Claude...`)

        const response = await callClaude(systemPrompt, userMessage, {
          model: 'claude-sonnet-4-20250514',
          maxTokens: 8192,
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
