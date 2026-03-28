/**
 * Template Copy Slot Definitions
 *
 * Defines the copy slot structure for each of the 8 landing page templates.
 * Includes slot mapping helpers for auto-filling from copy components.
 */

// ============================================================
// Template Copy Slot Definitions
// ============================================================

/**
 * Slot sources:
 * - 'copy'     -> Auto-filled from copy_components. AI-generatable content.
 * - 'business' -> Business assets (testimonials, ratings, badges, disclaimers).
 *                Entered manually or pulled from Business Overview. AI cannot generate these.
 * - 'media'    -> Media files (video URLs, images). User provides manually.
 */
export type SlotSource = 'copy' | 'business' | 'media'

export interface CopySlotDef {
  id: string
  label: string
  contentType: string
  notes: string
  isArray?: boolean
  optional?: boolean
  source: SlotSource
}

// Template 1: Conditional Funnel / Quiz-Led
export const TEMPLATE_1_SLOTS: CopySlotDef[] = [
  { id: 't1_headline', label: 'Hero Headline', contentType: 'headline', notes: '6-10 words', source: 'copy' },
  { id: 't1_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '8-12 words', source: 'copy' },
  { id: 't1_q1_prompt', label: 'Step 1 Question', contentType: 'quiz_question', notes: 'Quiz step 1 question', optional: true, source: 'copy' },
  { id: 't1_q1_options', label: 'Step 1 Options', contentType: 'quiz_option', notes: '4-6 tiles, 2-4 words each', optional: true, isArray: true, source: 'copy' },
  { id: 't1_q2_prompt', label: 'Step 2 Question', contentType: 'quiz_question', notes: 'Quiz step 2 question', optional: true, source: 'copy' },
  { id: 't1_q2_options', label: 'Step 2 Options', contentType: 'quiz_option', notes: '4-6 tiles, 2-4 words each', optional: true, isArray: true, source: 'copy' },
  { id: 't1_cta', label: 'Submit Button', contentType: 'cta', notes: 'Form submit CTA', source: 'copy' },
  { id: 't1_trust_line', label: 'Trust Line', contentType: 'proof', notes: 'Below CTA - social proof line', source: 'copy' },
  { id: 't1_proof_rating', label: 'Star Rating', contentType: 'star_rating', notes: 'Rating + count + platform', source: 'business' },
  { id: 't1_testimonials', label: 'Testimonials', contentType: 'testimonial', notes: '2-4 testimonials', isArray: true, source: 'business' },
  { id: 't1_trust_badges', label: 'Trust Badges', contentType: 'trust_badge', notes: 'Badge labels / images', isArray: true, source: 'business' },
  { id: 't1_disclaimer', label: 'Disclaimer', contentType: 'disclaimer', notes: 'Footer legal copy', source: 'business' },
]

// Template 2: Problem/Solution + Category Segmentation
export const TEMPLATE_2_SLOTS: CopySlotDef[] = [
  { id: 't2_pre_headline', label: 'Pre-headline', contentType: 'pre_headline', notes: '3-6 words, all caps', source: 'copy' },
  { id: 't2_headline', label: 'Hero Headline', contentType: 'headline', notes: '4-8 words', source: 'copy' },
  { id: 't2_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '1-2 sentences', source: 'copy' },
  { id: 't2_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: '3-5 words', source: 'copy' },
  { id: 't2_trust_trio', label: 'Trust Trio', contentType: 'trust_badge', notes: '3 trust signals', isArray: true, source: 'business' },
  { id: 't2_category_headline', label: 'Category Headline', contentType: 'headline', notes: '5-9 words', source: 'copy' },
  { id: 't2_categories', label: 'Category Cards', contentType: 'category_card', notes: '4-8 cards: emoji + label + description', isArray: true, source: 'copy' },
  { id: 't2_benefits_headline', label: 'Benefits Headline', contentType: 'headline', notes: '4-7 words', source: 'copy' },
  { id: 't2_benefits', label: 'Benefits', contentType: 'benefit', notes: '3 cards: headline + explanation', isArray: true, source: 'copy' },
  { id: 't2_proof_rating', label: 'Proof Rating', contentType: 'star_rating', notes: 'Stars + count + platform', source: 'business' },
  { id: 't2_testimonials', label: 'Testimonials', contentType: 'testimonial', notes: '3-4 testimonials', isArray: true, source: 'business' },
  { id: 't2_results_headline', label: 'Results Headline', contentType: 'headline', notes: '3-5 words', source: 'copy' },
  { id: 't2_results', label: 'Results', contentType: 'result_stat', notes: '3-5: figure + label', isArray: true, source: 'business' },
  { id: 't2_final_headline', label: 'Final CTA Headline', contentType: 'headline', notes: '5-10 words', source: 'copy' },
  { id: 't2_final_cta', label: 'Final CTA', contentType: 'cta', notes: '3-5 words', source: 'copy' },
  { id: 't2_phone_cta', label: 'Phone CTA', contentType: 'phone_number', notes: 'Phone number, optional', source: 'business' },
  { id: 't2_disclaimer', label: 'Disclaimer', contentType: 'disclaimer', notes: 'Footer legal', source: 'business' },
]

// Template 3: Feature-Dense Authority Page
export const TEMPLATE_3_SLOTS: CopySlotDef[] = [
  { id: 't3_headline', label: 'Hero Headline', contentType: 'headline', notes: '6-10 words', source: 'copy' },
  { id: 't3_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '2-3 sentences', source: 'copy' },
  { id: 't3_feature_bullets', label: 'Feature Bullets', contentType: 'benefit', notes: '3-4 hero bullets', isArray: true, source: 'copy' },
  { id: 't3_form_headline', label: 'Form Headline', contentType: 'headline', notes: 'Above form card', source: 'copy' },
  { id: 't3_form_cta', label: 'Form CTA', contentType: 'cta', notes: 'Submit button text', source: 'copy' },
  { id: 't3_secondary_cta', label: 'Secondary CTA', contentType: 'cta', notes: 'Secondary action', source: 'copy' },
  { id: 't3_logo_bar_label', label: 'Logo Bar Label', contentType: 'logo_bar', notes: '"Trusted by X" line', source: 'business' },
  { id: 't3_tab_headline', label: 'Tab Section Headline', contentType: 'headline', notes: 'Above tabs', source: 'copy' },
  { id: 't3_tab_subheadline', label: 'Tab Section Subheadline', contentType: 'subheadline', notes: 'Below tab headline', source: 'copy' },
  { id: 't3_tabs', label: 'Use Case Tabs', contentType: 'use_case_tab', notes: 'Each: label + headline + bullets + CTA', isArray: true, source: 'copy' },
  { id: 't3_features_headline', label: 'Features Headline', contentType: 'headline', notes: 'Above features grid', source: 'copy' },
  { id: 't3_features', label: 'Features', contentType: 'benefit', notes: '6-9: name + description', isArray: true, source: 'copy' },
  { id: 't3_proof_ratings', label: 'Proof Ratings', contentType: 'star_rating', notes: '2-3 platform ratings', isArray: true, source: 'business' },
  { id: 't3_testimonials', label: 'Testimonials', contentType: 'testimonial', notes: '2-3 extended testimonials', isArray: true, source: 'business' },
  { id: 't3_final_headline', label: 'Final Headline', contentType: 'headline', notes: 'Close headline', source: 'copy' },
  { id: 't3_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Primary final CTA', source: 'copy' },
  { id: 't3_final_secondary_cta', label: 'Final Secondary CTA', contentType: 'cta', notes: 'Secondary final CTA', source: 'copy' },
]

// Template 4: Possibility Showcase / Output Gallery
export const TEMPLATE_4_SLOTS: CopySlotDef[] = [
  { id: 't4_headline', label: 'Hero Headline', contentType: 'headline', notes: '6-10 words, bold claim', source: 'copy' },
  { id: 't4_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '1-2 sentences', source: 'copy' },
  { id: 't4_primary_cta', label: 'Primary CTA', contentType: 'cta', notes: 'Main hero CTA', source: 'copy' },
  { id: 't4_secondary_cta', label: 'Secondary CTA', contentType: 'cta', notes: 'Secondary hero CTA', source: 'copy' },
  { id: 't4_stats', label: 'Stats', contentType: 'result_stat', notes: '3 scale numbers + labels', isArray: true, source: 'business' },
  { id: 't4_logo_bar_label', label: 'Logo Bar Label', contentType: 'logo_bar', notes: '"Featured in" label', source: 'business' },
  { id: 't4_use_case_tabs', label: 'Use Case Tabs', contentType: 'use_case_tab', notes: 'Tab labels', isArray: true, source: 'copy' },
  { id: 't4_showcase_blocks', label: 'Showcase Blocks', contentType: 'showcase_block', notes: 'Each: badge + headline + description + CTA', isArray: true, source: 'copy' },
  { id: 't4_capability_headline', label: 'Capability Headline', contentType: 'headline', notes: '3-5 words', source: 'copy' },
  { id: 't4_capability_cards', label: 'Capability Cards', contentType: 'benefit', notes: '3-4: headline + description', isArray: true, source: 'copy' },
  { id: 't4_final_headline', label: 'Final Headline', contentType: 'headline', notes: '5-9 words', source: 'copy' },
  { id: 't4_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Primary final CTA', source: 'copy' },
  { id: 't4_final_secondary_cta', label: 'Final Secondary CTA', contentType: 'cta', notes: 'Secondary final CTA', source: 'copy' },
]

// Template 5: Video + Social Proof Wall
export const TEMPLATE_5_SLOTS: CopySlotDef[] = [
  { id: 't5_headline', label: 'Hero Headline', contentType: 'headline', notes: '4-8 words', source: 'copy' },
  { id: 't5_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: '1-2 sentences', source: 'copy' },
  { id: 't5_video_url', label: 'Video URL', contentType: 'video_url', notes: 'URL or [PLACEHOLDER]', source: 'media' },
  { id: 't5_primary_cta', label: 'Primary CTA', contentType: 'cta', notes: 'Below video', source: 'copy' },
  { id: 't5_who_headline', label: 'Who Its For Headline', contentType: 'headline', notes: '4-7 words', source: 'copy' },
  { id: 't5_who_bullets', label: 'Who Its For Bullets', contentType: 'benefit', notes: '4-6 identity statements', isArray: true, source: 'copy' },
  { id: 't5_testimonials_headline', label: 'Testimonials Headline', contentType: 'headline', notes: '5-9 words', source: 'copy' },
  { id: 't5_testimonials', label: 'Testimonials', contentType: 'testimonial', notes: '8-16 minimum', isArray: true, source: 'business' },
  { id: 't5_video_testimonials', label: 'Video Testimonials', contentType: 'video_testimonial', notes: 'Optional: thumbnail + name + result', isArray: true, source: 'business' },
  { id: 't5_final_headline', label: 'Final Headline', contentType: 'headline', notes: '5-10 words', source: 'copy' },
  { id: 't5_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Final button', source: 'copy' },
]

// Template 6: VSL / Long-Form Direct Response
export const TEMPLATE_6_SLOTS: CopySlotDef[] = [
  { id: 't6_pre_headline', label: 'Pre-headline', contentType: 'pre_headline', notes: 'Audience callout, 5-10 words', source: 'copy' },
  { id: 't6_headline', label: 'Hero Headline', contentType: 'headline', notes: 'Bold promise, 8-16 words', source: 'copy' },
  { id: 't6_video_url', label: 'Video URL', contentType: 'video_url', notes: 'URL or [PLACEHOLDER]', source: 'media' },
  { id: 't6_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: 'Below video', source: 'copy' },
  { id: 't6_problem_copy', label: 'Problem Copy', contentType: 'long_form_copy', notes: '150-250 words, full paragraphs', source: 'copy' },
  { id: 't6_solution_copy', label: 'Solution Copy', contentType: 'long_form_copy', notes: '150-200 words, full paragraphs', source: 'copy' },
  { id: 't6_offer_items', label: 'Offer Stack Items', contentType: 'benefit', notes: '5-8: name + description', isArray: true, source: 'copy' },
  { id: 't6_proof_items', label: 'Proof Items', contentType: 'testimonial', notes: '2-4: name + result + story', isArray: true, source: 'business' },
  { id: 't6_faq', label: 'FAQ', contentType: 'faq', notes: '5-8 Q&A pairs', isArray: true, source: 'copy' },
  { id: 't6_guarantee', label: 'Guarantee', contentType: 'guarantee', notes: '100-150 words', source: 'copy' },
  { id: 't6_urgency', label: 'Urgency', contentType: 'urgency', notes: '1-2 sentences', source: 'copy' },
  { id: 't6_final_cta', label: 'Final CTA', contentType: 'cta', notes: 'Final button', source: 'copy' },
]

// Template 7: Comparison / Challenger
export const TEMPLATE_7_SLOTS: CopySlotDef[] = [
  { id: 't7_headline', label: 'Hero Headline', contentType: 'headline', notes: 'Challenger framing, 6-12 words', source: 'copy' },
  { id: 't7_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: 'Problem with status quo', source: 'copy' },
  { id: 't7_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: '3-5 words', source: 'copy' },
  { id: 't7_comparison_label_old', label: 'Old Way Label', contentType: 'comparison_label', notes: '"The Old Way" header', source: 'copy' },
  { id: 't7_comparison_label_new', label: 'New Way Label', contentType: 'comparison_label', notes: '"The [Brand] Way" header', source: 'copy' },
  { id: 't7_comparison_rows', label: 'Comparison Rows', contentType: 'comparison_row', notes: '5-8 rows: dimension + old + new', isArray: true, source: 'copy' },
  { id: 't7_benefits_headline', label: 'Benefits Headline', contentType: 'headline', notes: '4-7 words', source: 'copy' },
  { id: 't7_benefits', label: 'Benefits', contentType: 'benefit', notes: '3-4 cards', isArray: true, source: 'copy' },
  { id: 't7_testimonials_headline', label: 'Testimonials Headline', contentType: 'headline', notes: '4-8 words', source: 'copy' },
  { id: 't7_testimonials', label: 'Testimonials', contentType: 'testimonial', notes: '3-5 switcher testimonials', isArray: true, source: 'business' },
  { id: 't7_final_headline', label: 'Final Headline', contentType: 'headline', notes: '5-9 words', source: 'copy' },
  { id: 't7_final_cta', label: 'Final CTA', contentType: 'cta', notes: '3-5 words', source: 'copy' },
]

// Template 8: Urgency / Event-Driven
export const TEMPLATE_8_SLOTS: CopySlotDef[] = [
  { id: 't8_pre_headline', label: 'Alert Label', contentType: 'pre_headline', notes: '2-5 words, emoji OK', source: 'copy' },
  { id: 't8_headline', label: 'Hero Headline', contentType: 'headline', notes: 'Event-triggered, 8-14 words', source: 'copy' },
  { id: 't8_subheadline', label: 'Hero Subheadline', contentType: 'subheadline', notes: 'Why waiting is dangerous', source: 'copy' },
  { id: 't8_hero_cta', label: 'Hero CTA', contentType: 'cta', notes: '3-5 words', source: 'copy' },
  { id: 't8_urgency_element', label: 'Urgency Element', contentType: 'urgency', notes: 'Deadline/capacity signal', source: 'copy' },
  { id: 't8_risk_headline', label: 'Risk Headline', contentType: 'headline', notes: '"What Happens If You Wait"', source: 'copy' },
  { id: 't8_risks', label: 'Risk Items', contentType: 'fear_point', notes: '3-4: bold statement + explanation', isArray: true, source: 'copy' },
  { id: 't8_steps', label: 'Process Steps', contentType: 'process_step', notes: '3 steps: name + description', isArray: true, source: 'copy' },
  { id: 't8_proof_items', label: 'Proof Items', contentType: 'trust_badge', notes: 'Trust badges + testimonials', isArray: true, source: 'business' },
  { id: 't8_final_urgency', label: 'Final Urgency', contentType: 'urgency', notes: '1-2 sentences', source: 'copy' },
  { id: 't8_final_cta', label: 'Final CTA', contentType: 'cta', notes: '3-5 words', source: 'copy' },
  { id: 't8_phone_cta', label: 'Phone CTA', contentType: 'phone_number', notes: 'Phone number, optional', source: 'business' },
  { id: 't8_disclaimer', label: 'Disclaimer', contentType: 'disclaimer', notes: 'Footer legal', source: 'business' },
]

// Map template IDs to their slot definitions
// New template slugs map to existing slot definitions
export const TEMPLATE_SLOTS: Record<string, CopySlotDef[]> = {
  'lead-capture-classic': TEMPLATE_1_SLOTS,
  // Legacy IDs kept for backward compatibility with existing landing pages
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
// Copy Slot Mapping Helpers
// ============================================================

/**
 * Map copy components to template slots based on component type.
 *
 * IMPORTANT: Only maps to slots with source='copy'. Business asset slots
 * (testimonials, ratings, badges, disclaimers) and media slots are NEVER
 * auto-filled -- those come from Business Overview or are entered manually.
 *
 * Returns:
 * - filled: auto-filled slots (only for copy slots with a direct type match)
 * - missing: slot IDs with no matching copy (copy slots only)
 * - options: all available copy options per slot (for the picker UI, copy slots only)
 * - businessSlots: slot IDs that are business assets (for UI labeling)
 * - mediaSlots: slot IDs that are media (for UI labeling)
 */
export function mapComponentsToSlots(
  templateId: string,
  components: Array<{ id?: string; type: string; text: string }>
): {
  filled: Record<string, string>
  missing: string[]
  options: Record<string, Array<{ id?: string; text: string }>>
  businessSlots: string[]
  mediaSlots: string[]
} {
  const slots = TEMPLATE_SLOTS[templateId]
  if (!slots) return { filled: {}, missing: [], options: {}, businessSlots: [], mediaSlots: [] }

  const filled: Record<string, string> = {}
  const missing: string[] = []
  const options: Record<string, Array<{ id?: string; text: string }>> = {}
  const businessSlots: string[] = []
  const mediaSlots: string[] = []

  // Group components by type
  const byType: Record<string, Array<{ id?: string; text: string }>> = {}
  for (const comp of components) {
    if (!byType[comp.type]) byType[comp.type] = []
    byType[comp.type].push({ id: comp.id, text: comp.text })
  }

  // Track which types have been auto-filled
  const autoFilledTypes: Record<string, number> = {}

  for (const slot of slots) {
    if (slot.source === 'business') {
      businessSlots.push(slot.id)
      continue
    }

    if (slot.source === 'media') {
      mediaSlots.push(slot.id)
      continue
    }

    const available = byType[slot.contentType] || []
    options[slot.id] = available

    if (available.length > 0) {
      if (slot.isArray) {
        filled[slot.id] = available.map(a => a.text).join(' | ')
      } else {
        const typeCount = autoFilledTypes[slot.contentType] || 0
        if (typeCount < available.length) {
          filled[slot.id] = available[typeCount].text
          autoFilledTypes[slot.contentType] = typeCount + 1
        } else if (!slot.optional) {
          missing.push(slot.id)
        }
      }
    } else if (!slot.optional) {
      missing.push(slot.id)
    }
  }

  return { filled, missing, options, businessSlots, mediaSlots }
}
