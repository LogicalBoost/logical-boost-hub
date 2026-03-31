// Workflow: Generate Avatars via AI Prompter
// Trigger: User clicks "Add Avatar" on Avatars page, enters prompt with direction
// Generates N avatars based on business context + user guidance

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse, getCustomPrompt } from '../_shared/ai-client.ts'

const ANGLE_DEFINITIONS = `Available angles (use slug values):
- problem: Pain Point. Focus on a pain the audience is currently experiencing.
- outcome: Desired Result. Focus on the transformation or end result.
- fear: Fear & Risk. Focus on what the audience risks losing or doing wrong.
- opportunity: New Opportunity. Highlight a new advantage, trend, or method.
- curiosity: Curiosity Hook. Create intrigue or a pattern interrupt.
- proof: Social Proof. Show measurable results or case studies.
- authority: Authority & Trust. Establish expertise, scale, or credibility.
- mechanism: How It Works. Explain how the solution works.
- speed: Fast Results. Emphasize quick results or rapid setup.
- cost: Cost Savings. Focus on saving money or improving efficiency.
- comparison: Us vs. Them. Contrast against current alternatives.
- identity: Audience Callout. Call out a specific audience segment directly.
- mistake: Common Mistakes. Highlight errors the audience is making.
- hidden_truth: Hidden Truth. Reveal something counterintuitive or unknown.
- before_after: Before & After. Show contrast between current state and improved state.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, quantity, user_prompt } = await req.json()

    if (!client_id) {
      return errorResponse('client_id is required')
    }

    const generateCount = quantity || 5

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client data for context
    const { data: client } = await supabase.from('clients').select('*').eq('id', client_id).single()
    if (!client) return errorResponse('Client not found')

    // Fetch existing avatars so AI doesn't duplicate
    const { data: existingAvatars } = await supabase
      .from('avatars')
      .select('*')
      .eq('client_id', client_id)

    const existingList = (existingAvatars || [])
      .map((a: Record<string, string>) => `- "${a.name}" (${a.avatar_type}): ${a.pain_points?.substring(0, 80) || 'no pain points listed'}`)
      .join('\n')

    // Fetch existing offers for context (avatars should be relevant to what we're selling)
    const { data: offers } = await supabase
      .from('offers')
      .select('name, offer_type, description, primary_cta, conversion_type')
      .eq('client_id', client_id)
      .eq('status', 'approved')

    const offerContext = (offers || [])
      .map((o: Record<string, string>) => `- "${o.name}" (${o.offer_type}): ${o.description?.substring(0, 100) || o.primary_cta || ''}`)
      .join('\n')

    const userDirection = user_prompt
      ? `\n\nUSER DIRECTION (follow this guidance closely):\n${user_prompt}`
      : ''

    // Try custom prompt first, fall back to hardcoded default
    const customPrompt = await getCustomPrompt(supabase, client_id, 'generate_avatars')

    const defaultSystemPrompt = `You are a senior audience strategist at a performance marketing agency. Your specialty is building deeply researched, psychographically rich customer avatars that drive high-converting ad campaigns.

You are generating ${generateCount} NEW audience avatars for a client. These avatars represent distinct people in different life situations, at different awareness stages, with different triggers that make them ready to buy NOW.

WHAT MAKES A GREAT AVATAR:
- SPECIFIC, not generic. "First-time homeowner who just discovered mold in the basement" is great. "Homeowner" is useless.
- Pain points should be visceral, emotional, real. What keeps them up at night? What frustration pushed them to finally search?
- Motivations should go beyond the obvious. Not just "wants clean air" but "terrified their kids are breathing toxic air and feels like a bad parent for not catching it sooner."
- Objections should be the REAL reasons people don't buy, not surface-level excuses. Price is rarely the real objection.
- Trigger events are the moments that make someone go from "I should deal with this" to "I need to deal with this TODAY." Be specific: pipe burst, failed inspection, neighbor's horror story, spouse complained.
- Messaging style should describe HOW to talk to this person. Are they analytical and want data? Emotional and want reassurance? Busy and want speed? Skeptical and need proof?
- Recommended angles should be 3-5 angles from the framework below that would resonate most with THIS specific person.

