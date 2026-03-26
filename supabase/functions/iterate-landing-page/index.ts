// Iterate Landing Page — takes a change request and modifies the existing HTML

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { landing_page_id, user_prompt } = await req.json()

    if (!landing_page_id || !user_prompt) {
      return errorResponse('landing_page_id and user_prompt are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch the landing page
    const { data: page, error: fetchError } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landing_page_id)
      .single()

    if (fetchError || !page) {
      return errorResponse(`Landing page not found: ${fetchError?.message || 'No data'}`)
    }

    const currentHtml = page.stitch_output_code || page.page_html || ''
    if (!currentHtml) {
      return errorResponse('No existing HTML to iterate on')
    }

    const systemPrompt = `You are an expert landing page designer. You will receive an existing HTML landing page and a change request. Apply the requested changes while preserving the overall structure and design quality.

RULES:
- Return the COMPLETE modified HTML document (<!DOCTYPE html> to </html>)
- Preserve all existing styles, fonts, and layout unless the change request specifically asks to modify them
- Keep the page mobile-responsive
- Do not remove sections unless explicitly asked
- NEVER use em dashes
- No markdown, no explanation, no code fences — ONLY the HTML

OUTPUT FORMAT:
Return ONLY the complete HTML document. Nothing else.`

    const userMessage = `Here is the current landing page HTML:

${currentHtml}

CHANGE REQUEST:
${user_prompt}

Apply the changes and return the complete updated HTML.`

    const html = await callClaude(systemPrompt, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 16384,
    })

    // Clean up
    let cleanHtml = html.trim()
    if (cleanHtml.startsWith('```')) {
      cleanHtml = cleanHtml.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    // Build iteration history
    const history = Array.isArray(page.iteration_history) ? [...page.iteration_history] : []
    history.push({
      version: history.length + 1,
      prompt: user_prompt,
      stitch_preview_url: null,
      created_at: new Date().toISOString(),
    })

    // Update the landing page
    const { data: updated, error: updateError } = await supabase
      .from('landing_pages')
      .update({
        page_html: cleanHtml,
        stitch_output_code: cleanHtml,
        iteration_history: history,
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
      landing_page: updated,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
