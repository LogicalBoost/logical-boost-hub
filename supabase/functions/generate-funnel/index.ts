// Workflow 4: Generate Funnel Instance (Spec v2.1)
// Trigger: User selects Avatar + Offer on Funnel page, no existing instance
// Generates ~130-180 copy components across ALL recommended angles in one call
// One funnel_instance per Avatar+Offer — permanent, cannot be regenerated

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const FTC_COMPLIANCE = `
FTC & PLATFORM COMPLIANCE (MANDATORY — VIOLATIONS WILL BE REJECTED):
- NEVER fabricate testimonials, reviews, or case studies. All proof must be based on real data provided.
- NEVER invent statistics, percentages, or numerical claims unless directly from the business data.
- NEVER make income guarantees or unrealistic promises.
- NEVER use deceptive before/after claims without factual basis.
- All claims must be truthful and substantiatable.
- Google Ads policy: No misleading claims, no excessive capitalization, no prohibited content.
- Meta Ads policy: No personal attributes targeting, no sensationalized language about identity.
- Required disclaimers must be included where specified in ad copy rules.
- Be aggressive and compelling, but NEVER illegal, untrue, or based on fabricated evidence.
- Proof statements should reference real trust signals from the business data — if none exist, use general industry language without specific fake claims.`

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

function buildSystemPrompt(
  recommendedAngles: string[],
  adCopyRules: Record<string, unknown> | null,
  adCopyNotes: string | null
): string {
  const rules = adCopyRules as Record<string, unknown> || {}
  const platformRules = rules.platform_rules as Record<string, Record<string, number>> || {}

  const angleDescriptions = recommendedAngles
    .map(a => `  - ${a}: ${ANGLE_DEFINITIONS[a] || a}`)
    .join('\n')

  return `You are an elite direct-response copywriter and campaign strategist working inside a performance marketing agency. You are generating a COMPLETE campaign asset library for a specific Avatar + Offer combination.

RECOMMENDED ANGLES FOR THIS COMBO:
${angleDescriptions}

You MUST generate content across ALL of these angles — not just one. Each copy component should be tagged with the angle(s) it uses via the "angle_ids" array. Video scripts and landing page copy should weave 2-4 angles into narrative arcs.

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
${FTC_COMPLIANCE}

FORMATTING RULES (HARD CONSTRAINTS):
- NEVER use em dashes (—) in any copy. Use commas, periods, colons, or separate sentences instead.

QUALITY STANDARDS:
- Every headline must be specific to this avatar and offer. No generic copy.
- Benefits must be SHORT, punchy bullet points (5-10 words max). Think banner copy and landing page bullet lists. No full sentences. Examples: "24/7 Emergency Response", "Licensed & Insured Technicians", "Same-Day Service Available". NOT long explanatory paragraphs.
- Proof statements must reference REAL trust signals from the business data. Never invent claims.
- CTAs must be action-oriented and specific to the offer's conversion type.
- Video hooks must create pattern interrupts within the first 3 seconds.
- Social copy must read naturally, not like an ad.
- Distribute content EVENLY across all recommended angles.

GENERATION QUANTITIES (generate ALL of these):
- headline: 20-30 (mix of Google 30ch and Meta 40ch lengths)
- google_headline: 15-20 (strict 30 char max)
- google_description: 8-12 (strict 90 char max)
- primary_text: 8-12 (Meta, 125ch recommended)
- subheadline: 5-8
- benefit: 10-15 (SHORT bullet points, 5-10 words each, for banners and landing page bullet lists)
- proof: 6-10 (based on REAL data only)
- urgency: 4-6
- fear_point: 4-6
- value_point: 4-6
- cta: 8-10
- video_hook: 10-15 (various hook types: question, stat, bold claim, story opener, pattern interrupt)
- short_script: 3-5 (~30 second scripts, multi-angle)
- long_script: 2-3 (~60 second scripts, multi-angle)
- video_script: 1-2 (full-length, weaving multiple angles)
- objection_handler: 4-6
- hero_headline: 3-5 (landing page above-fold)
- hero_subheadline: 3-5
- hero_cta: 3-5
- urgency_bar: 2-3 (top-of-page urgency strip)
- description: 3-5

TOTAL: ~130-180 components.

RESPONSE FORMAT:
Respond with a JSON object containing a "copy_components" array. Each component must have:
{
  "type": "headline",
  "text": "The actual copy text",
  "platform": "meta" | "google" | "youtube" | "all" | "landing_page",
  "angle_ids": ["problem", "fear"]
}

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`
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
      // Check if this instance has any copy components
      const { count } = await supabase
        .from('copy_components')
        .select('*', { count: 'exact', head: true })
        .eq('funnel_instance_id', existing.id)

      if (count && count > 0) {
        return errorResponse('A funnel instance already exists for this Avatar + Offer. Use Generate More to add items.')
      }

      // Instance exists but has 0 components (previous generation failed)
      // Delete the empty instance so we can recreate it
      await supabase.from('funnel_instances').delete().eq('id', existing.id)
    }

    // Fetch all required data
    const { data: avatar } = await supabase.from('avatars').select('*').eq('id', avatar_id).single()
    const { data: offer } = await supabase.from('offers').select('*').eq('id', offer_id).single()
    if (!avatar || !offer) return errorResponse('Avatar or offer not found')

    const { data: client } = await supabase.from('clients').select('*').eq('id', avatar.client_id).single()
    if (!client) return errorResponse('Client not found')

    // Get recommended angles from avatar, or use defaults
    let recommendedAngles = avatar.recommended_angles as string[] || []
    if (recommendedAngles.length === 0) {
      // Default to a balanced set of 4 angles
      recommendedAngles = ['problem', 'outcome', 'proof', 'curiosity']
    }
    // Ensure at least 3, max 5
    if (recommendedAngles.length < 3) {
      const fallbacks = ['mechanism', 'fear', 'speed', 'authority']
      for (const f of fallbacks) {
        if (!recommendedAngles.includes(f)) recommendedAngles.push(f)
        if (recommendedAngles.length >= 3) break
      }
    }
    if (recommendedAngles.length > 5) recommendedAngles = recommendedAngles.slice(0, 5)

    // Create funnel instance (one per Avatar+Offer, permanent)
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

    // Build system prompt with all recommended angles
    const systemPrompt = buildSystemPrompt(recommendedAngles, client.ad_copy_rules, client.ad_copy_notes)

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

