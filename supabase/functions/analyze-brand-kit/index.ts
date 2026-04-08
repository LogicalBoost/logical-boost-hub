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
   - heading_font: Font family used for headings. USE the actual font names from Google Fonts links or font-family CSS declarations provided. NEVER guess if actual font data is provided.
   - body_font: Font family used for body text. USE the actual font names extracted from the site. If multiple fonts are found, the one on body/p elements is the body font, the one on h1-h6 is the heading font.
   - font_style_notes: Any notable typography patterns (sizes, weights, spacing)

   CRITICAL FONT RULES:
   - You will be given ACTUAL font names extracted from Google Fonts links and CSS font-family declarations. USE THESE EXACT NAMES.
   - Google Fonts link families are the most reliable source. If the site loads "Muli" and "Comfortaa" from Google Fonts, those ARE the fonts.
   - NEVER say "System default" if actual font names were detected.
   - If only one font is found, use it for both heading and body.

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

        // 10. Fetch external CSS stylesheets — extract colors (fonts extracted later in step 12f)
        const cssLinkMatches = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []
        const fetchedCssTexts: Map<string, string> = new Map() // cache to avoid double-fetching
        for (const linkTag of cssLinkMatches.slice(0, 5)) {
          const hrefMatch = linkTag.match(/href=["']([^"']+)["']/)
          if (!hrefMatch) continue
          try {
            let cssUrl = hrefMatch[1]
            if (cssUrl.includes('fonts.googleapis.com') || cssUrl.includes('use.typekit.net')) continue // handled in font step
            if (cssUrl.startsWith('//')) cssUrl = 'https:' + cssUrl
            else if (cssUrl.startsWith('/')) cssUrl = new URL(cssUrl, websiteUrl).href
            else if (!cssUrl.startsWith('http')) cssUrl = new URL(cssUrl, websiteUrl).href
            if (fetchedCssTexts.has(cssUrl)) continue
            const cssRes = await fetch(cssUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(5000),
            })
            if (cssRes.ok) {
              const cssText = await cssRes.text()
              fetchedCssTexts.set(cssUrl, cssText)
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

        // 11. Get inline style blocks
        const styleMatches = html.match(/<style[\s\S]*?<\/style>/gi) || []
        const styles = styleMatches.join('\n').substring(0, 2000)

        // 12. Extract FONT information — comprehensive multi-source approach
        const GENERIC_FONTS = new Set(['inherit', 'initial', 'unset', 'revert', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Liberation Sans', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Lucida Console'])
        const fontFamilies = new Set<string>()
        const fontFaceFamilies = new Set<string>()
        const googleFontFamilies: string[] = []

        // Helper: extract clean font name from a font-family value
        const extractFontName = (value: string) => {
          const firstName = value.split(',')[0].trim().replace(/["']/g, '').trim()
          if (firstName && !GENERIC_FONTS.has(firstName)) return firstName
          return null
        }

        // 12a. Google Fonts links — parse URL AND fetch the CSS for @font-face names
        const googleFontLinks = html.match(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi) || []
        for (const link of googleFontLinks) {
          const hrefMatch = link.match(/href=["']([^"']+)["']/)
          if (hrefMatch) {
            let url = hrefMatch[1]
            if (url.startsWith('//')) url = 'https:' + url
            // Parse family names from URL (works for both v1 and v2 API)
            const familyMatches = url.match(/family=([^&"']+)/gi) || []
            for (const fm of familyMatches) {
              const name = decodeURIComponent(fm.replace('family=', '').split(':')[0].replace(/\+/g, ' '))
              if (name) googleFontFamilies.push(name)
            }
            // Also fetch the CSS file to get actual @font-face font-family names
            try {
              const gfRes = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                signal: AbortSignal.timeout(5000),
              })
              if (gfRes.ok) {
                const gfCss = await gfRes.text()
                const faceMatches = gfCss.match(/font-family\s*:\s*['"]?([^'";}\n]+)/gi) || []
                for (const fm of faceMatches) {
                  const name = fm.replace(/font-family\s*:\s*/i, '').trim().replace(/["']/g, '').trim()
                  if (name && !GENERIC_FONTS.has(name)) {
                    fontFaceFamilies.add(name)
                    googleFontFamilies.push(name) // also add to google fonts list
                  }
                }
              }
            } catch { /* skip */ }
          }
        }
        // Deduplicate Google Font names
        const uniqueGoogleFonts = [...new Set(googleFontFamilies)]

        // 12b. Adobe Fonts / Typekit
        const typekitFonts: string[] = []
        const typekitLinks = html.match(/<link[^>]*use\.typekit\.net[^>]*>/gi) || []
        const typekitScripts = html.match(/<script[^>]*use\.typekit\.net[^>]*>/gi) || []
        for (const link of [...typekitLinks, ...typekitScripts]) {
          const hrefMatch = link.match(/(?:href|src)=["']([^"']+)["']/)
          if (hrefMatch) {
            try {
              let tkUrl = hrefMatch[1]
              if (tkUrl.startsWith('//')) tkUrl = 'https:' + tkUrl
              const tkRes = await fetch(tkUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(5000),
              })
              if (tkRes.ok) {
                const tkCss = await tkRes.text()
                const tkFontMatches = tkCss.match(/font-family\s*:\s*["']?([^"';}\n]+)/gi) || []
                for (const fm of tkFontMatches) {
                  const name = fm.replace(/font-family\s*:\s*/i, '').trim().replace(/["']/g, '').trim()
                  if (name && !GENERIC_FONTS.has(name)) {
                    typekitFonts.push(name)
                    fontFaceFamilies.add(name)
                  }
                }
              }
            } catch { /* skip */ }
          }
        }

        // 12c. Font preload tags (reliable — sites explicitly declare important fonts)
        const preloadFonts: string[] = []
        const preloadMatches = html.match(/<link[^>]*rel=["']preload["'][^>]*as=["']font["'][^>]*>/gi) || []
        for (const pl of preloadMatches) {
          const hrefMatch = pl.match(/href=["']([^"']+)["']/)
          if (hrefMatch) {
            // Extract font name from filename: /fonts/Inter-Bold.woff2 → Inter
            const filename = hrefMatch[1].split('/').pop() || ''
            const fontName = filename.replace(/[-_]?(regular|bold|italic|light|medium|semibold|thin|black|extra|variable|subset|latin|woff2?|ttf|otf|eot)\b.*/gi, '').replace(/[-_.]/g, ' ').trim()
            if (fontName && fontName.length > 1) preloadFonts.push(fontName)
          }
        }

        // 12d. @font-face in inline <style> blocks
        const allCssText = styles + '\n' + inlineStyles
        const inlineFontFaces = allCssText.match(/@font-face\s*\{[^}]*\}/gi) || []
        for (const ff of inlineFontFaces) {
          const nameMatch = ff.match(/font-family\s*:\s*["']?([^"';}\n]+)/i)
          if (nameMatch) {
            const name = nameMatch[1].trim().replace(/["']/g, '').trim()
            if (name && !GENERIC_FONTS.has(name) && !name.startsWith('__')) fontFaceFamilies.add(name)
          }
        }

        // 12e. font-family declarations from inline styles + style blocks
        const fontFamilyMatches = allCssText.match(/font-family\s*:\s*([^;}"]+)/gi) || []
        for (const fm of fontFamilyMatches) {
          const value = fm.replace(/font-family\s*:\s*/i, '').trim()
          const name = extractFontName(value)
          // Skip next/font generated names (start with __)
          if (name && !name.startsWith('__')) fontFamilies.add(name)
        }

        // 12f. External CSS files — extract font-family + @font-face from cached CSS (already fetched in step 10)
        for (const [, cssText] of fetchedCssTexts) {
          // font-family usage
          const cssFontMatches = cssText.match(/font-family\s*:\s*([^;}"]+)/gi) || []
          for (const fm of cssFontMatches) {
            const value = fm.replace(/font-family\s*:\s*/i, '').trim()
            const name = extractFontName(value)
            if (name && !name.startsWith('__')) fontFamilies.add(name)
          }
          // @font-face declarations
          const fontFaceBlocks = cssText.match(/@font-face\s*\{[^}]*\}/gi) || []
          for (const ff of fontFaceBlocks) {
            const nameMatch = ff.match(/font-family\s*:\s*["']?([^"';}\n]+)/i)
            if (nameMatch) {
              const name = nameMatch[1].trim().replace(/["']/g, '').trim()
              if (name && !GENERIC_FONTS.has(name) && !name.startsWith('__')) fontFaceFamilies.add(name)
            }
          }
          // Also check for Google Fonts @import in CSS
          const importMatches = cssText.match(/@import\s+url\(['"]?([^'")]+fonts\.googleapis\.com[^'")]+)['"]?\)/gi) || []
          for (const imp of importMatches) {
            const urlMatch = imp.match(/url\(['"]?([^'")]+)['"]?\)/)
            if (urlMatch) {
              const familyMatches2 = urlMatch[1].match(/family=([^&"']+)/gi) || []
              for (const fm of familyMatches2) {
                const name = decodeURIComponent(fm.replace('family=', '').split(':')[0].replace(/\+/g, ' '))
                if (name) uniqueGoogleFonts.push(name)
              }
            }
          }
        }

        // 12g. Next.js / Nuxt font config — look for data attributes and script config
        const nextFontMatches = html.match(/data-font-family=["']([^"']+)["']/gi) || []
        for (const nf of nextFontMatches) {
          const name = nf.replace(/data-font-family=["']/i, '').replace(/["']$/, '').trim()
          if (name && !GENERIC_FONTS.has(name)) fontFamilies.add(name)
        }

        // 12h. CSS custom properties with font info
        const fontVarMatches = (allCssText + '\n' + (html.match(/--[a-zA-Z-]*font[a-zA-Z-]*\s*:\s*[^;}\n"']+/gi) || []).join('\n'))
          .match(/--[a-zA-Z-]*font[a-zA-Z-]*\s*:\s*[^;}\n"']+/gi) || []

        // Build comprehensive font info for Claude
        const fontInfo = `
GOOGLE FONTS LOADED: ${uniqueGoogleFonts.length > 0 ? [...new Set(uniqueGoogleFonts)].join(', ') : 'none detected'}
ADOBE FONTS / TYPEKIT: ${typekitFonts.length > 0 ? [...new Set(typekitFonts)].join(', ') : 'none detected'}
@FONT-FACE FAMILIES (custom web fonts): ${fontFaceFamilies.size > 0 ? [...fontFaceFamilies].join(', ') : 'none detected'}
FONT-FAMILY DECLARATIONS (CSS usage): ${fontFamilies.size > 0 ? [...fontFamilies].join(', ') : 'none detected'}
PRELOADED FONT FILES: ${preloadFonts.length > 0 ? preloadFonts.join(', ') : 'none detected'}
CSS FONT VARIABLES: ${fontVarMatches.slice(0, 10).join('\n') || 'none'}
`

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

TYPOGRAPHY/FONTS DETECTED:
${fontInfo}

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
