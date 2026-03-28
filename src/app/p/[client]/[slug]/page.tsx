'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Section, MediaAssets, BrandKit } from '@/components/templates/types'
import LeadCaptureClassic from '@/components/templates/LeadCaptureClassic'

interface PageRecord {
  id: string
  slug: string
  template_id: string
  copy_slots: Section[]
  media_assets: MediaAssets
  brand_kit_snapshot: BrandKit
  deploy_status: string
  page_templates?: {
    slug: string
    name: string
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
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
        // First find the client by matching slugified name
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')

        if (!clients || clients.length === 0) {
          setNotFound(true)
          setLoading(false)
          return
        }

        const client = clients.find(
          (c: { id: string; name: string }) => slugify(c.name) === clientSlug
        )

        if (!client) {
          setNotFound(true)
          setLoading(false)
          return
        }

        // Now fetch the published page
        const { data: pages, error } = await supabase
          .from('published_pages')
          .select('id, slug, template_id, copy_slots, media_assets, brand_kit_snapshot, deploy_status, page_templates(slug, name)')
          .eq('client_id', client.id)
          .eq('slug', pageSlug)
          .eq('deploy_status', 'published')
          .limit(1)

        if (error || !pages || pages.length === 0) {
          setNotFound(true)
          setLoading(false)
          return
        }

        setPage(pages[0] as unknown as PageRecord)
      } catch {
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
      // Clean up on unmount
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

  const sections: Section[] = Array.isArray(page.copy_slots) ? page.copy_slots : []
  const media: MediaAssets = page.media_assets || {}

  // Route to the correct template based on template slug
  const templateSlug = page.page_templates?.slug || 'lead-capture-classic'

  // For now, only LeadCaptureClassic is available
  // Future: switch on templateSlug to render different templates
  switch (templateSlug) {
    case 'lead-capture-classic':
    default:
      return <LeadCaptureClassic sections={sections} media={media} />
  }
}
