// Workflow 10: AI-Powered Competitor Discovery
// Uses Claude to identify likely competitors based on business info, industry, and services
// Returns competitor names, websites, and strategic analysis

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a competitive intelligence analyst at a performance marketing agency. Your job is to identify real competitors for a client's business and analyze their competitive positioning.

Given a client's business information, you must identify REAL competitors that actually exist in their market. Focus on:

1. Direct competitors offering similar services in the same geographic area
2. Larger national/regional players that compete for the same keywords
3. Notable online competitors that rank for similar search terms

For each competitor, provide:
- name: The actual business name
- website: Their likely website URL (use standard patterns like businessname.com)
- competitor_type: "direct" (same services, same area), "indirect" (overlapping services), "aspirational" (larger player in the space)
- services_overlap: Brief description of which services overlap with the client
- estimated_strength: "strong", "moderate", "emerging"
- key_differentiator: What this competitor is known for or does differently
- threat_level: "high", "medium", "low"
- notes: Strategic observations about this competitor

Also provide:
- market_overview: 2-3 sentence overview of the competitive landscape
- keyword_opportunities: Array of 5-10 search keywords/phrases competitors likely target
- competitive_gaps: Array of 2-4 gaps or opportunities competitors are missing

IMPORTANT:
- Focus on competitors that are likely REAL businesses. Base your analysis on the industry, location, and services provided.
- If the business is local, emphasize local competitors.
- Include a mix of direct competitors and larger industry players.
- Identify 5-10 competitors.
- NEVER use em dashes in any text. Use commas, periods, or colons instead.

Respond ONLY with valid JSON. Structure:
{
  "market_overview": "...",
  "competitors": [...],
  "keyword_opportunities": [...],
  "competitive_gaps": [...]
}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, user_prompt } = await req.json()

    if (!client_id) {
      return errorResponse('client_id is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client data
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    if (clientError || !clientData) {
      return errorResponse('Client not found')
    }

    // Fetch existing competitors to avoid duplicates
    const { data: existingCompetitors } = await supabase
      .from('competitor_intel')
      .select('competitor_name')
      .eq('client_id', client_id)

    const existingNames = [...new Set((existingCompetitors || []).map(c => c.competitor_name))]

    const userMessage = `Identify competitors for this business:

BUSINESS NAME: ${clientData.name}
WEBSITE: ${clientData.website || 'Not provided'}
BUSINESS SUMMARY: ${clientData.business_summary || 'Not available'}
SERVICES: ${clientData.services || 'Not specified'}
DIFFERENTIATORS: ${clientData.differentiators || 'Not specified'}
TONE/INDUSTRY: ${clientData.tone || 'Not specified'}

${existingNames.length > 0 ? `ALREADY TRACKED COMPETITORS (do not duplicate these):\n${existingNames.join('\n')}` : ''}

${user_prompt ? `ADDITIONAL CONTEXT FROM USER:\n${user_prompt}` : ''}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
    })

    const parsed = parseJsonResponse<Record<string, unknown>>(response)

    // Extract competitors array
    const competitors = (parsed.competitors || []) as Array<Record<string, unknown>>
    const marketOverview = parsed.market_overview as string || ''
    const keywordOpportunities = (parsed.keyword_opportunities || []) as string[]
    const competitiveGaps = (parsed.competitive_gaps || []) as string[]

    // Insert discovered competitors into competitor_intel table
    let competitorsAdded = 0
    if (competitors.length > 0) {
      const records = competitors.map(c => ({
        client_id,
        competitor_name: String(c.name || 'Unknown'),
        competitor_website: c.website ? String(c.website) : null,
        source: 'ai_discovery',
        ad_type: 'overview',
        content: c.services_overlap ? String(c.services_overlap) : null,
        keywords: keywordOpportunities.length > 0 ? keywordOpportunities.slice(0, 5) : null,
        notes: [
          c.competitor_type ? `Type: ${c.competitor_type}` : '',
          c.estimated_strength ? `Strength: ${c.estimated_strength}` : '',
          c.threat_level ? `Threat: ${c.threat_level}` : '',
          c.key_differentiator ? `Differentiator: ${c.key_differentiator}` : '',
          c.notes ? String(c.notes) : '',
        ].filter(Boolean).join('. '),
        captured_at: new Date().toISOString(),
      }))

      const { error: insertError } = await supabase.from('competitor_intel').insert(records)
      if (insertError) {
        console.error('Competitor insert error:', JSON.stringify(insertError))
      } else {
        competitorsAdded = records.length
      }
    }

    return jsonResponse({
      success: true,
      competitors_added: competitorsAdded,
      market_overview: marketOverview,
      keyword_opportunities: keywordOpportunities,
      competitive_gaps: competitiveGaps,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
