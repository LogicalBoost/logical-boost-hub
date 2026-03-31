// QA Compliance Review Agent
// Reviews all generated copy components against FTC guidelines,
// Google Ads policies, Meta Ads policies, and client-specific rules

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse, getCustomPrompt } from '../_shared/ai-client.ts'

const HARDCODED_SYSTEM_PROMPT = `You are a regulatory compliance specialist reviewing ad copy. Check against FTC guidelines, Google Ads policies (character limits, editorial), Meta/Facebook policies (personal attributes, before/after), and client rules. Return JSON with total_components, passing, flagged, severity_breakdown, overall_assessment, and component_reviews array (flagged items only).`

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

    // 2. Fetch client data (need ad_copy_rules for client-specific checks)
    const { data: client } = await sb
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
    if (!client) return errorResponse('Client not found')

    // 3. Fetch all non-denied copy components
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
        review_type: 'compliance',
        status: 'running',
        component_reviews: [],
        flagged_count: 0,
      })
      .select()
      .single()
    if (reviewErr) return errorResponse(`Failed to create review: ${reviewErr.message}`)

    // 5. Build components list with IDs for reference
    const componentList = components.map((c) => ({
      id: c.id,
      type: c.type,
      text: c.text,
      character_count: c.character_count,
      platform: c.platform || 'all',
    }))

    // 6. Get custom prompt or use hardcoded
    const customPrompt = await getCustomPrompt(sb, clientId, 'qa_compliance_review')
    const systemPrompt = customPrompt || HARDCODED_SYSTEM_PROMPT

    // 7. Build user message
    const userMessage = `## Client Information

**Business:** ${client.name}
**Industry:** ${client.industry || 'N/A'}
**Website:** ${client.website_url || 'N/A'}

## Client Ad Copy Rules
${client.ad_copy_rules ? JSON.stringify(client.ad_copy_rules, null, 2) : 'No client-specific rules defined.'}

## Copy Components to Review (${components.length} total)

${JSON.stringify(componentList, null, 2)}`

    // 8. Call Claude
    const response = await callClaude(systemPrompt, userMessage, { maxTokens: 16384 })

    // 9. Parse response
    let result: Record<string, unknown>
    try {
      result = parseJsonResponse(response)
    } catch {
      await sb.from('qa_reviews').update({
        status: 'failed',
        overall_assessment: 'Failed to parse AI response',
        metadata: { raw_response: response.substring(0, 2000) },
      }).eq('id', review.id)
      return errorResponse('Failed to parse QA compliance response')
    }

    // 10. Extract results
    const componentReviews = (result.component_reviews || []) as Array<Record<string, unknown>>
    const flaggedCount = componentReviews.length
    const severityBreakdown = result.severity_breakdown || { error: 0, warning: 0, info: 0 }

    // 11. Update the review record
    await sb.from('qa_reviews').update({
      status: 'completed',
      overall_score: null, // Compliance doesn't use a score — it's pass/fail
      overall_assessment: result.overall_assessment as string || null,
      component_reviews: componentReviews,
      flagged_count: flaggedCount,
      metadata: {
        total_components: result.total_components || components.length,
        passing: result.passing || (components.length - flaggedCount),
        severity_breakdown: severityBreakdown,
      },
    }).eq('id', review.id)

    return jsonResponse({
      success: true,
      review_id: review.id,
      total_components: components.length,
      passing: result.passing || (components.length - flaggedCount),
      flagged: flaggedCount,
      severity_breakdown: severityBreakdown,
      overall_assessment: result.overall_assessment,
    })

  } catch (err) {
    console.error('QA compliance review error:', err)
    return errorResponse(`Review failed: ${(err as Error).message}`, 500)
  }
})
