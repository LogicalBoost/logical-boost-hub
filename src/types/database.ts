export type UserRole = 'admin' | 'team_editor' | 'team_viewer' | 'client'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  client_id: string | null
  status: 'active' | 'disabled'
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  website: string
  business_summary: string | null
  services: string | null
  differentiators: string | null
  trust_signals: string | null
  tone: string | null
  ad_copy_rules: AdCopyRules | null
  ad_copy_notes: string | null
  competitors: Competitor[] | null
  brand_kit: BrandKit | null
  logo_url: string | null
  intake_status: 'pending' | 'completed'
  created_at: string
  updated_at: string
}

export interface AdCopyRules {
  tone_descriptors: string[]
  banned_words: string[]
  required_disclaimers: string[]
  platform_rules: {
    google: { headline_max_chars: number; description_max_chars: number }
    meta: { primary_text_max_chars: number; headline_max_chars: number }
    youtube: Record<string, never>
  }
  brand_constraints: string
  compliance_notes: string
}

export interface Competitor {
  name: string
  website: string
  notes: string
}

export interface BrandKit {
  colors?: {
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    background_color?: string
    text_color?: string
    additional_colors?: string[]
  }
  typography?: {
    heading_font?: string
    body_font?: string
    font_style_notes?: string
  }
  button_style?: {
    shape?: string
    color?: string
    text_color?: string
    style_notes?: string
  }
  visual_identity?: {
    overall_style?: string
    imagery_style?: string
    layout_pattern?: string
    whitespace?: string
    brand_mood?: string
  }
  logo_notes?: {
    description?: string
    placement?: string
    style?: string
  }
}

export interface ClientAssignment {
  id: string
  user_id: string
  client_id: string
  created_at: string
}

export interface Avatar {
  id: string
  client_id: string
  name: string
  avatar_type: string
  description: string | null
  pain_points: string | null
  motivations: string | null
  objections: string | null
  desired_outcome: string | null
  trigger_events: string | null
  messaging_style: string | null
  preferred_platforms: string[] | null
  recommended_angles: string[] | null
  status: 'approved' | 'denied'
  created_at: string
  updated_at: string
}

export interface Offer {
  id: string
  client_id: string
  name: string
  offer_type: 'lead_generation' | 'appointment' | 'purchase' | 'trial' | 'quote'
  headline: string | null
  subheadline: string | null
  description: string | null
  primary_cta: string | null
  conversion_type: 'lead_form' | 'phone_call' | 'booking' | 'purchase'
  benefits: string[] | null
  proof_elements: string[] | null
  urgency_elements: string[] | null
  faq: FaqItem[] | null
  landing_page_type: 'lead_capture' | 'call_only' | 'booking' | 'product_page'
  status: 'approved' | 'denied'
  created_at: string
  updated_at: string
}

export interface FaqItem {
  question: string
  answer: string
}

export type CopyComponentType =
  | 'headline'
  | 'subheadline'
  | 'primary_text'
  | 'google_headline'
  | 'google_description'
  | 'benefit'
  | 'proof'
  | 'urgency'
  | 'fear_point'
  | 'value_point'
  | 'cta'
  | 'video_hook'
  | 'short_script'
  | 'long_script'
  | 'video_script'
  | 'objection_handler'
  | 'description'
  | 'hero_headline'
  | 'hero_subheadline'
  | 'hero_cta'
  | 'urgency_bar'

