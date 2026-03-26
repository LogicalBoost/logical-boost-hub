// Iterate Landing Page -- takes a change request and sends the original prompt
// plus the iteration instruction back to Stitch for a new design.
//
// Uses the iteration pattern from the master prompt spec:
// [original full prompt] + [iteration instruction with change request]
// This preserves brand extraction, global rules, and copy context.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'
import { generateWithStitch } from '../_shared/stitch-client.ts'

/**
 * Assemble the iteration prompt per the master spec:
 * Original prompt + change instruction appended.
 */
function assembleIterationPrompt(previousPrompt: string, userChangeRequest: string): string {
  const iterationInstruction = `The following changes are requested to the landing page you just built:

${userChangeRequest}

Apply these changes to the page. Keep everything else exactly the same -- same brand extraction, same copy, same section structure. Return the complete updated page code.`.trim()

  return [previousPrompt, iterationInstruction].join('\n\n---\n\n')
}

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

    // Get the original prompt from iteration history
    const history = Array.isArray(page.iteration_history) ? page.iteration_history : []
    const originalPrompt = history.length > 0 ? history[0].prompt_sent : null

    if (!originalPrompt) {
      return errorResponse('No original prompt found in iteration history. The page must be built with the new pipeline first.')
    }

    // Assemble the iteration prompt: original + change request
    const fullIterationPrompt = assembleIterationPrompt(originalPrompt, user_prompt)

    // Send to Stitch API for redesign
    const stitchResult = await generateWithStitch(fullIterationPrompt, {
      title: `Iteration ${history.length + 1}`,
      device: 'DESKTOP',
    })

    // Clean up HTML
    let cleanHtml = stitchResult.html.trim()
    if (cleanHtml.startsWith('```')) {
      cleanHtml = cleanHtml.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    // Build updated iteration history per the spec
    history.push({
      iteration: history.length,
      prompt_sent: fullIterationPrompt,
      change_request: user_prompt,
      preview_url: stitchResult.imageUrl,
      output_code: cleanHtml,
      timestamp: new Date().toISOString(),
    })

    // Update the landing page
    const { data: updated, error: updateError } = await supabase
      .from('landing_pages')
      .update({
        page_html: cleanHtml,
        stitch_output_code: cleanHtml,
        stitch_preview_url: stitchResult.imageUrl,
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
