'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Section, MediaAssets, BrandKit, TrustpilotWidget, FormConfig } from '@/components/templates/types'
import LeadCaptureClassic from '@/components/templates/LeadCaptureClassic'

/** Check if a hex color is too light for white/light backgrounds */
function isLightColor(color: string): boolean {
  const hex = color.replace('#', '')
  if (hex.length < 6) return false
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}

interface PageRecord {
  id: string
  slug: string
  client_slug: string | null
  template_slug: string | null
  copy_slots: Record<string, string> | null
  sections: Section[] | null
  media_assets: Record<string, string> | null
  brand_kit_snapshot: BrandKit | null
  form_snapshot: FormConfig | null
  status: string
}

/**
 * Convert flat copy_slots (Record<string, string>) into Section[] for template rendering.
 *
 * LeadCaptureClassic expects these section types:
 *   hero, feature_cards, two_column_info, steps, trust_bar, benefits_grid, testimonials, faq, footer
 *
 * When slots are sparse (only hero data), we still emit all sections with placeholder
 * content so the template renders a full page rather than just a hero + footer.
 */
function copySlotsToSections(slots: Record<string, string>, headline: string, cta: string): Section[] {
  const sections: Section[] = []

  // ─── Hero ───
  sections.push({
    type: 'hero',
    headline: slots.t1_headline || slots.hero_headline || headline || 'Welcome',
    subheadline: slots.t1_subheadline || slots.hero_subheadline || '',
    cta: slots.t1_cta || slots.hero_cta || cta || 'Get Started',
    sub_cta: slots.t1_trust_line || slots.trust_line || '',
    sub_cta_icon: 'shield',
    show_form: true,
  })

  // ─── Feature Cards Bar ───
  const featureItems: Array<{ icon?: string; title?: string; text?: string }> = []
  for (let i = 1; i <= 6; i++) {
    const title = slots[`feature_${i}_title`] || slots[`t2_categories_${i}`]
    const text = slots[`feature_${i}_text`] || slots[`t2_categories_${i}_desc`]
    if (title) featureItems.push({ icon: slots[`feature_${i}_icon`] || 'check', title, text: text || '' })
  }
  // Always emit feature_cards — use placeholders if empty
  sections.push({
    type: 'feature_cards',
    headline: slots.features_headline || slots.t2_category_headline || '',
    items: featureItems.length > 0 ? featureItems : [
      { icon: 'zap', title: 'Fast Approval', text: 'Quick and easy process' },
      { icon: 'shield', title: 'Trusted Service', text: 'Industry-leading standards' },
      { icon: 'dollar', title: 'Great Rates', text: 'Competitive pricing' },
      { icon: 'check', title: 'Proven Results', text: 'Thousands of happy clients' },
    ],
  })

  // ─── Two Column Info ───
  const infoItems: Array<{ title?: string; text?: string }> = []
  for (let i = 1; i <= 4; i++) {
    const title = slots[`benefit_${i}_title`] || slots[`t2_benefits_${i}`]
    const text = slots[`benefit_${i}_text`] || slots[`t2_benefits_${i}_desc`]
    if (title) infoItems.push({ title, text: text || '' })
  }
  sections.push({
    type: 'two_column_info',
    headline: slots.info_headline || slots.t2_benefits_headline || slots.problem_headline || 'Why It Matters',
    content: slots.info_content || slots.problem_content || slots.t1_subheadline || '',
    items: infoItems.length > 0 ? infoItems : [
      { title: 'Expert Guidance', text: 'Our team helps you every step of the way' },
      { title: 'Tailored Solutions', text: 'Customized to fit your unique situation' },
    ],
  })

  // ─── Steps ───
  const stepItems: Array<{ title?: string; text?: string }> = []
  for (let i = 1; i <= 5; i++) {
    const title = slots[`step_${i}_title`]
    const text = slots[`step_${i}_text`]
    if (title) stepItems.push({ title, text: text || '' })
  }
  sections.push({
    type: 'steps',
    headline: slots.steps_headline || 'How It Works',
    items: stepItems.length > 0 ? stepItems : [
      { title: 'Apply Online', text: 'Fill out our simple form in minutes' },
      { title: 'Get Matched', text: 'We find the best option for you' },
      { title: 'Get Funded', text: 'Receive your funds quickly' },
    ],
  })

  // ─── Trust Bar (parallax) ───
  sections.push({
    type: 'trust_bar',
    headline: slots.trust_headline || '',
    content: slots.trust_content || slots.t1_trust_line || '',
    items: [
      { stat: slots.trust_stat_1 || '1000+', label: slots.trust_label_1 || 'Happy Clients' },
      { stat: slots.trust_stat_2 || '12+', label: slots.trust_label_2 || 'Years Experience' },
      { stat: slots.trust_stat_3 || '4.9', label: slots.trust_label_3 || 'Star Rating' },
    ],
  })

  // ─── Benefits Grid ───
  const benefitGridItems: Array<{ icon?: string; title?: string; text?: string }> = []
  for (let i = 1; i <= 8; i++) {
    const title = slots[`grid_benefit_${i}_title`]
    const text = slots[`grid_benefit_${i}_text`]
    if (title) benefitGridItems.push({ icon: slots[`grid_benefit_${i}_icon`], title, text: text || '' })
  }
  sections.push({
    type: 'benefits_grid',
    headline: slots.benefits_headline || 'Benefits',
    items: benefitGridItems.length > 0 ? benefitGridItems : [
      { icon: 'check', title: 'No Hidden Fees', text: 'Transparent pricing from start to finish' },
      { icon: 'clock', title: 'Quick Process', text: 'Get approved in as little as one day' },
      { icon: 'shield', title: 'Secure & Private', text: 'Your information is always protected' },
      { icon: 'star', title: 'Top Rated', text: 'Thousands of 5-star reviews' },
      { icon: 'users', title: 'Dedicated Support', text: 'A real person to help you every step' },
      { icon: 'dollar', title: 'Competitive Rates', text: 'Fair terms designed for your situation' },
    ],
  })

  // ─── Testimonials ───
  const testimonialItems: Array<{ name?: string; quote?: string; role?: string; rating?: number }> = []
  for (let i = 1; i <= 6; i++) {
    const name = slots[`testimonial_${i}_name`] || slots[`t1_testimonials_${i}_name`]
    const quote = slots[`testimonial_${i}_quote`] || slots[`t1_testimonials_${i}`]
    if (name || quote) {
      testimonialItems.push({
        name: name || 'Customer',
        quote: quote || '',
        role: slots[`testimonial_${i}_role`] || '',
        rating: 5,
      })
    }
  }
  if (testimonialItems.length > 0) {
    sections.push({
      type: 'testimonials',
      headline: slots.testimonials_headline || 'What Our Clients Say',
      items: testimonialItems,
    })
  }

  // ─── FAQ ───
  const faqItems: Array<{ question?: string; answer?: string }> = []
  for (let i = 1; i <= 8; i++) {
    const question = slots[`faq_${i}_question`] || slots[`faq_${i}_q`]
    const answer = slots[`faq_${i}_answer`] || slots[`faq_${i}_a`]
    if (question) faqItems.push({ question, answer: answer || '' })
  }
  if (faqItems.length > 0) {
    sections.push({
      type: 'faq',
      headline: slots.faq_headline || 'Frequently Asked Questions',
      items: faqItems,
    })
  }

  // ─── Footer ───
  sections.push({
    type: 'footer',
    headline: slots.t2_final_headline || slots.final_headline || slots.t1_headline || headline || 'Get Started Today',
    cta: slots.t2_final_cta || slots.final_cta || slots.t1_cta || cta || 'Get Started',
    content: slots.t1_disclaimer || slots.disclaimer || '',
    phone: slots.t2_phone_cta || slots.phone || '',
  })

  return sections
}

