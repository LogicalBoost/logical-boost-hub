// Prompt 3: Refine System (Workflow 3)
// Trigger: Client completes intake or new call notes are added
// Returns: Targeted updates to existing avatars, offers, and flagged components

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior marketing strategist reviewing new information from a client intake. You already have an established set of avatars, offers, and business data. New information has come in.

Your job is to REFINE — not rebuild. Compare the new information against what already exists and produce targeted updates.

RULES:
- Do NOT regenerate avatars or offers from scratch. Only update specific fields that the new information improves.
- For each update, specify exactly which record and which field(s) to change.
- If the new information contradicts existing data, flag it and recommend the update.
- If the new information adds depth, merge it in.
- If existing copy_components might be affected, flag those components for review. Do NOT rewrite them.
- If the new information suggests a new avatar or offer, suggest it as a NEW addition.
- NEVER use em dashes (—) in any generated text. Use commas, periods, colons, or separate sentences instead.

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, new_call_notes, new_materials } = await req.json()
    if (!client_id) return errorResponse('client_id is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: client } = await supabase.from('clients').select('*').eq('id', client_id).single()
    const { data: avatars } = await supabase.from('avatars').select('*').eq('client_id', client_id).eq('status', 'approved')
    const { data: offers } = await supabase.from('offers').select('*').eq('client_id', client_id).eq('status', 'approved')
    const { data: intake } = await supabase.from('intake_questions').select('*').eq('client_id', client_id).order('sort_order')

    if (!client) return errorResponse('Client not found')

    const intakeContext = (intake || [])
      .filter((q: Record<string, unknown>) => q.answer)
      .map((q: Record<string, unknown>) => `Section: ${q.section}\nQ: ${q.question}\nA: ${q.answer}`)
      .join('\n\n')

    const avatarContext = (avatars || []).map((a: Record<string, unknown>) =>
      `ID: ${a.id}\nName: ${a.name}\nType: ${a.avatar_type}\nDescription: ${a.description}\nPain Points: ${a.pain_points}\nMotivations: ${a.motivations}\nObjections: ${a.objections}\nDesired Outcome: ${a.desired_outcome}\nTrigger Events: ${a.trigger_events}\nMessaging Style: ${a.messaging_style}`
    ).join('\n---\n')

    const offerContext = (offers || []).map((o: Record<string, unknown>) =>
      `ID: ${o.id}\nName: ${o.name}\nDescription: ${o.description}\nBenefits: ${JSON.stringify(o.benefits)}\nProof: ${JSON.stringify(o.proof_elements)}\nUrgency: ${JSON.stringify(o.urgency_elements)}`
    ).join('\n---\n')

    const userMessage = `NEW INFORMATION:

Intake Answers:
${intakeContext || 'None'}

New Call Notes:
${new_call_notes || 'None'}

New Materials:
${new_materials || 'None'}

---

EXISTING DATA:

Business Summary: ${client.business_summary}
Services: ${client.services}
Differentiators: ${client.differentiators}
Trust Signals: ${client.trust_signals}

EXISTING AVATARS:
${avatarContext || 'None'}

EXISTING OFFERS:
${offerContext || 'None'}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
    })

    const parsed = parseJsonResponse<{
      client_updates: Record<string, string | null>
      avatar_updates: Array<{ avatar_id: string; updates: Record<string, string> }>
      offer_updates: Array<{ offer_id: string; updates: Record<string, string> }>
      new_suggestions: { avatars: Array<Record<string, unknown>>; offers: Array<Record<string, unknown>> }
      flagged_components: Array<{ reason: string; affected_types: string[]; recommendation: string }>
    }>(response)

    // Apply client updates
    if (parsed.client_updates) {
      const updates: Record<string, string> = {}
      for (const [key, value] of Object.entries(parsed.client_updates)) {
        if (value) updates[key] = value
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('clients').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', client_id)
      }
    }

    // Mark intake as completed
    await supabase.from('clients').update({ intake_status: 'completed' }).eq('id', client_id)

    return jsonResponse(parsed)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
