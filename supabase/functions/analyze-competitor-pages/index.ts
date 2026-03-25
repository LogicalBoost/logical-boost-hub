// Workflow 11: Analyze Competitor Landing Pages
// Takes competitor websites from competitor_intel table, fetches their pages,
// and uses AI to analyze above-fold patterns, page structure, offers, and CTAs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior landing page strategist and conversion rate optimizer. You analyze competitor websites to extract actionable intelligence about their landing page strategies.

For each competitor website provided, analyze:

1. ABOVE_FOLD:
   - headline: The main headline
   - subheadline: Supporting text below headline
   - cta_text: Primary call-to-action button text
   - cta_style: Description of CTA button (color, size, shape)
   - hero_type: "image", "video", "illustration", "text-only", "slider"
   - trust_elements: Any trust signals visible above the fold (logos, ratings, badges)
   - urgency: Any urgency elements (countdown, limited offer, etc.)

2. PAGE_STRUCTURE:
   - sections: Ordered list of page sections (e.g., "hero", "social proof", "features", "testimonials", "pricing", "FAQ", "final CTA")
   - estimated_length: "short" (1-2 scrolls), "medium" (3-5 scrolls), "long" (5+ scrolls)
   - navigation_style: "sticky", "standard", "minimal", "hidden"

3. OFFER_ANALYSIS:
   - primary_offer: What they are primarily selling/offering
   - offer_type: "free trial", "demo", "quote", "purchase", "lead magnet", "consultation"
   - pricing_visible: true/false
   - guarantee: Any guarantee mentioned

4. CONVERSION_TACTICS:
   - social_proof_types: Array of proof types used (testimonials, logos, stats, case studies, reviews)
   - objection_handling: How they handle common objections
   - exit_intent: Any exit-intent or pop-up mentions
   - form_fields: Number of form fields if a lead form is visible

5. STRATEGIC_NOTES:
   - strengths: 2-3 things this page does well
   - weaknesses: 2-3 things that could be improved
   - unique_approach: Anything distinctive about their approach

FORMATTING RULES:
- NEVER use em dashes in any text. Use commas, periods, or colons instead.
- Be specific and actionable. No generic observations.
- If you cannot access a website, make your best analysis based on the business name, industry context, and common patterns for that type of business.

Respond with valid JSON:
{
  "analyses": [
    {
      "competitor_name": "...",
      "website": "...",
      "above_fold": {...},
      "page_structure": {...},
      "offer_analysis": {...},
      "conversion_tactics": {...},
      "strategic_notes": {...}
    }
  ],
  "pattern_summary": "2-3 sentence overview of common patterns across competitors",
  "opportunities": ["array of 3-5 strategic opportunities based on gaps"]
}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id } = await req.json()

    if (!client_id) {
      return errorResponse('client_id is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get client info
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    if (!clientData) {
      return errorResponse('Client not found')
    }

    // Get all competitors with websites
    const { data: competitors } = await supabase
      .from('competitor_intel')
      .select('competitor_name, competitor_website')
      .eq('client_id', client_id)
      .not('competitor_website', 'is', null)

    if (!competitors || competitors.length === 0) {
      return errorResponse('No competitors with websites found. Run AI Discover Competitors first.')
    }

    // Deduplicate by website
    const uniqueCompetitors = Array.from(
      new Map(competitors.map(c => [c.competitor_website, c])).values()
    ).slice(0, 10) // Limit to 10 to keep within token limits

    // Try to fetch actual HTML from competitor websites for better analysis
    const websiteContents: string[] = []
    for (const comp of uniqueCompetitors) {
      try {
        const response = await fetch(comp.competitor_website, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CompetitiveAnalyzer/1.0)' },
          signal: AbortSignal.timeout(8000),
        })
        if (response.ok) {
          const html = await response.text()
          // Extract useful content (limit to reasonable size)
          const bodyText = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000)

          const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)
            || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/)
          const metaDesc = metaMatch ? metaMatch[1] : ''
          const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
          const title = titleMatch ? titleMatch[1].trim() : ''

          websiteContents.push(`
COMPETITOR: ${comp.competitor_name}
URL: ${comp.competitor_website}
PAGE TITLE: ${title}
META DESCRIPTION: ${metaDesc}
VISIBLE CONTENT (partial): ${bodyText}`)
        } else {
          websiteContents.push(`
COMPETITOR: ${comp.competitor_name}
URL: ${comp.competitor_website}
(Could not fetch page: HTTP ${response.status})`)
        }
      } catch {
        websiteContents.push(`
COMPETITOR: ${comp.competitor_name}
URL: ${comp.competitor_website}
(Could not fetch page: timeout or error)`)
      }
    }

    const userMessage = `Analyze these competitor landing pages for ${clientData.name} (${clientData.website || 'no website'}):

INDUSTRY CONTEXT:
${clientData.business_summary || clientData.services || 'Not specified'}

COMPETITOR PAGES TO ANALYZE:
${websiteContents.join('\n---\n')}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
    })

    const parsed = parseJsonResponse<Record<string, unknown>>(response)
    const analyses = (parsed.analyses || []) as Array<Record<string, unknown>>
    const patternSummary = parsed.pattern_summary as string || ''
    const opportunities = (parsed.opportunities || []) as string[]

    // Store each analysis as a landing_page type competitor_intel entry
    let analysesAdded = 0
    for (const analysis of analyses) {
      const { error: insertError } = await supabase.from('competitor_intel').insert({
        client_id,
        competitor_name: String(analysis.competitor_name || 'Unknown'),
        competitor_website: analysis.website ? String(analysis.website) : null,
        source: 'ai_discovery',
        ad_type: 'landing_page',
        content: JSON.stringify({
          above_fold: analysis.above_fold,
          page_structure: analysis.page_structure,
          offer_analysis: analysis.offer_analysis,
          conversion_tactics: analysis.conversion_tactics,
        }),
        notes: JSON.stringify(analysis.strategic_notes),
        captured_at: new Date().toISOString(),
      })
      if (!insertError) analysesAdded++
    }

    return jsonResponse({
      success: true,
      analyses_added: analysesAdded,
      analyses,
      pattern_summary: patternSummary,
      opportunities,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