Generate the complete campaign asset library now. Remember: distribute content across ALL recommended angles (${recommendedAngles.join(', ')}) and tag each component with its angle_ids.`

    const response = await callClaude(systemPrompt, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 16384,
    })

    const rawParsed = parseJsonResponse<Record<string, unknown>>(response)

    // Unwrap if AI nests everything under a top-level key
    const keys = Object.keys(rawParsed)
    const unwrapped = (keys.length === 1 && typeof rawParsed[keys[0]] === 'object' && !Array.isArray(rawParsed[keys[0]]))
      ? rawParsed[keys[0]] as Record<string, unknown>
      : rawParsed

    // Extract copy_components — AI may use different key names
    let copyComponents = (unwrapped.copy_components || unwrapped.components || unwrapped.campaign_assets || []) as Array<Record<string, unknown>>

    // If no array found, check if structured by type
    if (!Array.isArray(copyComponents) || copyComponents.length === 0) {
      copyComponents = []
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
            .replace('headline', 'headline')
            .replace('element', '')
          for (const item of items) {
            if (typeof item === 'string') {
              copyComponents.push({ type: normalizedType, text: item, platform: 'all', angle_ids: recommendedAngles.slice(0, 1) })
            } else if (typeof item === 'object' && item !== null) {
              copyComponents.push({ ...item as Record<string, unknown>, type: (item as Record<string, unknown>).type || normalizedType })
            }
          }
        }
      }
    }

    console.log(`Parsed ${copyComponents.length} copy components from AI response`)
    if (copyComponents.length === 0) {
      console.error('Zero components parsed. Raw response (first 500 chars):', response.substring(0, 500))
      console.error('Unwrapped keys:', Object.keys(unwrapped))
    }

    // Insert copy components
    let componentsCreated = 0
    if (copyComponents.length > 0) {
      const records = copyComponents.map(c => {
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

      // Insert in batches if needed (Supabase has row limits)
      const batchSize = 50
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        const { error: insertError } = await supabase.from('copy_components').insert(batch)
        if (insertError) {
          console.error(`Copy component batch insert error (batch ${i / batchSize}):`, JSON.stringify(insertError))
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
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