export default function LandingPage() {
  const params = useParams()
  const clientSlug = params?.client as string
  const pageSlug = params?.slug as string

  const [page, setPage] = useState<PageRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!clientSlug || !pageSlug) return

    async function fetchPage() {
      try {
        // Query published_pages directly by client_slug + slug
        const { data: pages, error } = await supabase
          .from('published_pages')
          .select('id, slug, client_slug, template_slug, copy_slots, sections, media_assets, brand_kit_snapshot, form_snapshot, status')
          .eq('client_slug', clientSlug)
          .eq('slug', pageSlug)
          .eq('status', 'published')
          .limit(1)

        if (error) {
          console.error('Page query error:', error)
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!pages || pages.length === 0) {
          setNotFound(true)
          setLoading(false)
          return
        }

        setPage(pages[0] as unknown as PageRecord)
      } catch (err) {
        console.error('Page fetch error:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPage()
  }, [clientSlug, pageSlug])

  // Inject brand kit CSS custom properties
  useEffect(() => {
    if (!page?.brand_kit_snapshot) return

    const bk = page.brand_kit_snapshot
    const root = document.documentElement

    root.style.setProperty('--color-primary', bk.primary_color || '#1a365d')
    root.style.setProperty('--color-secondary', bk.secondary_color || '#1a202c')
    root.style.setProperty('--color-accent', bk.accent_color || '#10b981')
    root.style.setProperty('--color-background', bk.background_color || '#ffffff')
    // Safety: if text_color is too light for white backgrounds, force dark
    const safeTextColor = isLightColor(bk.text_color || '') ? '#1a202c' : (bk.text_color || '#1a202c')
    root.style.setProperty('--color-text', safeTextColor)
    root.style.setProperty('--font-heading', bk.heading_font || 'Inter, sans-serif')
    root.style.setProperty('--font-body', bk.body_font || 'Inter, sans-serif')
    root.style.setProperty('--button-radius', bk.button_style?.borderRadius || '9999px')

    // Load Google Fonts
    const fonts = [bk.heading_font, bk.body_font].filter(Boolean)
    const uniqueFonts = [...new Set(fonts)].filter(f => f && !f.includes('sans-serif') && !f.includes('serif'))
    if (uniqueFonts.length > 0) {
      const families = uniqueFonts.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800;900`).join('&')
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
      document.head.appendChild(link)
    }

    // Override Hub dark theme for landing pages
    document.body.style.background = '#ffffff'
    document.body.style.color = safeTextColor

    return () => {
      document.body.style.background = ''
      document.body.style.color = ''
    }
  }, [page])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #e5e7eb',
          borderTopColor: '#10b981',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (notFound || !page) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        color: '#1a202c',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 800, color: '#e5e7eb', marginBottom: 8 }}>404</h1>
        <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>Page not found</p>
      </div>
    )
  }

  // Use AI-generated sections if available, otherwise convert from flat copy_slots
  let sections: Section[]
  if (page.sections && Array.isArray(page.sections) && page.sections.length > 0) {
    // AI-generated sections — already in the right format
    sections = page.sections as Section[]
  } else {
    // Legacy: convert flat copy_slots to Section[]
    const copySlots = page.copy_slots || {}
    const mainHeadline = copySlots.t1_headline || copySlots.hero_headline || 'Welcome'
    const mainCta = copySlots.t1_cta || copySlots.hero_cta || 'Get Started'
    sections = copySlotsToSections(copySlots, mainHeadline, mainCta)
  }

  // Build media assets
  const media: MediaAssets = {
    hero_image: page.media_assets?.hero_image || undefined,
    parallax_image: page.media_assets?.parallax_image || undefined,
    logo: page.media_assets?.logo || undefined,
    two_column_image: page.media_assets?.two_column_image || undefined,
    steps_image: page.media_assets?.steps_image || undefined,
    benefits_image: page.media_assets?.benefits_image || undefined,
    process_image: page.media_assets?.process_image || undefined,
    team_photo: page.media_assets?.team_photo || undefined,
    testimonial_photos: (page.media_assets?.testimonial_photos as string[] | undefined) || undefined,
    trustpilot_widget: (page.media_assets?.trustpilot_widget as TrustpilotWidget | undefined) || undefined,
    review_sites: (page.media_assets?.review_sites as Array<{ platform: 'google' | 'yelp' | 'bbb' | 'facebook' | 'trustpilot'; url: string; rating?: number; review_count?: number; enabled?: boolean }> | undefined) || undefined,
  }

  // Route to the correct template
  const templateSlug = page.template_slug || 'lead-capture-classic'

  switch (templateSlug) {
    case 'lead-capture-classic':
    default:
      return (
        <LeadCaptureClassic
          sections={sections}
          media={media}
          brandKit={page.brand_kit_snapshot}
          formConfig={page.form_snapshot || null}
          pageSlug={pageSlug}
          clientSlug={clientSlug}
          publishedPageId={page.id}
        />
      )
  }
}