export interface CopyComponent {
  id: string
  client_id: string
  type: CopyComponentType
  text: string
  character_count: number
  avatar_ids: string[]
  offer_ids: string[]
  angle_ids: string[]
  platform: string
  status: 'approved' | 'denied'
  funnel_instance_id: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface FunnelInstance {
  id: string
  client_id: string
  avatar_id: string
  offer_id: string
  generated_at: string
  status: 'active' | 'archived'
}

export interface Creative {
  id: string
  client_id: string
  funnel_instance_id: string
  avatar_id: string
  offer_id: string
  copy_component_ids: string[]
  creative_type: 'static_image' | 'video' | 'carousel' | 'story' | 'landing_hero'
  headline: string
  support_copy: string
  cta: string
  concept_description: string | null
  visual_prompt: string | null
  image_url: string | null
  status: 'approved' | 'denied'
  created_at: string
  updated_at: string
}

export interface LandingPage {
  id: string
  client_id: string
  funnel_instance_id: string
  avatar_id: string
  offer_id: string
  copy_component_ids: string[]
  headline: string
  subheadline: string
  cta: string
  sections: LandingPageSection[]
  preview_image_url: string | null
  deployed_url: string | null
  deploy_status: 'draft' | 'deployed' | 'stale'
  status: 'approved' | 'denied'
  created_at: string
  updated_at: string
}

// Angle badge color map for UI
export const ANGLE_COLORS: Record<string, string> = {
  problem: '#ef4444',
  outcome: '#22c55e',
  fear: '#f97316',
  opportunity: '#3b82f6',
  curiosity: '#a855f7',
  proof: '#14b8a6',
  authority: '#6366f1',
  mechanism: '#ec4899',
  speed: '#eab308',
  cost: '#06b6d4',
  comparison: '#f43f5e',
  identity: '#8b5cf6',
  mistake: '#d946ef',
  hidden_truth: '#0ea5e9',
  before_after: '#84cc16',
}

export type LandingPageSection =
  | { type: 'hero'; headline: string; subheadline: string; cta: string }
  | { type: 'problem'; content: string }
  | { type: 'solution'; content: string }
  | { type: 'benefits'; items: string[] }
  | { type: 'proof'; items: string[] }
  | { type: 'faq'; items: FaqItem[] }
  | { type: 'final_cta'; headline: string; cta: string }

export interface IntakeQuestion {
  id: string
  client_id: string
  section: string
  question: string
  answer: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CompetitorIntel {
  id: string
  client_id: string
  competitor_name: string
  competitor_website: string
  source: 'meta_ad_library' | 'manual' | 'google_ads' | 'ai_discovery'
  ad_type: 'social' | 'search' | 'display' | 'landing_page' | 'overview'
  content: string | null
  screenshot_url: string | null
  keywords: string[] | null
  notes: string | null
  captured_at: string
  created_at: string
}

// Angle definitions
export interface Angle {
  slug: string
  label: string
  definition: string
}

export const ANGLES: Angle[] = [
  { slug: 'problem', label: 'Pain Point', definition: 'Focus on a pain the audience is currently experiencing' },
  { slug: 'outcome', label: 'Desired Result', definition: 'Focus on the transformation or end result' },
  { slug: 'fear', label: 'Fear & Risk', definition: 'Focus on what the audience risks losing or doing wrong' },
  { slug: 'opportunity', label: 'New Opportunity', definition: 'Highlight a new advantage, trend, or method' },
  { slug: 'curiosity', label: 'Curiosity Hook', definition: 'Create intrigue or a pattern interrupt' },
  { slug: 'proof', label: 'Social Proof', definition: 'Show measurable results or case studies' },
  { slug: 'authority', label: 'Authority & Trust', definition: 'Establish expertise, scale, or credibility' },
  { slug: 'mechanism', label: 'How It Works', definition: 'Explain how the solution works (unique method/system)' },
  { slug: 'speed', label: 'Fast Results', definition: 'Emphasize quick results or rapid setup' },
  { slug: 'cost', label: 'Cost Savings', definition: 'Focus on saving money or improving efficiency' },
  { slug: 'comparison', label: 'Us vs. Them', definition: 'Contrast against current alternatives' },
  { slug: 'identity', label: 'Audience Callout', definition: 'Call out a specific audience segment directly' },
  { slug: 'mistake', label: 'Common Mistakes', definition: 'Highlight errors the audience is making' },
  { slug: 'hidden_truth', label: 'Hidden Truth', definition: 'Reveal something counterintuitive or unknown' },
  { slug: 'before_after', label: 'Before & After', definition: 'Show contrast between current state and improved state' },
]

export function getAngleLabel(slug: string): string {
  return ANGLES.find(a => a.slug === slug)?.label ?? slug
}
