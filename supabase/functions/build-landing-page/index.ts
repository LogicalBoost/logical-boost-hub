// Build Landing Page — new pipeline using copy slots + wireframe templates
// Takes pre-mapped copy slots and generates a full landing page via Claude

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, avatar_id, offer_id, template_id, copy_slots } = await req.json()

    if (!client_id || !avatar_id || !offer_id || !template_id || !copy_slots) {
      return errorResponse('client_id, avatar_id, offer_id, template_id, and copy_slots are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch all required data in parallel
    const [clientRes, avatarRes, offerRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('avatars').select('*').eq('id', avatar_id).single(),
      supabase.from('offers').select('*').eq('id', offer_id).single(),
    ])

    if (clientRes.error || !clientRes.data) {
      return errorResponse(`Client not found: ${clientRes.error?.message || 'No data'}`)
    }
    if (avatarRes.error || !avatarRes.data) {
      return errorResponse(`Avatar not found: ${avatarRes.error?.message || 'No data'}`)
    }
    if (offerRes.error || !offerRes.data) {
      return errorResponse(`Offer not found: ${offerRes.error?.message || 'No data'}`)
    }

    const client = clientRes.data
    const avatar = avatarRes.data
    const offer = offerRes.data

    // Build the website URL for brand extraction
    const brandUrl = client.brand_reference_url || client.website || ''

    // Format copy slots for the prompt
    const slotsText = Object.entries(copy_slots)
      .filter(([_, v]) => v && String(v).trim())
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    const systemPrompt = `You are an expert landing page designer and direct-response copywriter. You generate complete, production-ready HTML landing pages.

DESIGN RULES:
- Modern, clean, professional design with generous whitespace
- Mobile-responsive (use CSS media queries)
- Dark backgrounds with light text OR light backgrounds with dark text — pick what fits the brand
- Use CSS custom properties for colors so the brand palette is easy to swap
- Smooth scroll behavior, subtle hover effects
- No external dependencies — all CSS inline in a <style> tag
- All fonts via Google Fonts <link> in the <head>
- Images use placeholder URLs (https://placehold.co/WxH) — the client will replace later
- Sections flow naturally with visual variety (alternating backgrounds, card layouts, etc.)
- CTAs are prominent with high contrast
- NEVER use em dashes

OUTPUT FORMAT:
Return ONLY the complete HTML document (<!DOCTYPE html> to </html>). No markdown, no explanation, no code fences.`

    const userMessage = `Build a landing page using the "${template_id}" wireframe template.

BUSINESS:
Name: ${client.name || 'N/A'}
Website: ${brandUrl || 'N/A'}
Summary: ${client.business_summary || 'N/A'}
Differentiators: ${client.differentiators || 'N/A'}
Tone: ${client.tone || 'N/A'}

TARGET AVATAR:
Name: ${avatar.name}
Type: ${avatar.avatar_type || 'N/A'}
Pain Points: ${avatar.pain_points || 'N/A'}
Motivations: ${avatar.motivations || 'N/A'}
Objections: ${avatar.objections || 'N/A'}
Desired Outcome: ${avatar.desired_outcome || 'N/A'}

OFFER:
Name: ${offer.name}
Headline: ${offer.headline || 'N/A'}
Description: ${offer.description || 'N/A'}
Primary CTA: ${offer.primary_cta || 'N/A'}
Conversion Type: ${offer.conversion_type || 'N/A'}
Benefits: ${Array.isArray(offer.benefits) ? offer.benefits.join(', ') : offer.benefits || 'N/A'}

COPY SLOTS (use these exact words for the corresponding page sections):
${slotsText}

Generate a complete, beautiful, production-ready HTML landing page. Use the copy slots as the primary content. Fill in any structural elements (navigation, footer, spacing) as needed for a polished result.`

    const html = await callClaude(systemPrompt, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 16384,
    })

    // Clean up — remove any markdown code fences if present
    let cleanHtml = html.trim()
    if (cleanHtml.startsWith('```')) {
      cleanHtml = cleanHtml.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    // Extract headline from copy slots for the record
    const headline = copy_slots.t1_headline || copy_slots.t2_headline || copy_slots.t3_headline ||
      copy_slots.t4_headline || copy_slots.t5_headline || copy_slots.t6_headline ||
      copy_slots.t7_headline || copy_slots.t8_headline || ''
    const cta = copy_slots.t1_cta || copy_slots.t2_hero_cta || copy_slots.t3_form_cta ||
      copy_slots.t4_primary_cta || copy_slots.t5_primary_cta || copy_slots.t6_hero_cta ||
      copy_slots.t7_hero_cta || copy_slots.t8_hero_cta || ''

    // Insert landing page record
    const { data: landingPage, error: insertError } = await supabase
      .from('landing_pages')
      .insert({
        client_id,
        avatar_id,
        offer_id,
        template_id,
        copy_slots,
        page_html: cleanHtml,
        stitch_output_code: cleanHtml,
        headline,
        cta,
        brand_kit_snapshot: client.brand_kit || {},
        deploy_status: 'draft',
        status: 'approved',
        iteration_history: [{
          version: 1,
          prompt: 'Initial build',
          stitch_preview_url: null,
          created_at: new Date().toISOString(),
        }],
      })
      .select()
      .single()

    if (insertError) {
      return errorResponse(`Failed to save landing page: ${insertError.message}`, 500)
    }

    return jsonResponse({
      success: true,
      landing_page: landingPage,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
