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

CRITICAL COLOR RULES:
- You will be given ACTUAL hex colors extracted from the website HTML and CSS. USE THESE EXACT COLORS. Do NOT invent or guess colors.
- The colors are sorted by frequency. The most-used non-black/white color is likely the primary brand color.
- SVG fill/stroke colors are often the logo color. This is usually the primary brand color.
- CSS custom properties with "primary", "brand", "accent" in the name tell you exactly what each color is for.
- Button background colors are the accent/CTA color.
- The theme-color meta tag, if present, is usually the primary brand color.
- Only guess colors as a last resort if NO colors were extracted from the site.

FORMATTING RULES:
- NEVER use em dashes in any text. Use commas, periods, or colons instead.
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

    // Fetch the actual website HTML and extract color data
    let websiteContent = ''
    try {
      const siteResponse = await fetch(websiteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(10000),
      })
      if (siteResponse.ok) {
        const html = await siteResponse.text()

        // 1. Extract ALL hex colors found anywhere in the HTML (inline styles, style tags, SVGs, etc.)
        const hexColors = new Set<string>()
        const hexMatches = html.match(/#[0-9a-fA-F]{3,8}\b/g) || []
        for (const h of hexMatches) {
          // Normalize 3-char to 6-char hex
          const clean = h.toLowerCase()
          if (clean.length === 4) {
            hexColors.add(`#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`)
          } else if (clean.length === 7 || clean.length === 9) {
            hexColors.add(clean)
          }
        }

        // 2. Extract rgb/rgba colors
        const rgbMatches = html.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g) || []

        // 3. Extract CSS custom properties (--color-*, --brand-*, etc.)
        const cssVarMatches = html.match(/--[a-zA-Z-]*(?:color|brand|primary|secondary|accent|bg|background|text|cta|button)[a-zA-Z-]*\s*:\s*[^;}\n]+/gi) || []

        // 4. Extract theme-color meta tag
        const themeColorMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
        const themeColor = themeColorMatch ? themeColorMatch[1] : null

        // 5. Extract msapplication-TileColor
        const tileColorMatch = html.match(/<meta[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']+)["']/i)
        const tileColor = tileColorMatch ? tileColorMatch[1] : null

        // 6. Extract inline style attributes with color info
        const inlineStyleMatches = html.match(/style=["'][^"']*(?:color|background|border)[^"']*["']/gi) || []
        const inlineStyles = inlineStyleMatches.slice(0, 30).join('\n')

        // 7. Extract SVG fill/stroke colors (often the logo)
        const svgColorMatches = html.match(/(?:fill|stroke)=["']#[0-9a-fA-F]{3,8}["']/gi) || []
        const svgColors = [...new Set(svgColorMatches)].join(', ')

        // 8. Get button elements and their styles
        const buttonMatches = html.match(/<(?:button|a)[^>]*(?:class|style)[^>]*>[\s\S]*?<\/(?:button|a)>/gi) || []
        const buttonSamples = buttonMatches.slice(0, 5).join('\n').substring(0, 1500)

        // 9. Get meta tags
        const metaMatches = html.match(/<meta[\s\S]*?>/gi) || []
        const metas = metaMatches.join('\n')

        // 10. Get CSS from linked stylesheets (fetch first 2)
        let externalCssColors = ''
        const cssLinkMatches = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi) || []
        for (const linkTag of cssLinkMatches.slice(0, 2)) {
          const hrefMatch = linkTag.match(/href=["']([^"']+)["']/)
          if (hrefMatch) {
            try {
              let cssUrl = hrefMatch[1]
              if (cssUrl.startsWith('/')) cssUrl = new URL(cssUrl, websiteUrl).href
              else if (!cssUrl.startsWith('http')) cssUrl = new URL(cssUrl, websiteUrl).href
              const cssRes = await fetch(cssUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(5000),
              })
              if (cssRes.ok) {
                const cssText = await cssRes.text()
                // Extract colors from CSS
                const cssHexes = cssText.match(/#[0-9a-fA-F]{3,8}\b/g) || []
                for (const h of cssHexes) {
                  const clean = h.toLowerCase()
                  if (clean.length === 7) hexColors.add(clean)
                }
                // Extract CSS variables
                const cssVars = cssText.match(/--[a-zA-Z-]*(?:color|brand|primary|secondary|accent|bg|background|text|cta|button)[a-zA-Z-]*\s*:\s*[^;}\n]+/gi) || []
                cssVarMatches.push(...cssVars)
              }
            } catch { /* skip failed CSS fetch */ }
          }
        }

        // 11. Get inline style blocks
        const styleMatches = html.match(/<style[\s\S]*?<\/style>/gi) || []
        const styles = styleMatches.join('\n').substring(0, 2000)

        // Sort hex colors by frequency (most used first)
        const colorFrequency: Record<string, number> = {}
        for (const h of hexMatches) {
          const clean = h.toLowerCase().length === 4
            ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase()
            : h.toLowerCase()
          if (clean.length === 7) colorFrequency[clean] = (colorFrequency[clean] || 0) + 1
        }
        const sortedColors = Object.entries(colorFrequency)
          .filter(([c]) => c !== '#ffffff' && c !== '#000000' && c !== '#fff' && c !== '#000')
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([color, count]) => `${color} (used ${count}x)`)

        websiteContent = `
ACTUAL HEX COLORS FOUND ON SITE (sorted by frequency, excluding black/white):
${sortedColors.join('\n')}

ALL UNIQUE COLORS: ${[...hexColors].filter(c => c !== '#ffffff' && c !== '#000000').join(', ')}

RGB COLORS: ${rgbMatches.slice(0, 15).join(', ')}

SVG FILL/STROKE COLORS (likely logo): ${svgColors || 'none found'}

CSS CUSTOM PROPERTIES:
${cssVarMatches.slice(0, 20).join('\n')}

THEME COLOR META: ${themeColor || 'not set'}
TILE COLOR META: ${tileColor || 'not set'}

INLINE STYLES WITH COLOR (sample):
${inlineStyles.substring(0, 1000)}

BUTTON ELEMENTS (sample):
${buttonSamples}

INLINE STYLE BLOCKS (partial):
${styles.substring(0, 1500)}

META TAGS:
${metas}`
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

    const rawBrandKit = parseJsonResponse<Record<string, unknown>>(response)

    // Flatten nested structure into the format the template/deploy expects
    // AI may return { colors: { primary_color: ... }, typography: { ... } }
    // but consumers expect flat { primary_color: ..., heading_font: ... }
    const colors = (rawBrandKit.colors || {}) as Record<string, unknown>
    const typography = (rawBrandKit.typography || {}) as Record<string, unknown>
    const buttonStyle = (rawBrandKit.button_style || rawBrandKit.buttonStyle || {}) as Record<string, unknown>
    const visualIdentity = (rawBrandKit.visual_identity || rawBrandKit.visualIdentity || {}) as Record<string, unknown>
    const logoNotes = (rawBrandKit.logo_notes || rawBrandKit.logoNotes || {}) as Record<string, unknown>

    const flatBrandKit: Record<string, unknown> = {
      // Colors — check flat first, then nested
      primary_color: rawBrandKit.primary_color || colors.primary_color || null,
      secondary_color: rawBrandKit.secondary_color || colors.secondary_color || null,
      accent_color: rawBrandKit.accent_color || colors.accent_color || null,
      background_color: rawBrandKit.background_color || colors.background_color || null,
      text_color: rawBrandKit.text_color || colors.text_color || null,
      additional_colors: rawBrandKit.additional_colors || colors.additional_colors || [],
      // Typography
      heading_font: rawBrandKit.heading_font || typography.heading_font || null,
      body_font: rawBrandKit.body_font || typography.body_font || null,
      font_style_notes: rawBrandKit.font_style_notes || typography.font_style_notes || null,
      // Button style
      button_style: {
        shape: buttonStyle.shape || 'rounded',
        color: buttonStyle.color || null,
        text_color: buttonStyle.text_color || null,
        borderRadius: buttonStyle.shape === 'pill' ? '9999px' : buttonStyle.shape === 'square' ? '0px' : buttonStyle.shape === 'soft-rounded' ? '8px' : '10px',
        style_notes: buttonStyle.style_notes || null,
      },
      // Visual identity (preserved for reference)
      visual_identity: visualIdentity,
      logo_notes: logoNotes,
      // Keep raw for debugging
      _raw: rawBrandKit,
    }

    await supabase.from('clients').update({
      brand_kit: flatBrandKit,
      updated_at: new Date().toISOString(),
    }).eq('id', client_id)

    return jsonResponse({
      success: true,
      brand_kit: flatBrandKit,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