AVATAR DIVERSITY:
- Each avatar should represent a genuinely DIFFERENT person in a different situation.
- Vary by: life stage, income level, urgency level, awareness level, decision-making style, emotional state.
- Include a mix: some high-urgency (emergency), some research-phase (comparing options), some price-sensitive, some quality-first, some referral-driven.
- Think about WHO is actually searching for this service and WHY. What happened in their life to trigger the search?

${ANGLE_DEFINITIONS}

FORMATTING RULES:
- NEVER use em dashes (—) in any generated text. Use commas, periods, colons, or separate sentences instead.
- pain_points, motivations, objections, desired_outcome, trigger_events should each be 2-4 sentences of rich, specific detail.
- messaging_style should be 1-2 sentences describing how to communicate with this person.
- preferred_platforms should be an array of 2-4 platforms where this person spends time (Facebook, Google, Instagram, YouTube, TikTok, LinkedIn, Nextdoor, Yelp, etc.)
- recommended_angles should be an array of 3-5 angle slugs from the framework above.

RESPONSE FORMAT:
Respond ONLY with valid JSON: { "avatars": [{ "name": "...", "avatar_type": "...", "description": "...", "pain_points": "...", "motivations": "...", "objections": "...", "desired_outcome": "...", "trigger_events": "...", "messaging_style": "...", "preferred_platforms": ["..."], "recommended_angles": ["..."] }] }

No markdown, no explanation outside the JSON.`

    const systemPrompt = customPrompt || defaultSystemPrompt

    const userMessage = `BUSINESS CONTEXT:
Company: ${client.name}
Website: ${client.website}
Summary: ${client.business_summary || 'Not yet analyzed'}
Services: ${client.services || 'Not specified'}
Differentiators: ${client.differentiators || 'Not specified'}
Trust Signals: ${client.trust_signals || 'Not specified'}
Tone: ${client.tone || 'Not specified'}

EXISTING OFFERS (avatars should be relevant to these):
${offerContext || 'No offers yet'}

EXISTING AVATARS (DO NOT DUPLICATE these, generate DIFFERENT people):
${existingList || 'None yet. This is the first batch.'}

Generate exactly ${generateCount} new, unique avatars.${userDirection}`

    const response = await callClaude(systemPrompt, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
    })

    const parsed = parseJsonResponse<Record<string, unknown>>(response)
    const avatarsData = (parsed.avatars || parsed.initial_avatars || []) as Array<Record<string, unknown>>

    // Insert avatars
    let avatarsCreated = 0
    if (avatarsData.length > 0) {
      const records = avatarsData.map(a => ({
        client_id,
        name: String(a.name || 'Unnamed Avatar'),
        avatar_type: a.avatar_type ? String(a.avatar_type) : null,
        description: a.description ? String(a.description) : null,
        pain_points: a.pain_points ? String(a.pain_points) : null,
        motivations: a.motivations ? String(a.motivations) : null,
        objections: a.objections ? String(a.objections) : null,
        desired_outcome: a.desired_outcome ? String(a.desired_outcome) : null,
        trigger_events: a.trigger_events ? String(a.trigger_events) : null,
        messaging_style: a.messaging_style ? String(a.messaging_style) : null,
        preferred_platforms: Array.isArray(a.preferred_platforms) ? a.preferred_platforms : null,
        recommended_angles: Array.isArray(a.recommended_angles) ? a.recommended_angles : null,
        status: 'approved',
      })).filter(r => r.name !== 'Unnamed Avatar')

      const { error: insertError } = await supabase.from('avatars').insert(records)
      if (insertError) {
        console.error('Avatar insert error:', JSON.stringify(insertError))
        return errorResponse(`Failed to insert avatars: ${insertError.message}`)
      }
      avatarsCreated = records.length
    }

    return jsonResponse({
      success: true,
      avatars_created: avatarsCreated,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
