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
  landing_page_playbook: Record<string, unknown> | null
  landing_page_concepts: Record<string, unknown>[] | null
  intake_status: 'pending' | 'completed'
  github_repo: string | null
  custom_domain: string | null
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
  priority: number
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
  | 'video_script'
  | 'objection_handler'
  | 'description'
  // Legacy types kept for backward compat with existing data
  | 'short_script'
  | 'long_script'
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
  primary_angle: string | null
  secondary_angles: string[] | null
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

// Landing page templates — matches page_templates table slugs
export type TemplateId =
  | 'lead-capture-classic'
  | 'bold-split'
  | 'social-proof-heavy'
  | 'minimal-direct'

export interface TemplateDefinition {
  name: string
  description: string
  sections: string[]
  comingSoon?: boolean
}

export const AVAILABLE_TEMPLATES: (TemplateDefinition & { id: TemplateId })[] = [
  {
    id: 'lead-capture-classic',
    name: 'Lead Capture Classic',
    description: 'Standard lead gen — inspections, quotes, consultations. Clean hero with animated background, offer bullets, parallax trust section, testimonials, FAQ.',
    sections: ['hero', 'feature_cards', 'two_column_info', 'steps', 'trust_bar', 'benefits_grid', 'testimonials', 'faq'],
  },
  {
    id: 'bold-split',
    name: 'Bold Split',
    description: 'High-urgency, fear/risk, storm damage, emergency. Split-screen hero with bold imagery and urgent CTA.',
    sections: [],
    comingSoon: true,
  },
  {
    id: 'social-proof-heavy',
    name: 'Social Proof Heavy',
    description: 'Trust-first industries, credibility barriers. Review wall, certification badges, before/after gallery.',
    sections: [],
    comingSoon: true,
  },
  {
    id: 'minimal-direct',
    name: 'Minimal Direct',
    description: 'Simple offers, call-only pages, clean look. Minimal distraction, single CTA focus.',
    sections: [],
    comingSoon: true,
  },
]

export const TEMPLATE_INFO: Record<string, { name: string; bestFor: string }> = {
  'lead-capture-classic': { name: 'Lead Capture Classic', bestFor: 'Standard lead gen — inspections, quotes, consultations' },
  'bold-split': { name: 'Bold Split', bestFor: 'High-urgency, fear/risk, storm damage, emergency' },
  'social-proof-heavy': { name: 'Social Proof Heavy', bestFor: 'Trust-first industries, credibility barriers' },
  'minimal-direct': { name: 'Minimal Direct', bestFor: 'Simple offers, call-only pages, clean look' },
}

export interface IterationEntry {
  prompt: string
  preview_url: string | null
  timestamp: string
}

export interface LandingPage {
  id: string
  client_id: string
  funnel_instance_id: string | null
  avatar_id: string
  offer_id: string
  template_id: TemplateId | string | null
  copy_component_ids: string[]
  copy_slots: Record<string, string> | null
  headline: string
  subheadline: string
  cta: string
  // Build pipeline fields
  page_html: string | null
  iteration_history: IterationEntry[] | null
  react_output: string | null
  // Deploy fields
  deploy_status: 'draft' | 'pending_approval' | 'approved' | 'converting' | 'deployed' | 'failed'
  deploy_url: string | null
  // Legacy fields (kept for backward compat)
  section_data: Record<string, unknown>[] | null
  brand_kit_snapshot: Record<string, unknown> | null
  preview_image_url: string | null
  deployed_url: string | null
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
  | { type: 'hero'; headline: string; subheadline: string; cta: string; trust_items?: string[] }
  | { type: 'problem'; headline?: string; content: string }
  | { type: 'solution'; headline?: string; content: string; steps?: { title: string; description: string }[] }
  | { type: 'benefits'; headline?: string; items: string[] }
  | { type: 'proof'; headline?: string; items: string[] }
  | { type: 'faq'; headline?: string; items: FaqItem[] }
  | { type: 'final_cta'; headline: string; subheadline?: string; cta: string }
  | { type: 'urgency_bar'; text: string }
  | { type: 'comparison'; headline?: string; client_name: string; items: { feature: string; client: boolean; competitor: boolean }[] }
  | { type: 'process_steps'; headline?: string; steps: { number: number; title: string; description: string }[] }
  | { type: 'trust_strip'; items: string[] }
  | { type: 'form'; headline?: string; subheadline?: string; fields: string[]; cta: string }

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
  intel_type: 'ad' | 'landing_page' | 'keyword' | 'industry_playbook' | 'competitive_analysis'
  competitor_name: string | null
  competitor_website: string | null
  source: 'meta_ad_library' | 'manual' | 'google_ads' | 'ai_analysis' | 'industry_research' | 'ai_discovery'
  ad_type: 'social' | 'search' | 'display' | 'landing_page' | 'overview' | null
  content: string | null
  screenshot_url: string | null
  keywords: string[] | null
  angles_used: string[] | null
  landing_page_structure: string | null
  ai_analysis: string | null
  notes: string | null
  captured_at: string
  created_at: string
}

// Media asset roles (controlled values)
export type MediaAssetRole =
  | 'hero_image' | 'hero_video' | 'testimonial_photo' | 'team_photo'
  | 'background_texture' | 'before_after' | 'process_step'
  | 'certification_badge' | 'company_logo' | 'gallery' | 'icon_custom'
  | 'parallax' | 'photo' | 'other'

export interface MediaAsset {
  id: string
  client_id: string
  avatar_id: string | null
  file_url: string
  file_type: 'image' | 'video'
  role: MediaAssetRole
  alt_text: string | null
  display_name: string | null
  storage_path: string | null
  filename: string | null
  prompt_used: string | null
  style: string | null
  sort_order: number
  status: 'approved' | 'denied'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Legacy alias for backward compat during transition
export type AssetType = MediaAssetRole
export type ClientAsset = MediaAsset

// Brand kit record (from brand_kits table)
export interface BrandKitRecord {
  id: string
  client_id: string
  primary_color: string
  secondary_color: string
  accent_color: string | null
  background_color: string
  text_color: string
  heading_font: string
  body_font: string
  logo_url: string | null
  logo_dark_url: string | null
  button_style: { borderRadius?: string; textTransform?: string }
  custom_css: string | null
  created_at: string
  updated_at: string
}

// Page template record (from page_templates table)
export interface PageTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  template_type: string
  section_schema: { sections: string[] }
  slot_schema: Record<string, { slots: { name: string; role: MediaAssetRole; required: boolean; max?: number }[] }>
  preview_image_url: string | null
  is_active: boolean
  created_at: string
}

// Published page record (from published_pages table)
export interface PublishedPage {
  id: string
  client_id: string
  client_slug: string | null
  landing_page_id: string | null
  template_id: string | null
  template_slug: string | null
  avatar_id: string | null
  offer_id: string | null
  slug: string
  custom_domain: string | null
  copy_slots: Record<string, string> | null
  media_assets: Record<string, string> | null
  brand_kit_snapshot: Record<string, unknown> | null
  media_mapping: Record<string, string | string[]> | null
  page_file_path: string | null
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  created_at: string
  updated_at: string
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
