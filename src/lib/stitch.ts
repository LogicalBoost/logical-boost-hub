/**
 * Stitch Integration Layer
 *
 * Handles communication with Google Stitch API for landing page generation.
 * The Stitch SDK (@google/stitch-sdk) is used in edge functions.
 * This client-side module defines types and helpers for the Stitch pipeline.
 */

// ============================================================
// Template Copy Slot Definitions
// ============================================================

export interface CopySlotDef {
  id: string
  label: string
  contentType: string
  notes: string
  isArray?: boolean
}

// Template 1: Conditional Funnel / Quiz-Led
export const TEMPLATE_1_SLOTS: CopySlotDef[] = [
  { id: 't1_headline', label: 'Hero Headline', contentType: 'headline', notes: '6–10 words' },
  { id: 't1_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '8–12 words' },
  { id: 't1_q1_prompt', label: 'Step 1 Question', contentType: 'description', notes: 'Quiz step 1 question' },
  { id: 't1_q1_options', label: 'Step 1 Options', contentType: 'cta', notes: '4–6 tiles, 2–4 words each', isArray: true },
  { id: 't1_q2_prompt', label: 'Step 2 Question', contentType: 'description', notes: 'Quiz step 2 question' },
  { id: 't1_q2_options', label: 'Step 2 Options', contentType: 'cta', notes: '4–6 tiles, 2–4 words each', isArray: true },
  { id: 't1_form_transition', label: 'Form Transition Text', contentType: 'description', notes: 'Line above form fields' },
  { id: 't1_cta', label: 'Submit Button', contentType: 'cta', notes: 'Form submit CTA' },
  { id: 't1_trust_line', label: 'Trust Line', contentType: 'description', notes: 'Below CTA button' },
  { id: 't1_proof_rating', label: 'Star Rating', contentType: 'proof', notes: 'Rating + count + platform' },
  { id: 't1_testimonials', label: 'Testimonials', contentType: 'proof', notes: '2–4 testimonials', isArray: true },
  { id: 't1_trust_badges', label: 'Trust Badges', contentType: 'proof', notes: 'Badge labels', isArray: true },
  { id: 't1_disclaimer', label: 'Disclaimer', contentType: 'description', notes: 'Footer legal copy' },
]

// Template 2: Problem/Solution + Category Segmentation
export const TEMPLATE_2_SLOTS: CopySlotDef[] = [
  { id: 't2_pre_headline', label: 'Pre-headline', contentType: 'description', notes: '3–6 words, all caps' },
  { id: 't2_headline', label: 'Hero Headline', contentType: 'headline', notes: '4–8 words' },
  { id: 't2_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '1–2 sentences' },
  { id: 't2_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: '3–5 words' },
  { id: 't2_trust_trio', label: 'Trust Trio', contentType: 'proof', notes: '3 trust signals', isArray: true },
  { id: 't2_category_headline', label: 'Category Headline', contentType: 'headline', notes: '5–9 words' },
  { id: 't2_categories', label: 'Category Cards', contentType: 'description', notes: '4–8 cards: emoji + label + description', isArray: true },
  { id: 't2_benefits_headline', label: 'Benefits Headline', contentType: 'headline', notes: '4–7 words' },
  { id: 't2_benefits', label: 'Benefits', contentType: 'benefit', notes: '3 cards: headline + explanation', isArray: true },
  { id: 't2_proof_rating', label: 'Proof Rating', contentType: 'proof', notes: 'Stars + count + platform' },
  { id: 't2_testimonials', label: 'Testimonials', contentType: 'proof', notes: '3–4 testimonials', isArray: true },
  { id: 't2_results_headline', label: 'Results Headline', contentType: 'headline', notes: '3–5 words' },
  { id: 't2_results', label: 'Results', contentType: 'proof', notes: '3–5: figure + label', isArray: true },
  { id: 't2_final_headline', label: 'Final CTA Headline', contentType: 'headline', notes: '5–10 words' },
  { id: 't2_final_cta', label: 'Final CTA', contentType: 'cta', notes: '3–5 words' },
  { id: 't2_phone_cta', label: 'Phone CTA', contentType: 'cta', notes: 'Phone number, optional' },
  { id: 't2_disclaimer', label: 'Disclaimer', contentType: 'description', notes: 'Footer legal' },
]

// Template 3: Feature-Dense Authority Page
export const TEMPLATE_3_SLOTS: CopySlotDef[] = [
  { id: 't3_headline', label: 'Hero Headline', contentType: 'headline', notes: '6–10 words' },
  { id: 't3_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '2–3 sentences' },
  { id: 't3_feature_bullets', label: 'Feature Bullets', contentType: 'benefit', notes: '3–4 hero bullets', isArray: true },
  { id: 't3_form_headline', label: 'Form Headline', contentType: 'headline', notes: 'Above form card' },
  { id: 't3_form_cta', label: 'Form CTA', contentType: 'cta', notes: 'Submit button text' },
  { id: 't3_secondary_cta', label: 'Secondary CTA', contentType: 'cta', notes: 'Secondary action' },
  { id: 't3_logo_bar_label', label: 'Logo Bar Label', contentType: 'proof', notes: '"Trusted by X" line' },
  { id: 't3_tab_headline', label: 'Tab Section Headline', contentType: 'headline', notes: 'Above tabs' },
  { id: 't3_tab_subheadline', label: 'Tab Section Subheadline', contentType: 'subheadline', notes: 'Below tab headline' },
  { id: 't3_tabs', label: 'Use Case Tabs', contentType: 'description', notes: 'Each: label + headline + bullets + CTA', isArray: true },
  { id: 't3_features_headline', label: 'Features Headline', contentType: 'headline', notes: 'Above features grid' },
  { id: 't3_features', label: 'Features', contentType: 'benefit', notes: '6–9: name + description', isArray: true },
  { id: 't3_proof_ratings', label: 'Proof Ratings', contentType: 'proof', notes: '2–3 platform ratings', isArray: true },
  { id: 't3_testimonials', label: 'Testimonials', contentType: 'proof', notes: '2–3 extended testimonials', isArray: true },
  { id: 't3_final_headline', label: 'Final Headline', contentType: 'headline', notes: 'Close headline' },
  { id: 't3_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Primary final CTA' },
  { id: 't3_final_secondary_cta', label: 'Final Secondary CTA', contentType: 'cta', notes: 'Secondary final CTA' },
]

// Template 4: Possibility Showcase / Output Gallery
export const TEMPLATE_4_SLOTS: CopySlotDef[] = [
  { id: 't4_headline', label: 'Hero Headline', contentType: 'headline', notes: '6–10 words, bold claim' },
  { id: 't4_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '1–2 sentences' },
  { id: 't4_primary_cta', label: 'Primary CTA', contentType: 'cta', notes: 'Main hero CTA' },
  { id: 't4_secondary_cta', label: 'Secondary CTA', contentType: 'cta', notes: 'Secondary hero CTA' },
  { id: 't4_stats', label: 'Stats', contentType: 'proof', notes: '3 scale numbers + labels', isArray: true },
  { id: 't4_logo_bar_label', label: 'Logo Bar Label', contentType: 'proof', notes: '"Featured in" label' },
  { id: 't4_use_case_tabs', label: 'Use Case Tabs', contentType: 'description', notes: 'Tab labels', isArray: true },
  { id: 't4_showcase_blocks', label: 'Showcase Blocks', contentType: 'description', notes: 'Each: badge + headline + description + CTA', isArray: true },
  { id: 't4_capability_headline', label: 'Capability Headline', contentType: 'headline', notes: '3–5 words' },
  { id: 't4_capability_cards', label: 'Capability Cards', contentType: 'benefit', notes: '3–4: headline + description', isArray: true },
  { id: 't4_final_headline', label: 'Final Headline', contentType: 'headline', notes: '5–9 words' },
  { id: 't4_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Primary final CTA' },
  { id: 't4_final_secondary_cta', label: 'Final Secondary CTA', contentType: 'cta', notes: 'Secondary final CTA' },
]

// Template 5: Video + Social Proof Wall
export const TEMPLATE_5_SLOTS: CopySlotDef[] = [
  { id: 't5_headline', label: 'Hero Headline', contentType: 'headline', notes: '4–8 words' },
  { id: 't5_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '1–2 sentences' },
  { id: 't5_video_url', label: 'Video URL', contentType: 'video', notes: 'URL or [PLACEHOLDER]' },
  { id: 't5_primary_cta', label: 'Primary CTA', contentType: 'cta', notes: 'Below video' },
  { id: 't5_who_headline', label: 'Who Its For Headline', contentType: 'headline', notes: '4–7 words' },
  { id: 't5_who_bullets', label: 'Who Its For Bullets', contentType: 'benefit', notes: '4–6 identity statements', isArray: true },
  { id: 't5_testimonials_headline', label: 'Testimonials Headline', contentType: 'headline', notes: '5–9 words' },
  { id: 't5_testimonials', label: 'Testimonials', contentType: 'proof', notes: '8–16 minimum', isArray: true },
  { id: 't5_video_testimonials', label: 'Video Testimonials', contentType: 'proof', notes: 'Optional: thumbnail + name + result', isArray: true },
  { id: 't5_final_headline', label: 'Final Headline', contentType: 'headline', notes: '5–10 words' },
  { id: 't5_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Final button' },
]

// Template 6: VSL / Long-Form Direct Response
export const TEMPLATE_6_SLOTS: CopySlotDef[] = [
  { id: 't6_pre_headline', label: 'Pre-headline', contentType: 'description', notes: 'Audience callout, 5–10 words' },
  { id: 't6_headline', label: 'Hero Headline', contentType: 'headline', notes: 'Bold promise, 8–16 words' },
  { id: 't6_video_url', label: 'Video URL', contentType: 'video', notes: 'URL or [PLACEHOLDER]' },
  { id: 't6_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: 'Below video' },
  { id: 't6_problem_copy', label: 'Problem Copy', contentType: 'description', notes: '150–250 words, full paragraphs' },
  { id: 't6_solution_copy', label: 'Solution Copy', contentType: 'description', notes: '150–200 words, full paragraphs' },
  { id: 't6_offer_items', label: 'Offer Stack Items', contentType: 'benefit', notes: '5–8: name + description', isArray: true },
  { id: 't6_proof_items', label: 'Proof Items', contentType: 'proof', notes: '2–4: name + result + story', isArray: true },
  { id: 't6_faq', label: 'FAQ', contentType: 'description', notes: '5–8 Q&A pairs', isArray: true },
  { id: 't6_guarantee', label: 'Guarantee', contentType: 'description', notes: '100–150 words' },
  { id: 't6_urgency', label: 'Urgency', contentType: 'urgency', notes: '1–2 sentences' },
  { id: 't6_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Final button' },
]

// Template 7: Comparison / Challenger
export const TEMPLATE_7_SLOTS: CopySlotDef[] = [
  { id: 't7_headline', label: 'Hero Headline', contentType: 'headline', notes: 'Challenger framing, 6–12 words' },
  { id: 't7_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: 'Problem with status quo' },
  { id: 't7_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: '3–5 words' },
  { id: 't7_comparison_label_old', label: 'Old Way Label', contentType: 'description', notes: '"The Old Way" header' },
  { id: 't7_comparison_label_new', label: 'New Way Label', contentType: 'description', notes: '"The [Brand] Way" header' },
  { id: 't7_comparison_rows', label: 'Comparison Rows', contentType: 'description', notes: '5–8 rows: dimension + old + new', isArray: true },
  { id: 't7_benefits_headline', label: 'Benefits Headline', contentType: 'headline', notes: '4–7 words' },
  { id: 't7_benefits', label: 'Benefits', contentType: 'benefit', notes: '3–4 cards', isArray: true },
  { id: 't7_testimonials_headline', label: 'Testimonials Headline', contentType: 'headline', notes: '4–8 words' },
  { id: 't7_testimonials', label: 'Testimonials', contentType: 'proof', notes: '3–5 switcher testimonials', isArray: true },
  { id: 't7_final_headline', label: 'Final Headline', contentType: 'headline', notes: '5–9 words' },
  { id: 't7_final_cta', label: 'Final CTA', contentType: 'cta', notes: '3–5 words' },
]

// Template 8: Urgency / Event-Driven
export const TEMPLATE_8_SLOTS: CopySlotDef[] = [
  { id: 't8_pre_headline', label: 'Alert Label', contentType: 'description', notes: '2–5 words, emoji OK' },
  { id: 't8_headline', label: 'Hero Headline', contentType: 'headline', notes: 'Event-triggered, 8–14 words' },
  { id: 't8_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: 'Why waiting is dangerous' },
  { id: 't8_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: '3–5 words' },
  { id: 't8_urgency_element', label: 'Urgency Element', contentType: 'urgency', notes: 'Deadline/capacity signal' },
  { id: 't8_risk_headline', label: 'Risk Headline', contentType: 'headline', notes: '"What Happens If You Wait"' },
  { id: 't8_risks', label: 'Risk Items', contentType: 'fear_point', notes: '3–4: bold statement + explanation', isArray: true },
  { id: 't8_steps', label: 'Process Steps', contentType: 'description', notes: '3 steps: name + description', isArray: true },
  { id: 't8_proof_items', label: 'Proof Items', contentType: 'proof', notes: 'Trust badges + testimonials', isArray: true },
  { id: 't8_final_urgency', label: 'Final Urgency', contentType: 'urgency', notes: '1–2 sentences' },
  { id: 't8_final_cta', label: 'Final CTA', contentType: 'cta', notes: '3–5 words' },
  { id: 't8_phone_cta', label: 'Phone CTA', contentType: 'cta', notes: 'Phone number, optional' },
  { id: 't8_disclaimer', label: 'Disclaimer', contentType: 'description', notes: 'Footer legal' },
]

// Map template IDs to their slot definitions
export const TEMPLATE_SLOTS: Record<string, CopySlotDef[]> = {
  template_1: TEMPLATE_1_SLOTS,
  template_2: TEMPLATE_2_SLOTS,
  template_3: TEMPLATE_3_SLOTS,
  template_4: TEMPLATE_4_SLOTS,
  template_5: TEMPLATE_5_SLOTS,
  template_6: TEMPLATE_6_SLOTS,
  template_7: TEMPLATE_7_SLOTS,
  template_8: TEMPLATE_8_SLOTS,
}

// ============================================================
// Copy Slot Serialization Helpers
// ============================================================

/**
 * Serialize a copy slot value to a plain string for Stitch prompt assembly.
 * CRITICAL: Stitch prompts must never contain [object Object].
 */
export function serializeSlotValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    if (typeof value[0] === 'string') return value.join(' | ')
    // Array of objects — format as labeled list
    return value.map((item, i) => {
      if (typeof item === 'object' && item !== null) {
        return Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', ')
      }
      return String(item)
    }).join('\n')
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join('\n')
  }
  return String(value ?? '')
}

/**
 * Serialize all copy slots to plain strings.
 */
export function serializeCopySlots(slots: Record<string, unknown>): Record<string, string> {
  const serialized: Record<string, string> = {}
  for (const [key, value] of Object.entries(slots)) {
    serialized[key] = serializeSlotValue(value)
  }
  return serialized
}

/**
 * Map copy components to template slots based on component type.
 * Returns:
 * - filled: auto-filled slots (only for slots with a direct type match)
 * - missing: slot IDs with no matching copy
 * - options: all available copy options per slot (for the picker UI)
 *
 * Only auto-fills the FIRST slot of each type. Additional slots of the
 * same type are left empty so the user picks from the options list.
 */
export function mapComponentsToSlots(
  templateId: string,
  components: Array<{ id?: string; type: string; text: string }>
): {
  filled: Record<string, string>
  missing: string[]
  options: Record<string, Array<{ id?: string; text: string }>>
} {
  const slots = TEMPLATE_SLOTS[templateId]
  if (!slots) return { filled: {}, missing: [], options: {} }

  const filled: Record<string, string> = {}
  const missing: string[] = []
  const options: Record<string, Array<{ id?: string; text: string }>> = {}

  // Group components by type — keep full objects for the picker
  const byType: Record<string, Array<{ id?: string; text: string }>> = {}
  for (const comp of components) {
    if (!byType[comp.type]) byType[comp.type] = []
    byType[comp.type].push({ id: comp.id, text: comp.text })
  }

  // Track which types have been auto-filled (first slot gets auto-fill, rest get options only)
  const autoFilledTypes: Record<string, number> = {}

  for (const slot of slots) {
    const available = byType[slot.contentType] || []

    // Always populate options for this slot's content type
    options[slot.id] = available

    if (available.length > 0) {
      if (slot.isArray) {
        // Array slots get all items joined
        filled[slot.id] = available.map(a => a.text).join(' | ')
      } else {
        // Single slots: auto-fill only the first slot of each type
        const typeCount = autoFilledTypes[slot.contentType] || 0
        if (typeCount < available.length) {
          filled[slot.id] = available[typeCount].text
          autoFilledTypes[slot.contentType] = typeCount + 1
        } else {
          // No more copy of this type — mark as missing
          missing.push(slot.id)
        }
      }
    } else {
      missing.push(slot.id)
    }
  }

  return { filled, missing, options }
}
