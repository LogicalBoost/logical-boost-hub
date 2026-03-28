'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Section, MediaAssets, BrandKit } from '@/components/templates/types'
import LeadCaptureClassic from '@/components/templates/LeadCaptureClassic'

interface PageRecord {
  id: string
  slug: string
  client_slug: string | null
  template_slug: string | null
  copy_slots: Record<string, string> | null
  media_assets: Record<string, string> | null
  brand_kit_snapshot: BrandKit | null
  status: string
}

/**
 * Convert flat copy_slots (Record<string, string>) into Section[] for template rendering.
 * Maps t1_* keys into the section structure the LeadCaptureClassic template expects.
 */
function copySlotsToSections(slots: Record<string, string>): Section[] {
  const sections: Section[] = []

  // Hero section
  sections.push({
    type: 'hero',
    headline: slots.t1_headline || slots.hero_headline || 'Welcome',
    subheadline: slots.t1_subheadline || slots.hero_subheadline || '',
    cta: slots.t1_cta || slots.hero_cta || 'Get Started',
    sub_cta: slots.t1_trust_line || slots.trust_line || '',
    show_form: true,
  })

  // Feature cards — look for category/benefit slots
  const featureItems: Array<{ icon?: string; title?: string; text?: string }> = []
  // Try t2 categories or t1 options as feature cards
  for (let i = 1; i <= 6; i++) {
    const title = slots[`feature_${i}_title`] || slots[`t2_categories_${i}`]
    const text = slots[`feature_${i}_text`] || slots[`t2_categories_${i}_desc`]
    if (title) featureItems.push({ title, text: text || '' })
  }
  if (featureItems.length > 0) {
    sections.push({
      type: 'features',
      headline: slots.features_headline || slots.t2_category_headline || 'Why Choose Us',
      items: featureItems,
    })
  }

  // Info / Problem-Solution section
  if (slots.t2_benefits_headline || slots.info_headline || slots.problem_headline) {
    const infoItems: Array<{ title?: string; text?: string }> = []
    for (let i = 1; i <= 4; i++) {
      const title = slots[`benefit_${i}_title`] || slots[`t2_benefits_${i}`]
      const text = slots[`benefit_${i}_text`] || slots[`t2_benefits_${i}_desc`]
      if (title) infoItems.push({ title, text: text || '' })
    }
    sections.push({
      type: 'info',
      headline: slots.info_headline || slots.t2_benefits_headline || slots.problem_headline || '',
      content: slots.info_content || slots.problem_content || '',
      items: infoItems.length > 0 ? infoItems : undefined,
    })
  }

  // Steps section
  const stepItems: Array<{ title?: string; text?: string }> = []
  for (let i = 1; i <= 5; i++) {
    const title = slots[`step_${i}_title`]
    const text = slots[`step_${i}_text`]
    if (title) stepItems.push({ title, text: text || '' })
  }
  if (stepItems.length > 0) {
    sections.push({
      type: 'steps',
      headline: slots.steps_headline || 'How It Works',
      items: stepItems,
    })
  }

  // Trust bar / parallax section
  if (slots.trust_headline || slots.t1_trust_line) {
    sections.push({
      type: 'trust',
      headline: slots.trust_headline || '',
      content: slots.trust_content || slots.t1_trust_line || '',
    })
  }

  // Benefits grid
  const benefitGridItems: Array<{ icon?: string; title?: string; text?: string }> = []
  for (let i = 1; i <= 8; i++) {
    const title = slots[`grid_benefit_${i}_title`]
    const text = slots[`grid_benefit_${i}_text`]
    if (title) benefitGridItems.push({ title, text: text || '' })
  }
  if (benefitGridItems.length > 0) {
    sections.push({
      type: 'benefits',
      headline: slots.benefits_headline || 'Benefits',
      items: benefitGridItems,
    })
  }

  // Testimonials
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

  // FAQ
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

  // Final CTA / Footer
  sections.push({
    type: 'footer',
    headline: slots.t2_final_headline || slots.final_headline || slots.t1_headline || 'Get Started Today',
    cta: slots.t2_final_cta || slots.final_cta || slots.t1_cta || 'Get Started',
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
          .select('id, slug, client_slug, template_slug, copy_slots, media_assets, brand_kit_snapshot, status')
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
    root.style.setProperty('--color-text', bk.text_color || '#1a202c')
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
    document.body.style.color = bk.text_color || '#1a202c'

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

  // Convert flat copy_slots to Section[] for the template
  const copySlots = page.copy_slots || {}
  const sections: Section[] = copySlotsToSections(copySlots)

  // Build media assets
  const media: MediaAssets = {
    hero_image: page.media_assets?.hero_image || undefined,
    parallax_image: page.media_assets?.parallax_image || undefined,
  }

  // Route to the correct template
  const templateSlug = page.template_slug || 'lead-capture-classic'

  switch (templateSlug) {
    case 'lead-capture-classic':
    default:
      return <LeadCaptureClassic sections={sections} media={media} />
  }
}
