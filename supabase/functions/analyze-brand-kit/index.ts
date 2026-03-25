// Workflow 9: Analyze Brand Kit from Client Website
// Extracts brand colors, typography, button styles, visual identity from website URL
// Uses AI to analyze and structure the brand elements

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior brand designer and web design analyst. Your job is to analyze a client's website and extract their complete visual brand identity into structured data.

Given a website URL and any available business context, analyze the brand and provide:

1. COLORS - Extract the brand's color palette:
   - primary_color: Main brand color (hex code)
   - secondary_color: Secondary brand color (hex code)
   - accent_color: Accent/CTA color (hex code)
   - background_color: Main background color (hex code)
   - text_color: Primary text color (hex code)
   - additional_colors: Array of any other notable colors used (hex codes)

2. TYPOGRAPHY:
   - heading_font: Font family used for headings (or best guess)
   - body_font: Font family used for body text
   - font_style_notes: Any notable typography patterns (sizes, weights, spacing)

3. BUTTON_STYLE:
   - shape: "rounded", "pill", "square", "soft-rounded"
   - color: Button background color (hex)
   - text_color: Button text color (hex)
   - style_notes: Border, shadow, hover effects observed

4. VISUAL_IDENTITY:
   - overall_style: "modern", "classic", "minimalist", "bold", "corporate", "playful", etc.
   - imagery_style: What kind of images they use (photos, illustrations, icons)
   - layout_pattern: General layout approach (wide sections, cards, grid, etc.)
   - whitespace: "generous", "moderate", "tight"
   - brand_mood: 2-3 word description of the brand feeling

5. LOGO_NOTES:
   - description: Brief description of the logo if visible
   - placement: Where the logo appears (top-left, centered, etc.)
   - style: "wordmark", "icon+text", "icon-only", "monogram", etc.

FORMATTING RULES:
- NEVER use em dashes in any text. Use commas, periods, or colons instead.
- Be specific with hex codes. If you can not determine exact colors, make your best educated guess based on common patterns for the industry.
- If the website URL is not accessible, use the business context to suggest appropriate brand elements.

Respond ONLY with valid JSON matching the structure above. No markdown wrapping.`

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

    // Fetch client data for context
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    if (clientError || !clientData) {
      return errorResponse('Client not found')
    }

    const websiteUrl = clientData.website
    if (!websiteUrl) {
      return errorResponse('Client has no website URL configured. Add a website URL in Business Overview first.')
    }

    // Try to fetch the actual website HTML for better analysis
    let websiteContent = ''
    try {
      const siteResponse = await fetch(websiteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandAnalyzer/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (siteResponse.ok) {
        const html = await siteResponse.text()
        // Extract useful parts: meta tags, style info, visible text (limit size)
        const headMatch = html.match(/<head[\s\S]*?<\/head>/i)
        const headContent = headMatch ? headMatch[0] : ''
        // Get inline styles and CSS links
        const styleMatches = html.match(/<style[\s\S]*?<\/style>/gi) || []
        const styles = styleMatches.join('\n').substring(0, 3000)
        // Get meta tags
        const metaMatches = html.match(/<meta[\s\S]*?>/gi) || []
        const metas = metaMatches.join('\n')
        // Get body text (first 2000 chars)
        const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 2000)

        websiteContent = `
WEBSITE HTML HEAD:
${headContent.substring(0, 2000)}

INLINE STYLES (partial):
${styles}

META TAGS:
${metas}

VISIBLE TEXT (partial):
${bodyText}`
      }
    } catch {
      websiteContent = '(Could not fetch website directly. Analyze based on business context.)'
    }

    const userMessage = `Analyze the brand identity for this website:

WEBSITE URL: ${websiteUrl}
BUSINESS NAME: ${clientData.name}
BUSINESS SUMMARY: ${clientData.business_summary || 'Not available'}
INDUSTRY/SERVICES: ${clientData.services || 'Not specified'}
TONE: ${clientData.tone || 'Not specified'}

${websiteContent}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
    })

    const brandKit = parseJsonResponse<Record<string, unknown>>(response)

    // Store the brand kit on the client record (using ad_copy_rules JSON field or a dedicated field)
    // For now, store in a brand_kit field on the client
    await supabase.from('clients').update({
      brand_kit: brandKit,
      updated_at: new Date().toISOString(),
    }).eq('id', client_id)

    return jsonResponse({
      success: true,
      brand_kit: brandKit,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
