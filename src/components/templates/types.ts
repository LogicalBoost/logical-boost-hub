export interface BrandKit {
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
  heading_font: string
  body_font: string
  button_style?: {
    borderRadius?: string
    textTransform?: string
  }
  logo_url?: string
}

export interface SectionItem {
  icon?: string
  title?: string
  text?: string
  question?: string
  answer?: string
  name?: string
  role?: string
  quote?: string
  photo?: string
  rating?: number
  stat?: string
  label?: string
  value?: string
  image?: string
  url?: string
}

export interface FooterLink {
  label: string
  url: string
}

export interface SocialLink {
  platform: string
  url: string
}

export interface Section {
  type: string
  headline?: string
  subheadline?: string
  content?: string
  cta?: string
  cta_url?: string
  sub_cta?: string
  sub_cta_icon?: string
  items?: SectionItem[]
  show_form?: boolean
  image?: string
  background?: string
  accent_word?: string
  links?: FooterLink[]
  socials?: SocialLink[]
  phone?: string
}

export interface TrustpilotWidget {
  businessUnitId?: string
  domain?: string
  reviewUrl?: string
  miniWidget?: string
  carouselWidget?: string
  gridWidget?: string
  scriptTag?: string
}

export interface ReviewSite {
  platform: 'google' | 'yelp' | 'bbb' | 'facebook' | 'trustpilot'
  url: string
  rating?: number       // 1-5 star rating (manually entered or fetched)
  review_count?: number  // total number of reviews
  enabled?: boolean      // whether to show on landing pages (default true)
}

export interface MediaAssets {
  hero_image?: string
  parallax_image?: string
  logo?: string
  testimonial_photos?: string[]
  certification_badges?: string[]
  team_photo?: string
  process_image?: string
  before_after?: string[]
  gallery?: string[]
  two_column_image?: string
  steps_image?: string
  benefits_image?: string
  trustpilot_widget?: TrustpilotWidget
  review_sites?: ReviewSite[]
  [key: string]: string | string[] | TrustpilotWidget | ReviewSite[] | undefined
}

// Form system types
export interface FormFieldDef {
  id: string
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'checkbox' | 'hidden' | 'radio' | 'number'
  name: string
  label: string
  placeholder?: string
  required?: boolean
  validation?: { pattern?: string; min_length?: number; max_length?: number }
  options?: Array<{ value: string; label: string }>
  width?: 'full' | 'half'
}

export interface FormStepDef {
  id: string
  name: string
  field_ids: string[]
}

export interface FormSettings {
  submit_button_text?: string
  success_message?: string
  redirect_url?: string
  show_progress_bar?: boolean
  next_button_text?: string
  back_button_text?: string
}

export interface FormConfig {
  id: string
  form_type: 'standard' | 'multi_step'
  name?: string
  fields: FormFieldDef[]
  steps?: FormStepDef[] | null
  settings: FormSettings
}

export interface TemplateInfo {
  slug: string
  name: string
}

export interface PageData {
  template: TemplateInfo
  sections: Section[]
  brandKit: BrandKit
  mediaAssets: MediaAssets
}
