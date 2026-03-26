// Workflow 4: Generate Funnel Instance (Spec v2.1)
// Trigger: User selects Avatar + Offer on Funnel page, no existing instance
// Generates ~130-180 copy components across ALL recommended angles
// Split into 3 PARALLEL API calls so nothing gets truncated
// One funnel_instance per Avatar+Offer — permanent, cannot be regenerated

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const FTC_COMPLIANCE = `
FTC & PLATFORM COMPLIANCE (MANDATORY):
- NEVER fabricate testimonials, reviews, or case studies. All proof must be based on real data provided.
- NEVER invent statistics, percentages, or numerical claims unless directly from the business data.
- NEVER make income guarantees or unrealistic promises.
- All claims must be truthful and substantiatable.
- Google Ads policy: No misleading claims, no excessive capitalization.
- Meta Ads policy: No personal attributes targeting, no sensationalized language.
- Be aggressive and compelling, but NEVER illegal, untrue, or fabricated.
- Proof statements should reference real trust signals from the business data.`

const ANGLE_DEFINITIONS: Record<string, string> = {
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

// ── 3 generation batches (run in parallel) ──────────────────────────────

interface BatchConfig {
  name: string
  instructions: string
}

const BATCH_1_ADS: BatchConfig = {
  name: 'Ad Copy (Headlines, Descriptions, Primary Text)',
  instructions: `Generate the following ad copy components:
- google_headline: 15-20 items (strict 30 char max per Google Ads policy)
- headline: 20-25 items (Meta headlines, 40 char max recommended)
- google_description: 10-12 items (strict 90 char max)
- primary_text: 8-12 items (Meta primary text, 125 char recommended)
- description: 5-8 items (general ad descriptions)
- subheadline: 5-8 items

TOTAL: ~65-85 components for this batch.`,
}

const BATCH_2_PERSUASION: BatchConfig = {
  name: 'Persuasion Elements (Benefits, CTAs, Proof, Urgency, Objections, Hero)',
  instructions: `Generate the following persuasion and landing page components:
- benefit: 10-15 items (SHORT bullet points, 5-10 words max. Think banner copy: "24/7 Emergency Response", "Licensed & Insured Technicians")
- value_point: 5-8 items (SHORT bullet points like benefits)
- proof: 6-10 items (based on REAL data only, reference actual trust signals)
- urgency: 4-6 items
- fear_point: 4-6 items
- cta: 8-10 items (action-oriented, specific to offer conversion type)
- objection_handler: 5-8 items
- hero_headline: 4-6 items (landing page above-fold)
- hero_subheadline: 4-6 items
- hero_cta: 4-6 items
- urgency_bar: 3-4 items (top-of-page urgency strip text)

TOTAL: ~55-80 components for this batch.`,
}

const BATCH_3_VIDEO: BatchConfig = {
  name: 'Video Scripts (Hooks, Short Scripts, Long Scripts)',
  instructions: `Generate the following video ad components:
- video_hook: 12-15 items (pattern interrupt hooks for first 3 seconds. Mix of: questions, bold claims, stat openers, story openers, "stop scrolling" hooks, controversial takes, relatable moments)
- short_script: 4-6 items (complete ~30 second video scripts. Each should weave 2-3 angles into a narrative arc. Format: [HOOK] then [BODY] then [CTA]. Include stage directions in brackets.)
- long_script: 3-4 items (complete ~60 second video scripts. Multi-angle narratives with emotional arc. Format: [HOOK] then [PROBLEM] then [SOLUTION] then [PROOF] then [CTA].)
- video_script: 2-3 items (full-length scripts weaving 3-4 angles. More detailed with timing notes.)

TOTAL: ~20-28 components for this batch.

IMPORTANT for scripts: Each script should be a COMPLETE, ready-to-read script. Include stage directions in [brackets]. Make hooks punchy and specific to this avatar's world.`,
}

function buildBatchPrompt(
  batch: BatchConfig,
  recommendedAngles: string[],
  adCopyRules: Record<string, unknown> | null,
  adCopyNotes: string | null,
): string {
  const rules = adCopyRules as Record<string, unknown> || {}
  const platformRules = rules.platform_rules as Record<string, Record<string, number>> || {}

  const angleDescriptions = recommendedAngles
    .map(a => `  - ${a}: ${ANGLE_DEFINITIONS[a] || a}`)
    .join('\n')

  return `You are an elite direct-response copywriter generating ${batch.name} for a specific Avatar + Offer campaign.

RECOMMENDED ANGLES:
${angleDescriptions}

You MUST distribute content across ALL angles, not just one. Tag each component with its angle(s) via the "angle_ids" array.

AD COPY RULES (HARD CONSTRAINTS):
Tone: ${JSON.stringify((rules.tone_descriptors as string[]) || [])}
Banned Words (NEVER USE): ${JSON.stringify((rules.banned_words as string[]) || [])}
Required Disclaimers: ${JSON.stringify((rules.required_disclaimers as string[]) || [])}
Platform Rules:
  - Google Ads: Headlines max ${platformRules.google?.headline_max_chars || 30} chars, Descriptions max ${platformRules.google?.description_max_chars || 90} chars
  - Meta Ads: Primary text max ${platformRules.meta?.primary_text_max_chars || 125} chars, Headlines max ${platformRules.meta?.headline_max_chars || 40} chars
Brand Constraints: ${rules.brand_constraints || 'None specified'}
Additional Notes: ${adCopyNotes || 'None'}
${FTC_COMPLIANCE}

FORMATTING RULES:
- NEVER use em dashes in any copy. Use commas, periods, colons instead.
- Every item must be specific to this avatar and offer. No generic copy.

${batch.instructions}

RESPONSE FORMAT:
Respond with a JSON object containing a "copy_components" array. Each component:
{
  "type": "headline",
  "text": "The actual copy text",
  "platform": "meta" | "google" | "youtube" | "all" | "landing_page",
  "angle_ids": ["problem", "fear"]
}

Respond ONLY with valid JSON. No markdown, no explanation.`
}

function buildUserMessage(
  avatar: Record<string, unknown>,
  offer: Record<string, unknown>,
  client: Record<string, unknown>,
  recommendedAngles: string[],
): string {
  return `AVATAR:
Name: ${avatar.name}
Type: ${avatar.avatar_type}
Description: ${avatar.description}
Pain Points: ${avatar.pain_points}
Motivations: ${avatar.motivations}
Objections: ${avatar.objections}
Desired Outcome: ${avatar.desired_outcome}
Trigger Events: ${avatar.trigger_events}
Messaging Style: ${avatar.messaging_style}
Recommended Angles: ${recommendedAngles.join(', ')}

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
Website: ${client.website}
Summary: ${client.business_summary}
Services: ${client.services}
Differentiators: ${client.differentiators}
Trust Signals: ${client.trust_signals}

Generate ALL requested components now. Distribute across ALL angles: ${recommendedAngles.join(', ')}.`
}

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
    const { avatar_id, offer_id } = await req.json()

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

    if (existing) {
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

    // Create funnel instance
    const { data: funnelInstance, error: fiError } = await supabase
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

    if (fiError || !funnelInstance) {
      return errorResponse(`Failed to create funnel instance: ${fiError?.message}`)
    }

    // Build user message (shared across all batches)
    const userMessage = buildUserMessage(
      avatar as unknown as Record<string, unknown>,
      offer as unknown as Record<string, unknown>,
      client as unknown as Record<string, unknown>,
      recommendedAngles,
    )

    // ── Run 3 batches IN PARALLEL ──────────────────────────────────────
    const batches = [BATCH_1_ADS, BATCH_2_PERSUASION, BATCH_3_VIDEO]

    console.log(`Starting 3 parallel generation batches for funnel ${funnelInstance.id}`)

    const batchResults = await Promise.allSettled(
      batches.map(async (batch) => {
        const systemPrompt = buildBatchPrompt(batch, recommendedAngles, client.ad_copy_rules, client.ad_copy_notes)
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
