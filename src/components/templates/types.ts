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
  steps_image?: string
  benefits_image?: string
  [key: string]: string | string[] | undefined
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
