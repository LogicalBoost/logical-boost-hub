import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse, getCustomPrompt } from '../_shared/ai-client.ts'

/**
 * Generate Landing Page Copy
 *
 * Takes an avatar, offer, business context, and existing copy components,
 * then uses Claude to produce a complete PageData.sections[] array ready
 * for the LeadCaptureClassic (or other) template.
 *
 * HARD RULES:
 * - NEVER fabricate testimonials, reviews, or customer quotes
 * - NEVER invent statistics, ratings, or claims about the business
 * - ALL copy must be grounded in the avatar + offer + business overview
 * - Testimonials/reviews ONLY from business_overview data if available
 * - If no testimonials exist, omit the testimonials section entirely
 */

const SYSTEM_PROMPT = `You are an expert direct-response landing page copywriter. You produce complete, high-converting landing page copy structured as a JSON sections array.

## YOUR JOB
Given an avatar (target customer), offer, business context, and any existing copy components, produce a complete sections array for a landing page template.

## ABSOLUTE RULES — VIOLATIONS ARE UNACCEPTABLE

1. **NEVER FABRICATE TESTIMONIALS.** If no real testimonials/reviews are provided in the business data, DO NOT include a testimonials section. Do not invent names, quotes, roles, or ratings. This is an FTC violation.

2. **NEVER INVENT STATISTICS.** Do not make up numbers like "2,000+ customers" or "98% satisfaction rate" unless these exact figures appear in the business data. If no stats exist, use qualitative language instead.

3. **NEVER MAKE CLAIMS THE BUSINESS HASN'T MADE.** All copy must be derivable from the avatar description, offer details, and business overview. You can reframe and sharpen — you cannot fabricate.

4. **SPECIFICITY OVER GENERICS.** Every line must feel like it was written for THIS specific avatar and THIS specific offer. Generic marketing copy like "Trusted by thousands" or "Industry-leading solutions" is banned unless backed by data.

5. **AVATAR-FIRST WRITING.** The landing page speaks directly to the avatar's pain points, desires, language, and worldview. Use their vocabulary. Reference their specific situation.

6. **OFFER-ANCHORED CTAs.** Every CTA must reference the specific offer, not generic "Get Started" or "Learn More" — unless the offer is genuinely that broad.

## SECTION TYPES TO PRODUCE

For the "lead-capture-classic" template, produce these sections in order:

1. **hero** — Headline (6-10 words), subheadline, content paragraph, CTA button text, sub_cta (trust line)
2. **feature_cards** — 3-4 cards with icon, value (short label), and label (description). Icons from: shield, clock, award, check, zap, dollar, heart, star, users, phone, home, tool, target, trending, lock
3. **two_column_info** — Headline, items array with title+text pairs. First half = "What We Offer/Inspect/Do", second half = "What You Get/Receive". Include CTA.
4. **steps** — 3-4 numbered process steps. Each: icon, title, text. Show how easy it is.
5. **trust_bar** — 3 stat items. ONLY use real stats from business data. If none exist, use qualitative items like { stat: "Licensed", label: "& Fully Insured" } instead of fake numbers.
6. **benefits_grid** — 6 benefit cards. Each: icon, title (3-5 words), text (1 sentence). Specific to this offer.
7. **testimonials** — ONLY if real testimonials/reviews are provided. Each: name, role, quote, rating. SKIP THIS SECTION ENTIRELY if no real testimonials exist.
8. **faq** — 5-7 Q&A pairs. Questions the avatar would actually ask. Answers that overcome objections.
9. **footer** — Phone (if available), standard links, social links if provided.

## ACCENT WORDS
Each section with a headline should include an "accent_word" — one power word from the headline that gets highlighted in the brand's accent color. Choose emotionally impactful words.

## JSON OUTPUT FORMAT

Return ONLY a JSON object with this structure:
{
  "sections": [
    {
      "type": "hero",
      "headline": "...",
      "accent_word": "...",
      "subheadline": "...",
      "content": "...",
      "cta": "...",
      "cta_url": "#lead-form",
      "sub_cta": "..."
    },
    {
      "type": "feature_cards",
      "items": [
        { "icon": "shield", "value": "100% Free", "label": "No-obligation quote" }
      ]
    },
    ...
  ]
}

IMPORTANT: Return valid JSON only. No markdown, no explanation, no preamble.`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const {
      client_id,
      avatar_id,
      offer_id,
      template_slug,
    } = await req.json()

    if (!client_id || !avatar_id || !offer_id) {
      return errorResponse('Missing required fields: client_id, avatar_id, offer_id')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ─── Gather all context ───

    // 1. Client + business overview
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    if (!clientData) {
      return errorResponse('Client not found', 404)
    }

    // 2. Avatar
    const { data: avatar } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single()

    if (!avatar) {
      return errorResponse('Avatar not found', 404)
    }

    // 3. Offer
    const { data: offer } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offer_id)
      .single()

    if (!offer) {
      return errorResponse('Offer not found', 404)
    }

    // 4. Existing copy components for this avatar+offer
    const { data: copyComponents } = await supabase
      .from('copy_components')
      .select('type, text, angle')
      .eq('client_id', client_id)
      .eq('status', 'approved')
      .or(`avatar_ids.cs.{${avatar_id}},avatar_ids.is.null`)

    // 5. Intake answers (if any)
    const { data: intakeQuestions } = await supabase
      .from('intake_questions')
      .select('question, answer')
      .eq('client_id', client_id)
      .not('answer', 'is', null)

    // 6. Real testimonials/reviews from client_content table
    const { data: clientContent } = await supabase
      .from('client_content')
      .select('content_type, person_name, person_role, body, rating, source, stat_value, stat_label, title')
      .eq('client_id', client_id)
      .in('content_type', ['testimonial', 'review', 'stat', 'faq'])
      .order('is_featured', { ascending: false })
      .order('sort_order')
      .limit(30)

    const realTestimonials = (clientContent || []).filter(c => c.content_type === 'testimonial' || c.content_type === 'review')
    const realStats = (clientContent || []).filter(c => c.content_type === 'stat')
    const realFaqs = (clientContent || []).filter(c => c.content_type === 'faq')

    // Build testimonials context for the AI
    let testimonialsContext = ''
    if (realTestimonials.length > 0) {
      testimonialsContext = `REAL REVIEWS/TESTIMONIALS (use these VERBATIM — do NOT modify quotes):\n${realTestimonials.map((t, i) =>
        `${i + 1}. "${t.body}" — ${t.person_name || 'Customer'}${t.person_role ? `, ${t.person_role}` : ''}${t.rating ? ` (${t.rating}/5 stars)` : ''}${t.source ? ` [Source: ${t.source}]` : ''}`
      ).join('\n')}`
    } else {
      testimonialsContext = 'NO REAL TESTIMONIALS AVAILABLE — do NOT fabricate any. OMIT the testimonials section entirely.'
    }

    let statsContext = ''
    if (realStats.length > 0) {
      statsContext = `REAL STATS/METRICS (use in trust_bar section):\n${realStats.map(s =>
        `- ${s.stat_value}: ${s.stat_label}`
      ).join('\n')}`
    }

    let faqContext = ''
    if (realFaqs.length > 0) {
      faqContext = `REAL FAQs (incorporate into FAQ section):\n${realFaqs.map(f =>
        `Q: ${f.title}\nA: ${f.body}`
      ).join('\n\n')}`
    }

    // ─── Build context for Claude ───

    const businessContext = [
      `BUSINESS: ${clientData.name}`,
      clientData.website_url ? `WEBSITE: ${clientData.website_url}` : '',
      clientData.business_summary ? `SUMMARY: ${clientData.business_summary}` : '',
      clientData.services ? `SERVICES: ${JSON.stringify(clientData.services)}` : '',
      clientData.differentiators ? `DIFFERENTIATORS: ${JSON.stringify(clientData.differentiators)}` : '',
      clientData.trust_signals ? `TRUST SIGNALS: ${JSON.stringify(clientData.trust_signals)}` : '',
      clientData.tone ? `BRAND TONE: ${clientData.tone}` : '',
      clientData.ad_copy_rules ? `COPY RULES: ${clientData.ad_copy_rules}` : '',
      testimonialsContext,
      statsContext,
      faqContext,
      clientData.call_notes ? `CALL NOTES: ${clientData.call_notes}` : '',
    ].filter(Boolean).join('\n\n')

    const avatarContext = [
      `AVATAR NAME: ${avatar.name}`,
      `TYPE: ${avatar.avatar_type || 'Unknown'}`,
      avatar.description ? `DESCRIPTION: ${avatar.description}` : '',
      avatar.pain_points ? `PAIN POINTS: ${JSON.stringify(avatar.pain_points)}` : '',
      avatar.desired_outcome ? `DESIRED OUTCOME: ${avatar.desired_outcome}` : '',
      avatar.trigger_events ? `TRIGGER EVENTS: ${JSON.stringify(avatar.trigger_events)}` : '',
      avatar.messaging_style ? `MESSAGING STYLE: ${avatar.messaging_style}` : '',
      avatar.recommended_angles ? `RECOMMENDED ANGLES: ${JSON.stringify(avatar.recommended_angles)}` : '',
    ].filter(Boolean).join('\n')

    const offerContext = [
      `OFFER NAME: ${offer.name}`,
      offer.description ? `DESCRIPTION: ${offer.description}` : '',
      offer.price_point ? `PRICE: ${offer.price_point}` : '',
      offer.guarantee ? `GUARANTEE: ${offer.guarantee}` : '',
      offer.urgency ? `URGENCY: ${offer.urgency}` : '',
      offer.target_avatar_ids ? `TARGET AVATARS: ${JSON.stringify(offer.target_avatar_ids)}` : '',
    ].filter(Boolean).join('\n')

    // Group existing copy by type for reference
    const existingCopy: Record<string, string[]> = {}
    if (copyComponents) {
      for (const comp of copyComponents) {
        if (!existingCopy[comp.type]) existingCopy[comp.type] = []
        existingCopy[comp.type].push(comp.text)
      }
    }

    const existingCopyContext = Object.keys(existingCopy).length > 0
      ? `EXISTING APPROVED COPY COMPONENTS (use these as inspiration, incorporate the best ones):\n${Object.entries(existingCopy).map(([type, texts]) =>
          `  ${type}:\n${texts.slice(0, 5).map(t => `    - "${t}"`).join('\n')}`
        ).join('\n')}`
      : 'No existing copy components available. Generate everything fresh from the avatar and offer.'

    const intakeContext = intakeQuestions && intakeQuestions.length > 0
      ? `INTAKE Q&A (additional business context):\n${intakeQuestions.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}`
      : ''

    const userMessage = `Generate a complete landing page sections array for the "${template_slug || 'lead-capture-classic'}" template.

## BUSINESS CONTEXT
${businessContext}

## TARGET AVATAR
${avatarContext}

## OFFER
${offerContext}

${existingCopyContext}

${intakeContext}

Remember:
- Write SPECIFICALLY for the "${avatar.name}" avatar — use their language, reference their situation
- Anchor every CTA to the specific offer: "${offer.name}"
- If no real testimonials/reviews are in the business data above, OMIT the testimonials section entirely
- Trust bar stats must be REAL from the data above, or use qualitative descriptors instead
- Return ONLY valid JSON`

    // ─── Check for custom prompt ───
    const customPrompt = await getCustomPrompt(supabase, client_id, 'landing_page_copy')
    const systemPrompt = customPrompt || SYSTEM_PROMPT

    // ─── Call Claude ───
    const response = await callClaude(systemPrompt, userMessage, {
      maxTokens: 8192,
    })

    const result = parseJsonResponse<{ sections: unknown[] }>(response)

    if (!result.sections || !Array.isArray(result.sections)) {
      throw new Error('AI response did not contain a valid sections array')
    }

    return jsonResponse({
      success: true,
      sections: result.sections,
      avatar_name: avatar.name,
      offer_name: offer.name,
      template_slug: template_slug || 'lead-capture-classic',
    })

  } catch (err) {
    console.error('Generate landing page copy error:', err)
    return errorResponse(err.message || 'Failed to generate landing page copy', 500)
  }
})
