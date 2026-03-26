// Edit Landing Page Section — AI-powered editing of individual sections or full page
// Accepts a user prompt describing the desired changes

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import { COPYWRITER_IDENTITY, QUALITY_RULES, FORMATTING_RULES } from '../_shared/copywriter-prompts.ts'
import { renderLandingPage } from '../_shared/template-renderer.ts'

interface Section {
  id: string
  type: string
  order: number
  content: Record<string, unknown>
}

function buildSectionEditPrompt(section: Section): string {
  return `${COPYWRITER_IDENTITY}

${QUALITY_RULES}

${FORMATTING_RULES}

You are editing a single section of a landing page. You will receive the current section content and a user instruction describing what to change.

RULES:
- Maintain the EXACT same JSON structure. Do not add or remove keys.
- Do not change the section "id", "type", or "order" fields.
- Only modify the "content" object based on the user's instruction.
- Keep the copy on-brand, specific, and persuasive.
- NEVER use em dashes. Use commas, periods, colons, or separate sentences instead.
- If the user asks to rewrite, generate fresh content that still fits the section type.
- If the user asks to tweak, make minimal targeted changes.

Respond ONLY with valid JSON representing the updated section object (including id, type, order, and content). No markdown, no explanation outside the JSON.`
}

function buildFullPageEditPrompt(): string {
  return `${COPYWRITER_IDENTITY}

${QUALITY_RULES}

${FORMATTING_RULES}

You are editing an entire landing page. You will receive all current section data and a user instruction describing what to change across the page.

RULES:
- Maintain the EXACT same JSON structure for every section. Do not add or remove sections.
- Do not change any section "id", "type", or "order" fields.
- Only modify "content" objects based on the user's instruction.
- Keep the copy on-brand, specific, and persuasive throughout.
- NEVER use em dashes. Use commas, periods, colons, or separate sentences instead.
- Ensure the page still flows as a single persuasion arc after edits.
- If the user asks for a tone change, apply it consistently across all sections.

Respond ONLY with valid JSON: an array of section objects (each with id, type, order, content). No markdown, no explanation outside the JSON.`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { landing_page_id, user_prompt, edit_scope, section_id } = await req.json()

    if (!landing_page_id || !user_prompt || !edit_scope) {
      return errorResponse('landing_page_id, user_prompt, and edit_scope are required')
    }

    if (edit_scope !== 'section' && edit_scope !== 'full_page') {
      return errorResponse('edit_scope must be "section" or "full_page"')
    }

    if (edit_scope === 'section' && !section_id) {
      return errorResponse('section_id is required when edit_scope is "section"')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch the landing page
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landing_page_id)
      .single()

    if (lpError || !landingPage) {
      return errorResponse(`Landing page not found: ${lpError?.message || 'No data'}`)
    }

    const sectionData: Section[] = landingPage.section_data || []

    // Fetch associated client, avatar, offer for context
    const [clientRes, avatarRes, offerRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', landingPage.client_id).single(),
      landingPage.avatar_id
        ? supabase.from('avatars').select('*').eq('id', landingPage.avatar_id).single()
        : Promise.resolve({ data: null, error: null }),
      landingPage.offer_id
        ? supabase.from('offers').select('*').eq('id', landingPage.offer_id).single()
        : Promise.resolve({ data: null, error: null }),
    ])

    const client = clientRes.data
    const avatar = avatarRes.data
    const offer = offerRes.data

    // Build business context block
    const contextBlock = `BUSINESS CONTEXT:
Name: ${client?.name || 'N/A'}
Business Summary: ${client?.business_summary || 'N/A'}
Differentiators: ${client?.differentiators || 'N/A'}
Trust Signals: ${client?.trust_signals || 'N/A'}
Tone: ${client?.tone || 'N/A'}

TARGET AVATAR:
Name: ${avatar?.name || 'N/A'}
Pain Points: ${avatar?.pain_points || 'N/A'}
Motivations: ${avatar?.motivations || 'N/A'}
Desired Outcome: ${avatar?.desired_outcome || 'N/A'}

OFFER:
Name: ${offer?.name || 'N/A'}
Headline: ${offer?.headline || 'N/A'}
Description: ${offer?.description || 'N/A'}
Primary CTA: ${offer?.primary_cta || 'N/A'}`

    let updatedSections: Section[]

    if (edit_scope === 'section') {
      // Find the target section
      const targetSection = sectionData.find(s => s.id === section_id)
      if (!targetSection) {
        return errorResponse(`Section "${section_id}" not found in landing page`)
      }

      const systemPrompt = buildSectionEditPrompt(targetSection)
      const userMessage = `${contextBlock}

CURRENT SECTION CONTENT:
${JSON.stringify(targetSection, null, 2)}

USER EDITING INSTRUCTION:
${user_prompt}

Return the updated section as a complete JSON object with id, type, order, and the modified content.`

      const response = await callClaude(systemPrompt, userMessage, {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
      })

      const updatedSection = parseJsonResponse<Section>(response)

      // Replace the section in the array, preserving id/type/order from original
      updatedSections = sectionData.map(s => {
        if (s.id === section_id) {
          return {
            id: s.id,
            type: s.type,
            order: s.order,
            content: updatedSection.content,
          }
        }
        return s
      })
    } else {
      // Full page edit
      const systemPrompt = buildFullPageEditPrompt()
      const userMessage = `${contextBlock}

CURRENT PAGE SECTIONS:
${JSON.stringify(sectionData, null, 2)}

USER EDITING INSTRUCTION:
${user_prompt}

Return the complete updated array of section objects.`

      const response = await callClaude(systemPrompt, userMessage, {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
      })

      const parsedSections = parseJsonResponse<Section[]>(response)

      // Preserve original ids/types/orders, only update content
      updatedSections = sectionData.map(original => {
        const updated = parsedSections.find(s => s.id === original.id)
        if (updated) {
          return {
            id: original.id,
            type: original.type,
            order: original.order,
            content: updated.content,
          }
        }
        return original
      })
    }

    // Re-render the full page HTML
    const pageHtml = renderLandingPage(
      landingPage.template_id || 'clean_authority',
      updatedSections as any[],
      landingPage.brand_kit_snapshot || {},
      offerRes.data || { conversion_type: 'lead_form', primary_cta: 'Get Started' },
      client?.name || 'Client',
      client?.logo_url
    )

    // Update the landing page record
    const { data: updatedPage, error: updateError } = await supabase
      .from('landing_pages')
      .update({
        section_data: updatedSections,
        page_html: pageHtml,
        updated_at: new Date().toISOString(),
      })
      .eq('id', landing_page_id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(`Failed to update landing page: ${updateError.message}`, 500)
    }

    return jsonResponse({
      success: true,
      landing_page: updatedPage,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
