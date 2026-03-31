// QA Copywriter Review Agent
// Reviews all generated copy components for quality, audience relevance,
// specificity, variety, and emotional resonance

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse, getCustomPrompt } from '../_shared/ai-client.ts'

const HARDCODED_SYSTEM_PROMPT = `You are an elite creative director reviewing ad copy components. Score each component 1-100 on strength, audience fit, emotional resonance, specificity, and variety. Return JSON with overall_score, overall_assessment, top_performers, weakest_items, variety_issues, and component_reviews array.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { funnel_instance_id } = await req.json()
    if (!funnel_instance_id) return errorResponse('funnel_instance_id required')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey)

    // 1. Fetch funnel instance
    const { data: instance, error: instErr } = await sb
      .from('funnel_instances')
      .select('*')
      .eq('id', funnel_instance_id)
      .single()
    if (instErr || !instance) return errorResponse('Funnel instance not found')

    const clientId = instance.client_id

    // 2. Fetch avatar, offer, client in parallel
    const [avatarRes, offerRes, clientRes] = await Promise.all([
      sb.from('avatars').select('*').eq('id', instance.avatar_id).single(),
      sb.from('offers').select('*').eq('id', instance.offer_id).single(),
      sb.from('clients').select('*').eq('id', clientId).single(),
    ])
    const avatar = avatarRes.data
    const offer = offerRes.data
    const client = clientRes.data
    if (!avatar || !offer || !client) return errorResponse('Missing avatar, offer, or client data')

    // 3. Fetch all non-denied copy components for this instance
    const { data: components, error: compErr } = await sb
      .from('copy_components')
      .select('id, type, text, character_count, platform, angle_ids, status')
      .eq('funnel_instance_id', funnel_instance_id)
      .neq('status', 'denied')
      .order('type')
    if (compErr) return errorResponse(`Failed to fetch components: ${compErr.message}`)
    if (!components || components.length === 0) return errorResponse('No copy components to review')

    // 4. Create qa_reviews record with status 'running'
    const { data: review, error: reviewErr } = await sb
      .from('qa_reviews')
      .insert({
        client_id: clientId,
        funnel_instance_id,
        review_type: 'copywriter',
        status: 'running',
        component_reviews: [],
        flagged_count: 0,
      })
      .select()
      .single()
    if (reviewErr) return errorResponse(`Failed to create review: ${reviewErr.message}`)

    // 5. Build the components payload grouped by type
    const componentsByType: Record<string, Array<{ id: string; text: string; platform: string; angles: string[] }>> = {}
    for (const c of components) {
      if (!componentsByType[c.type]) componentsByType[c.type] = []
      componentsByType[c.type].push({
        id: c.id,
        text: c.text,
        platform: c.platform || 'all',
        angles: c.angle_ids || [],
      })
    }

    // 6. Get custom prompt or use hardcoded
    const customPrompt = await getCustomPrompt(sb, clientId, 'qa_copywriter_review')
    const systemPrompt = customPrompt || HARDCODED_SYSTEM_PROMPT

    // 7. Build user message with full context
    const userMessage = `## Campaign Context

**Business:** ${client.name}
**Website:** ${client.website_url || 'N/A'}
**Summary:** ${client.business_summary || 'N/A'}
**Tone:** ${client.tone || 'N/A'}
**Ad Copy Rules:** ${client.ad_copy_rules ? JSON.stringify(client.ad_copy_rules) : 'None specified'}

**Target Avatar:** ${avatar.name}
- Description: ${avatar.description || 'N/A'}
- Pain Points: ${avatar.pain_points ? JSON.stringify(avatar.pain_points) : 'N/A'}
- Desires: ${avatar.desires ? JSON.stringify(avatar.desires) : 'N/A'}

**Offer:** ${offer.name}
- Description: ${offer.description || 'N/A'}
- Price: ${offer.price || 'N/A'}

## Copy Components to Review (${components.length} total)

${JSON.stringify(componentsByType, null, 2)}`

    // 8. Call Claude
    const response = await callClaude(systemPrompt, userMessage, { maxTokens: 16384 })

    // 9. Parse response
    let result: Record<string, unknown>
    try {
      result = parseJsonResponse(response)
    } catch {
      // If parsing fails, save what we got
      await sb.from('qa_reviews').update({
        status: 'failed',
        overall_assessment: 'Failed to parse AI response',
        metadata: { raw_response: response.substring(0, 2000) },
      }).eq('id', review.id)
      return errorResponse('Failed to parse QA review response')
    }

    // 10. Count flagged items (score < 70)
    const componentReviews = (result.component_reviews || []) as Array<Record<string, unknown>>
    const flaggedCount = componentReviews.filter((r) => (r.score as number) < 70).length

    // 11. Update the review record
    await sb.from('qa_reviews').update({
      status: 'completed',
      overall_score: result.overall_score as number || null,
      overall_assessment: result.overall_assessment as string || null,
      component_reviews: componentReviews,
      flagged_count: flaggedCount,
      metadata: {
        total_components: components.length,
        top_performers: result.top_performers || [],
        weakest_items: result.weakest_items || [],
        variety_issues: result.variety_issues || [],
      },
    }).eq('id', review.id)

    return jsonResponse({
      success: true,
      review_id: review.id,
      overall_score: result.overall_score,
      overall_assessment: result.overall_assessment,
      total_components: components.length,
      flagged_count: flaggedCount,
    })

  } catch (err) {
    console.error('QA copywriter review error:', err)
    return errorResponse(`Review failed: ${(err as Error).message}`, 500)
  }
})
