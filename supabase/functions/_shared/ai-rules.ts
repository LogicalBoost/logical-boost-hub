// Builds the "AI RULES FOR THIS SEGMENT" prompt block that gets appended to
// every downstream generation prompt. This is what prevents AI hallucination,
// cross-contamination between business segments, and off-brand voice.
//
// Input: a segment row (with its voice/guardrails/competitive JSONB fields)
// and optional arrays of approved proof items and available avatars.
// Output: a markdown string to inject into system or user prompts.

// deno-lint-ignore-file no-explicit-any
type Segment = any
type ProofItem = any
type Avatar = any
type Offer = any

function listOrEmpty(v: unknown): string {
  if (!v) return '(none specified)'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'string') return v.trim() || '(none specified)'
  return String(v)
}

export function buildVoiceBlock(segment: Segment): string {
  const v = segment?.voice || {}
  const lines: string[] = ['## BRAND VOICE FOR THIS SEGMENT']
  if (v.tone_words) lines.push(`- Tone: ${v.tone_words}`)
  if (v.writing_style) lines.push(`- Writing style: ${v.writing_style}`)
  if (v.formality) lines.push(`- Formality: ${v.formality}`)
  if (v.humor) lines.push(`- Humor: ${v.humor}`)
  if (v.jargon_level) lines.push(`- Jargon level: ${v.jargon_level}`)
  if (v.emotional_tone) lines.push(`- Emotional tone the reader should feel: ${v.emotional_tone}`)
  if (v.phrases_we_use) lines.push(`- Phrases we use: ${v.phrases_we_use}`)
  if (v.phrases_we_never_use) lines.push(`- Phrases we NEVER use: ${v.phrases_we_never_use}`)
  if (v.sample_headline) lines.push(`- Reference headline (match this tone): "${v.sample_headline}"`)
  if (v.sample_paragraph) lines.push(`- Reference paragraph (match this tone):\n${v.sample_paragraph}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

export function buildGuardrailsBlock(segment: Segment): string {
  const g = segment?.guardrails || {}
  const lines: string[] = ['## GUARDRAILS FOR THIS SEGMENT']
  if (g.negative_keywords) lines.push(`- NEVER use these words: ${g.negative_keywords}`)
  if (g.prohibited_claims) lines.push(`- NEVER make these claims: ${g.prohibited_claims}`)
  if (g.legal_disclaimers) lines.push(`- Required legal disclaimers: ${g.legal_disclaimers}`)
  if (g.regulatory_notes) lines.push(`- Regulatory context: ${g.regulatory_notes}`)
  if (g.competitor_mentions) lines.push(`- Competitor mentions: ${g.competitor_mentions}`)
  if (g.pricing_in_ads) lines.push(`- Pricing in ads: ${g.pricing_in_ads}`)
  if (g.industry_restrictions) lines.push(`- Industry/platform restrictions: ${g.industry_restrictions}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

export function buildCompetitiveBlock(segment: Segment): string {
  const c = segment?.competitive || {}
  const lines: string[] = ['## COMPETITIVE POSITIONING']
  if (c.main_competitors) lines.push(`- Main competitors: ${c.main_competitors}`)
  if (c.why_choose_us) lines.push(`- Why choose us: ${c.why_choose_us}`)
  if (c.what_we_dont_do) lines.push(`- What we deliberately do NOT do: ${c.what_we_dont_do}`)
  if (c.market_position) lines.push(`- Market position: ${c.market_position}`)
  if (c.price_position) lines.push(`- Price position: ${c.price_position}`)
  if (c.competitive_advantages) lines.push(`- Structural advantages: ${c.competitive_advantages}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

export function buildProofBlock(proof: ProofItem[] | null | undefined): string {
  if (!proof || proof.length === 0) return ''
  const approved = proof.filter(p => p.approved)
  if (approved.length === 0) return '## PROOF\n(no approved proof items — do not cite any testimonials, case studies, or specific client results)'

  const caseStudies = approved.filter(p => p.kind === 'case_study')
  const testimonials = approved.filter(p => p.kind === 'testimonial')

  const lines = ['## APPROVED PROOF (safe to cite)']
  if (caseStudies.length) {
    lines.push('\nCase studies:')
    for (const c of caseStudies) {
      const parts = [c.client_name || 'Anonymous client', c.results || c.solution].filter(Boolean)
      lines.push(`- ${parts.join(' — ')}`)
    }
  }
  if (testimonials.length) {
    lines.push('\nTestimonials:')
    for (const t of testimonials) {
      const attr = [t.attribution_name, t.attribution_title, t.attribution_company].filter(Boolean).join(', ')
      lines.push(`- "${t.quote}" — ${attr || 'anonymous'}`)
    }
  }
  lines.push('\nDo NOT cite any proof not in the list above. Do NOT invent results, clients, or quotes.')
  return lines.join('\n')
}

export function buildAvatarPricingBlock(avatars: Avatar[] | null | undefined): string {
  if (!avatars || avatars.length === 0) return ''
  const lines = ['## AVATAR PRICING POSITIONING (match messaging per avatar)']
  for (const a of avatars) {
    const parts: string[] = []
    if (a.urgency) parts.push(`urgency=${a.urgency}`)
    if (a.price_sensitivity) parts.push(`price=${a.price_sensitivity}`)
    if (a.free_vs_paid) parts.push(`pricing=${a.free_vs_paid}`)
    if (parts.length) lines.push(`- ${a.name}: ${parts.join(', ')}`)
  }
  return lines.length > 1 ? lines.join('\n') : ''
}

export function buildOfferBlock(offers: Offer[] | null | undefined): string {
  if (!offers || offers.length === 0) return ''
  const approved = offers.filter(o => o.status !== 'denied')
  if (approved.length === 0) return ''
  const lines = ['## OFFERINGS IN THIS SEGMENT (use only these — never reference other segments)']
  for (const o of approved) {
    const flag = o.lead_magnet_type ? `[${o.lead_magnet_type}] ` : ''
    const claims = o.approved_claims ? ` Approved claims: ${o.approved_claims}` : ''
    lines.push(`- ${flag}${o.name}${o.price ? ` (${o.price})` : ''}.${claims}`)
  }
  return lines.join('\n')
}

/**
 * The 10 AI rules from the Marketing Profile spec. Constant — appended to
 * every downstream generation prompt.
 */
export const AI_RULES_STATIC = `## AI RULES FOR THIS SEGMENT
1. ONLY use offerings from THIS segment — never reference offerings from other segments of this client.
2. ONLY cite case studies and testimonials marked APPROVED above.
3. NEVER fabricate quotes, results, statistics, or client names.
4. NEVER use words from the Negative Keywords list.
5. NEVER make claims from the Prohibited Claims list.
6. ALWAYS match the brand voice defined for this segment.
7. ALWAYS target the defined Customer Avatars — never invent new personas.
8. MATCH pricing positioning per avatar:
   - "lead-with-free" avatars → use free consultation/assessment language
   - "premium-only" avatars → NEVER say free, cheap, discount, affordable
   - "value-stack" avatars → show everything included before mentioning price
9. MATCH urgency per avatar:
   - crisis/urgent → immediate action language, deadlines, consequences of waiting
   - active/planned → educational content, comparison, long-term benefits
10. When in doubt, undersell rather than overclaim.`

export interface AiRulesContext {
  segment: Segment
  avatars?: Avatar[] | null
  offers?: Offer[] | null
  proof?: ProofItem[] | null
}

/**
 * Build the full "AI Rules" context block. Returns a markdown string safe to
 * append to a system or user prompt.
 */
export function buildAiRulesContext(ctx: AiRulesContext): string {
  const blocks = [
    `## SEGMENT CONTEXT: ${ctx.segment.name}${ctx.segment.description ? `\n${ctx.segment.description}` : ''}`,
    buildOfferBlock(ctx.offers),
    buildAvatarPricingBlock(ctx.avatars),
    buildVoiceBlock(ctx.segment),
    buildGuardrailsBlock(ctx.segment),
    buildCompetitiveBlock(ctx.segment),
    buildProofBlock(ctx.proof),
    AI_RULES_STATIC,
  ].filter(Boolean)
  return blocks.join('\n\n')
}
