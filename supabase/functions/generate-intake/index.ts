// Prompt 2: Generate Intake Questions (Workflow 2)
// Trigger: After business analysis, before client intake call
// Returns: 8-12 targeted questions grouped by section

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior marketing strategist preparing for a client intake call. You have already analyzed this client's business and have initial data. Now you need to identify what's MISSING — the gaps that, if filled, would dramatically improve the quality of ad copy, targeting, and offers.

Your job is to generate 8–12 highly targeted questions grouped by section.

RULES:
- NEVER ask generic questions. If something is already known, do NOT ask about it again.
- NEVER ask "What does your business do?" if this is already clear.
- Every question must directly improve one of: audience targeting, offer messaging, objection handling, urgency/proof elements, or competitive positioning.
- Keep questions simple. No marketing jargon.
- The entire questionnaire should be completable in under 3 minutes.
- Group questions into sections: "Your Best Customers", "What Makes People Buy", "Hesitations & Objections", "Timing & Urgency", "Competition", "Trust & Proof".
- Maximum 12 questions. Minimum 8.
- Each question should have a "section" label and a "sort_order" number.

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`

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

    const { data: client } = await supabase.from('clients').select('*').eq('id', client_id).single()
    const { data: avatars } = await supabase.from('avatars').select('*').eq('client_id', client_id).eq('status', 'approved')
    const { data: offers } = await supabase.from('offers').select('*').eq('client_id', client_id).eq('status', 'approved')

    if (!client) {
      return errorResponse('Client not found')
    }

    const avatarContext = (avatars || []).map((a: Record<string, unknown>) =>
      `- ${a.name} (${a.avatar_type}): ${a.description}\n  Pain Points: ${a.pain_points}\n  Objections: ${a.objections}\n  Trigger Events: ${a.trigger_events}`
    ).join('\n')

    const offerContext = (offers || []).map((o: Record<string, unknown>) =>
      `- ${o.name} (${o.offer_type}): ${o.description}\n  CTA: ${o.primary_cta}\n  Benefits: ${JSON.stringify(o.benefits)}`
    ).join('\n')

    const userMessage = `EXISTING BUSINESS DATA:

Company: ${client.name}
Business Summary: ${client.business_summary}
Services: ${client.services}
Differentiators: ${client.differentiators}
Trust Signals: ${client.trust_signals}
Tone: ${client.tone}

EXISTING AVATARS:
${avatarContext || 'None yet'}

EXISTING OFFERS:
${offerContext || 'None yet'}

COMPETITOR INFO:
${client.competitors ? JSON.stringify(client.competitors) : 'None yet'}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage)
    const parsed = parseJsonResponse<{ intake_questions: Array<{ section: string; question: string; sort_order: number }> }>(response)

    // Insert questions into database
    if (parsed.intake_questions?.length) {
      const records = parsed.intake_questions.map(q => ({
        client_id,
        section: q.section,
        question: q.question,
        sort_order: q.sort_order,
      }))
      await supabase.from('intake_questions').insert(records)
      await supabase.from('clients').update({ intake_status: 'pending' }).eq('id', client_id)
    }

    return jsonResponse({
      success: true,
      questions_created: parsed.intake_questions?.length || 0,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
