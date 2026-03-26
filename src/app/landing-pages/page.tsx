'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { analyzeBrandKit, analyzeCompetitorPages, generatePlaybook, generateConcepts, generateLandingPage, editLandingPageSection } from '@/lib/api'
import { showToast } from '@/lib/demo-toast'
import { supabase } from '@/lib/supabase'
import LogoUpload from '@/components/LogoUpload'
import type { BrandKit, LandingPage, TemplateId } from '@/types/database'

type Stage = 'brand_kit' | 'competitive' | 'playbook' | 'concepts' | 'builder'

const STAGES: { key: Stage; label: string; icon: string; description: string }[] = [
  { key: 'brand_kit', label: 'Brand Kit', icon: '&#127912;', description: 'Extract brand colors, fonts, logo, and visual identity from client website' },
  { key: 'competitive', label: 'Competitive Analysis', icon: '&#128269;', description: 'Analyze competitor landing pages for above-fold patterns and page structure' },
  { key: 'playbook', label: 'Industry Playbook', icon: '&#128218;', description: 'Synthesize competitive data into patterns, gaps, and concept briefs' },
  { key: 'concepts', label: 'Concept Pages', icon: '&#127919;', description: 'AI generates 4 strategic landing page concepts for client to choose from' },
  { key: 'builder', label: 'Page Builder', icon: '&#9889;', description: 'Build, preview, and deploy landing pages with AI-assisted editing' },
]

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        backgroundColor: color,
        border: '1px solid var(--border)',
        flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{color}</div>
      </div>
    </div>
  )
}

export default function LandingPagesPage() {
  const { client, canEdit, refreshClient, competitors, avatars, offers, landingPages, refreshLandingPages } = useAppStore()
  const approvedAvatars = useMemo(() => avatars.filter(a => a.status === 'approved').sort((a, b) => (a.priority || 99) - (b.priority || 99)), [avatars])
  const approvedOffers = useMemo(() => offers.filter(o => o.status === 'approved'), [offers])
  const [activeStage, setActiveStage] = useState<Stage>('brand_kit')
  const [analyzing, setAnalyzing] = useState(false)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showLogoUpload, setShowLogoUpload] = useState(false)
  const [analyzingCompetitors, setAnalyzingCompetitors] = useState(false)
  const [competitorAnalyses, setCompetitorAnalyses] = useState<Array<Record<string, unknown>>>([])
  const [patternSummary, setPatternSummary] = useState('')
  const [opportunities, setOpportunities] = useState<string[]>([])
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false)
  const [generatingConcepts, setGeneratingConcepts] = useState(false)
  // Builder state
  const [selectedAvatarId, setSelectedAvatarId] = useState('')
  const [selectedOfferId, setSelectedOfferId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('clean_authority')
  const [generatingPage, setGeneratingPage] = useState(false)
  const [activePage, setActivePage] = useState<LandingPage | null>(null)
  const [previewSize, setPreviewSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [editingPrompt, setEditingPrompt] = useState('')
  const [editScope, setEditScope] = useState<'section' | 'full_page'>('full_page')
  const [editingSectionId, setEditingSectionId] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [pageSlug, setPageSlug] = useState('')

  // Generate a slug from avatar + offer names
  const generateSlug = useCallback((avatarName: string, offerName: string) => {
    return (avatarName + '-' + offerName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60)
  }, [])

  // Deploy page HTML to Supabase Storage
  const deployPage = useCallback(async (page: LandingPage, slug: string) => {
    if (!client || !page.page_html) return
    setDeploying(true)
    try {
      const clientSlug = client.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const filePath = `${client.id}/pages/${slug}.html`

      // Upload HTML to Supabase Storage
      const htmlBlob = new Blob([page.page_html], { type: 'text/html' })
      const { error: uploadErr } = await supabase.storage
        .from('client-assets')
        .upload(filePath, htmlBlob, { cacheControl: '60', upsert: true, contentType: 'text/html' })

      if (uploadErr) throw uploadErr

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('client-assets')
        .getPublicUrl(filePath)

      const deployedUrl = urlData.publicUrl

      // Update the landing page record
      const { error: updateErr } = await supabase
        .from('landing_pages')
        .update({ deployed_url: deployedUrl, deploy_status: 'deployed' })
        .eq('id', page.id)

      if (updateErr) throw updateErr

      // Update local state
      setActivePage({ ...page, deployed_url: deployedUrl, deploy_status: 'deployed' })
      refreshLandingPages(client.id)
      showToast('Page deployed! URL copied to clipboard.')
      navigator.clipboard.writeText(deployedUrl).catch(() => {})
    } catch (err) {
      showToast('Deploy failed: ' + (err as Error).message)
    } finally {
      setDeploying(false)
    }
  }, [client, refreshLandingPages])

  // Get competitor intel with websites (for competitive analysis stage)
  const competitorsWithSites = competitors.filter(c => c.competitor_website)
  const uniqueCompetitorSites = [...new Map(competitorsWithSites.map(c => [c.competitor_website, c])).values()]
  // Get landing page analyses already done
  const landingPageAnalyses = competitors.filter(c => c.ad_type === 'landing_page' && c.source === 'ai_discovery')

  // Playbook and concepts from client data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playbook = (client?.landing_page_playbook || null) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const concepts = (client?.landing_page_concepts || null) as any[] | null

  // Requirements check
  const hasBrandKit = !!client?.brand_kit
  const hasCompetitorAnalysis = landingPageAnalyses.length > 0 || competitorAnalyses.length > 0
  const hasPlaybook = !!playbook
  const hasConcepts = !!concepts && concepts.length > 0

  // Load brand kit and logo from client data if available
  useEffect(() => {
    if (client?.brand_kit) {
      setBrandKit(client.brand_kit)
    } else {
      setBrandKit(null)
    }
    setLogoUrl(client?.logo_url || null)
  }, [client])

  const handleLogoUploaded = useCallback((url: string) => {
    setLogoUrl(url)
    setShowLogoUpload(false)
    // Refresh client in store so logo persists across navigation
    if (client?.id) refreshClient(client.id)
  }, [client?.id, refreshClient])

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128196;</div>
        <div className="empty-state-text">No client selected</div>
        <div className="empty-state-sub">Select or create a client first.</div>
      </div>
    )
  }

  async function handleAnalyzeBrandKit() {
    if (!client) return
    setAnalyzing(true)
    try {
      const result = await analyzeBrandKit(client.id)
      console.log('[Brand Kit] Analysis result:', result)
      if (result.brand_kit) {
        setBrandKit(result.brand_kit)
        // Refresh client in store so brand kit persists across navigation
        await refreshClient(client.id)
        showToast('Brand kit analysis complete!')
      } else {
        console.warn('[Brand Kit] No brand_kit in response:', result)
        showToast('Analysis completed but no brand data returned. Check console for details.')
      }
    } catch (err) {
      console.error('[Brand Kit] Analysis failed:', err)
      showToast('Brand kit analysis failed: ' + (err as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Landing Pages</h1>
          <p className="page-subtitle">
            AI-powered landing page builder: from competitive research to deployed pages
          </p>
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="lp-pipeline">
        {STAGES.map((stage, i) => {
          const isActive = activeStage === stage.key
          // Determine if each stage is complete based on actual data
          const isComplete = (stage.key === 'brand_kit' && hasBrandKit)
            || (stage.key === 'competitive' && hasCompetitorAnalysis)
            || (stage.key === 'playbook' && hasPlaybook)
            || (stage.key === 'concepts' && hasConcepts)
          return (
            <button
              key={stage.key}
              className={`lp-stage ${isActive ? 'lp-stage-active' : ''} ${isComplete ? 'lp-stage-complete' : ''}`}
              onClick={() => setActiveStage(stage.key)}
            >
              <span className={`lp-stage-check ${isComplete ? 'lp-stage-check-done' : ''}`}>✓</span>
              <span className="lp-stage-label">{stage.label}</span>
            </button>
          )
        })}
      </div>

      {/* Stage Content */}
      <div className="funnel-section-card" style={{ marginTop: 24 }}>
        <div className="funnel-section-header">
          <h3 dangerouslySetInnerHTML={{ __html: `${STAGES.find(s => s.key === activeStage)?.icon || ''} ${STAGES.find(s => s.key === activeStage)?.label}` }} />
        </div>

        {activeStage === 'brand_kit' && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              The brand kit captures your client&apos;s visual identity: colors, fonts, logo, button styles, and more.
              AI analyzes the client&apos;s website to extract these automatically, then the team reviews and adjusts.
            </p>

            {analyzing && (
              <div style={{
                padding: 40, textAlign: 'center',
                background: 'var(--bg-hover)', borderRadius: 8, marginBottom: 20,
              }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>&#9881;&#65039;</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Analyzing {client.website || 'website'}...</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  AI is visiting the website and extracting brand colors, fonts, and visual identity. This may take 15-30 seconds.
                </div>
              </div>
            )}

            {/* Logo Card (always visible) */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">Logo</div>
              <div className="card-body">
                {canEdit ? (
                  <LogoUpload
                    clientId={client.id}
                    currentLogoUrl={logoUrl}
                    onUploadComplete={handleLogoUploaded}
                  />
                ) : logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logoUrl} alt="Client logo" style={{ maxHeight: 100, objectFit: 'contain' }} />
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>No logo uploaded yet</div>
                )}
              </div>
            </div>

            {brandKit ? (
              <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="card">
                  <div className="card-title">Colors</div>
                  <div className="card-body">
                    {brandKit.colors?.primary_color && <ColorSwatch color={brandKit.colors.primary_color} label="Primary" />}
                    {brandKit.colors?.secondary_color && <ColorSwatch color={brandKit.colors.secondary_color} label="Secondary" />}
                    {brandKit.colors?.accent_color && <ColorSwatch color={brandKit.colors.accent_color} label="Accent / CTA" />}
                    {brandKit.colors?.background_color && <ColorSwatch color={brandKit.colors.background_color} label="Background" />}
                    {brandKit.colors?.text_color && <ColorSwatch color={brandKit.colors.text_color} label="Text" />}
                    {brandKit.colors?.additional_colors?.map((c, i) => (
                      <ColorSwatch key={i} color={c} label={`Additional ${i + 1}`} />
                    ))}
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Typography</div>
                  <div className="card-body">
                    {brandKit.typography?.heading_font && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Heading Font</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{brandKit.typography.heading_font}</div>
                      </div>
                    )}
                    {brandKit.typography?.body_font && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Body Font</div>
                        <div style={{ fontSize: 14 }}>{brandKit.typography.body_font}</div>
                      </div>
                    )}
                    {brandKit.typography?.font_style_notes && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                        {brandKit.typography.font_style_notes}
                      </div>
                    )}
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Button Style</div>
                  <div className="card-body">
                    {brandKit.button_style ? (
                      <>
                        <div style={{
                          display: 'inline-block',
                          padding: '8px 20px',
                          borderRadius: brandKit.button_style.shape === 'pill' ? 50 : brandKit.button_style.shape === 'square' ? 0 : 6,
                          backgroundColor: brandKit.button_style.color || 'var(--accent)',
                          color: brandKit.button_style.text_color || '#fff',
                          fontSize: 13, fontWeight: 600, marginBottom: 12,
                        }}>
                          Sample Button
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          Shape: {brandKit.button_style.shape || 'rounded'}
                          {brandKit.button_style.style_notes && ` · ${brandKit.button_style.style_notes}`}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>No button style defined yet</div>
                    )}
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Visual Identity</div>
                  <div className="card-body">
                    {brandKit.visual_identity ? (
                      <>
                        {brandKit.visual_identity.overall_style && (
                          <div style={{ marginBottom: 6 }}>
                            <span className="tag">{brandKit.visual_identity.overall_style}</span>
                            {brandKit.visual_identity.brand_mood && (
                              <span className="tag" style={{ marginLeft: 4 }}>{brandKit.visual_identity.brand_mood}</span>
                            )}
                          </div>
                        )}
                        {brandKit.visual_identity.imagery_style && (
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Imagery: {brandKit.visual_identity.imagery_style}
                          </div>
                        )}
                        {brandKit.visual_identity.layout_pattern && (
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Layout: {brandKit.visual_identity.layout_pattern}
                          </div>
                        )}
                        {brandKit.visual_identity.whitespace && (
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Whitespace: {brandKit.visual_identity.whitespace}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>No visual identity data yet</div>
                    )}
                  </div>
                </div>
              </div>
            ) : !analyzing ? (
              <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="card">
                  <div className="card-title">Colors</div>
                  <div className="card-body" style={{ color: 'var(--text-muted)' }}>
                    No brand colors extracted yet
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Typography</div>
                  <div className="card-body" style={{ color: 'var(--text-muted)' }}>
                    No fonts detected yet
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Button Style</div>
                  <div className="card-body" style={{ color: 'var(--text-muted)' }}>
                    No button style defined yet
                  </div>
                </div>
              </div>
            ) : null}

            {canEdit && (
              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyzeBrandKit}
                  disabled={analyzing}
                >
                  {analyzing ? 'Analyzing...' : brandKit ? 'Re-analyze Website' : 'Analyze Website for Brand Kit'}
                </button>
              </div>
            )}

            {client.website && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                Website: {client.website}
              </div>
            )}
          </div>
        )}

        {activeStage === 'competitive' && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              Analyze competitor landing pages to understand above-fold patterns, page structure, offer presentation,
              and conversion tactics used in your client&apos;s industry.
            </p>

            {/* Show competitors available for analysis */}
            {uniqueCompetitorSites.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Competitors with Websites ({uniqueCompetitorSites.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {uniqueCompetitorSites.map((c, i) => (
                    <span key={i} className="tag" style={{ fontSize: 12 }}>
                      {c.competitor_name}: {c.competitor_website}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analyzingCompetitors && (
              <div style={{
                padding: 40, textAlign: 'center',
                background: 'var(--bg-hover)', borderRadius: 8, marginBottom: 20,
              }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>&#128269;</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Analyzing {uniqueCompetitorSites.length} competitor pages...</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  AI is visiting competitor websites, analyzing above-fold patterns, page structure, and conversion tactics. This may take 30-60 seconds.
                </div>
              </div>
            )}

            {/* Show existing analyses */}
            {(landingPageAnalyses.length > 0 || competitorAnalyses.length > 0) && (
              <div>
                {patternSummary && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Pattern Summary</div>
                    <div className="card-body" style={{ fontSize: 14, lineHeight: 1.6 }}>{patternSummary}</div>
                  </div>
                )}
                {opportunities.length > 0 && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Strategic Opportunities</div>
                    <div className="card-body">
                      {opportunities.map((opp, i) => (
                        <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: i < opportunities.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          {i + 1}. {opp}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {(competitorAnalyses.length > 0 ? competitorAnalyses : landingPageAnalyses.map(lp => {
                    try {
                      const content = typeof lp.content === 'string' ? JSON.parse(lp.content) : lp.content
                      const notes = typeof lp.notes === 'string' ? JSON.parse(lp.notes) : lp.notes
                      return {
                        competitor_name: lp.competitor_name,
                        website: lp.competitor_website,
                        above_fold: content?.above_fold,
                        page_structure: content?.page_structure,
                        offer_analysis: content?.offer_analysis,
                        conversion_tactics: content?.conversion_tactics,
                        strategic_notes: notes,
                      }
                    } catch { return { competitor_name: lp.competitor_name, website: lp.competitor_website } }
                  })).map((analysis: Record<string, unknown>, i: number) => {
                    const af = (analysis.above_fold || {}) as Record<string, string>
                    const ps = (analysis.page_structure || {}) as Record<string, string | string[]>
                    const oa = (analysis.offer_analysis || {}) as Record<string, string>
                    const sn = (analysis.strategic_notes || {}) as Record<string, unknown>
                    const hasAboveFold = !!analysis.above_fold
                    const hasOffer = !!analysis.offer_analysis
                    const hasStructure = !!analysis.page_structure
                    const hasNotes = !!analysis.strategic_notes
                    return (
                      <div key={i} className="card">
                        <div className="card-title">{String(analysis.competitor_name || 'Competitor')}</div>
                        <div className="card-meta" style={{ marginBottom: 8 }}>{String(analysis.website || '')}</div>
                        <div className="card-body" style={{ fontSize: 13 }}>
                          {hasAboveFold && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>Above the Fold</div>
                              {af.headline && <div>Headline: &quot;{af.headline}&quot;</div>}
                              {af.cta_text && <div>CTA: &quot;{af.cta_text}&quot;</div>}
                              {af.hero_type && <div>Hero: {af.hero_type}</div>}
                            </div>
                          )}
                          {hasOffer && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>Offer</div>
                              {oa.primary_offer && <div>{oa.primary_offer}</div>}
                              {oa.offer_type && <span className="tag">{oa.offer_type}</span>}
                            </div>
                          )}
                          {hasStructure && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>Structure</div>
                              {Array.isArray(ps.sections) && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {(ps.sections as string[]).map((s: string, j: number) => (
                                    <span key={j} className="tag" style={{ fontSize: 10 }}>{s}</span>
                                  ))}
                                </div>
                              )}
                              {ps.estimated_length && <div style={{ marginTop: 4 }}>Length: {ps.estimated_length as string}</div>}
                            </div>
                          )}
                          {hasNotes && (
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>Strategic Notes</div>
                              {Array.isArray(sn.strengths) && (
                                <div style={{ marginBottom: 4 }}>
                                  <span style={{ color: '#10b981' }}>Strengths:</span> {(sn.strengths as string[]).join('. ')}
                                </div>
                              )}
                              {Array.isArray(sn.weaknesses) && (
                                <div>
                                  <span style={{ color: '#ef4444' }}>Weaknesses:</span> {(sn.weaknesses as string[]).join('. ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {landingPageAnalyses.length === 0 && competitorAnalyses.length === 0 && !analyzingCompetitors && uniqueCompetitorSites.length === 0 && (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">&#128269;</div>
                <div className="empty-state-text">No competitor pages to analyze</div>
                <div className="empty-state-sub">
                  Add competitor websites in the Competitive Intel section first, then come back to analyze their landing pages.
                </div>
              </div>
            )}

            {canEdit && uniqueCompetitorSites.length > 0 && !analyzingCompetitors && (
              <div style={{ marginTop: 20 }}>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!client) return
                    setAnalyzingCompetitors(true)
                    try {
                      const result = await analyzeCompetitorPages(client.id)
                      if (result.analyses) {
                        setCompetitorAnalyses(result.analyses)
                        setPatternSummary(result.pattern_summary || '')
                        setOpportunities(result.opportunities || [])
                        showToast(`Analyzed ${result.analyses_added} competitor pages!`)
                      }
                    } catch (err) {
                      showToast('Analysis failed: ' + (err as Error).message)
                    } finally {
                      setAnalyzingCompetitors(false)
                    }
                  }}
                >
                  {landingPageAnalyses.length > 0 ? 'Re-analyze Competitor Pages' : `Analyze ${uniqueCompetitorSites.length} Competitor Pages`}
                </button>
              </div>
            )}
          </div>
        )}

        {activeStage === 'playbook' && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              The industry playbook synthesizes all competitive intelligence into actionable insights:
              common patterns, market gaps, disconnects between ads and landing pages, and strategic concept briefs.
            </p>

            {/* Requirements checklist */}
            <div className="card" style={{ marginBottom: 20, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>Requirements</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, color: hasBrandKit ? 'var(--success)' : 'var(--text-muted)' }}>
                  {hasBrandKit ? '\u2713' : '\u2717'} Brand Kit analyzed
                  {!hasBrandKit && <span style={{ fontSize: 11, marginLeft: 8 }}>&mdash; <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setActiveStage('brand_kit')}>Go to Brand Kit</button></span>}
                </div>
                <div style={{ fontSize: 13, color: hasCompetitorAnalysis ? 'var(--success)' : 'var(--text-muted)' }}>
                  {hasCompetitorAnalysis ? '\u2713' : '\u2717'} Competitive analysis completed ({landingPageAnalyses.length + competitorAnalyses.length} pages)
                  {!hasCompetitorAnalysis && <span style={{ fontSize: 11, marginLeft: 8 }}>&mdash; <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setActiveStage('competitive')}>Go to Analysis</button></span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {client?.business_summary ? '\u2713' : '\u2717'} Business overview data
                  {!client?.business_summary && <span style={{ fontSize: 11, marginLeft: 8 }}>&mdash; Complete Business Overview first</span>}
                </div>
              </div>
            </div>

            {generatingPlaybook && (
              <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 8, marginBottom: 20 }}>
                <div className="generating-spinner" style={{ width: 30, height: 30, margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Generating Industry Playbook...</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  AI is synthesizing competitor data, market patterns, and strategic opportunities. This takes 30-60 seconds.
                </div>
              </div>
            )}

            {hasPlaybook && playbook ? (
              <div>
                {/* Industry Patterns */}
                {playbook.industry_patterns && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Industry Patterns</div>
                    <div className="card-body" style={{ fontSize: 13 }}>
                      {Object.entries(playbook.industry_patterns as Record<string, string[]>).map(([key, items]) => (
                        <div key={key} style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent)', textTransform: 'capitalize' }}>
                            {key.replace(/_/g, ' ')}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {(items || []).map((item, j) => (
                              <span key={j} className="tag" style={{ fontSize: 11 }}>{item}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Market Gaps */}
                {Array.isArray(playbook.market_gaps) && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Market Gaps &amp; Opportunities</div>
                    <div className="card-body">
                      {(playbook.market_gaps as Array<Record<string, string>>).map((gap, i) => (
                        <div key={i} style={{ padding: '8px 0', borderBottom: i < (playbook.market_gaps as Array<unknown>).length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>{gap.gap}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{gap.opportunity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strategic Recommendations */}
                {Array.isArray(playbook.strategic_recommendations) && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Strategic Recommendations</div>
                    <div className="card-body">
                      {(playbook.strategic_recommendations as Array<Record<string, string>>).map((rec, i) => (
                        <div key={i} style={{ padding: '8px 0', borderBottom: i < (playbook.strategic_recommendations as Array<unknown>).length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="tag" style={{ fontSize: 10, background: rec.priority === 'high' ? 'var(--danger-muted)' : rec.priority === 'medium' ? 'var(--warning-muted)' : 'var(--bg-card)' }}>
                              {rec.priority}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{rec.recommendation}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, marginLeft: 52 }}>{rec.rationale}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Copy Direction */}
                {playbook.copy_direction && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Copy Direction</div>
                    <div className="card-body" style={{ fontSize: 13 }}>
                      {Object.entries(playbook.copy_direction as Record<string, unknown>).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--accent)', textTransform: 'capitalize' }}>
                            {key.replace(/_/g, ' ')}
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {Array.isArray(value) ? (value as string[]).join(' \u2022 ') : String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Concept Briefs Preview */}
                {Array.isArray(playbook.concept_briefs) && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Concept Briefs (4 strategic directions)</div>
                    <div className="card-body">
                      {(playbook.concept_briefs as Array<Record<string, unknown>>).map((brief, i) => (
                        <div key={i} style={{ padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{String(brief.name)}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{String(brief.strategy)}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Above fold: {String(brief.above_fold)} &bull; Tone: {String(brief.tone)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : !generatingPlaybook ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">&#128218;</div>
                <div className="empty-state-text">No playbook generated yet</div>
                <div className="empty-state-sub">
                  {!hasCompetitorAnalysis
                    ? 'Complete competitive analysis first, then generate the playbook.'
                    : 'Ready to generate! Click below to synthesize competitive data into an actionable playbook.'}
                </div>
              </div>
            ) : null}

            {canEdit && !generatingPlaybook && (
              <div style={{ marginTop: 20 }}>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!client) return
                    setGeneratingPlaybook(true)
                    try {
                      const result = await generatePlaybook(client.id)
                      if (result.playbook) {
                        await refreshClient(client.id)
                        showToast('Industry playbook generated!')
                      }
                    } catch (err) {
                      showToast('Playbook generation failed: ' + (err as Error).message)
                    } finally {
                      setGeneratingPlaybook(false)
                    }
                  }}
                  disabled={!hasCompetitorAnalysis && !client?.business_summary}
                >
                  {hasPlaybook ? 'Regenerate Playbook' : 'Generate Industry Playbook'}
                </button>
                {!hasCompetitorAnalysis && !client?.business_summary && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    Requires at least competitive analysis or business overview data.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeStage === 'concepts' && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              AI generates 4 strategically unique landing page concepts based on the playbook and brand kit.
              Each concept takes a different strategic approach. The client selects their preferred direction.
            </p>

            {/* Requirements */}
            {!hasPlaybook && (
              <div className="card" style={{ marginBottom: 20, padding: 16, borderLeft: '3px solid var(--warning)' }}>
                <div style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 600, marginBottom: 4 }}>Playbook Required</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Generate the Industry Playbook first — it provides the strategic briefs that concepts are built from.
                  <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }} onClick={() => setActiveStage('playbook')}>Go to Playbook</button>
                </div>
              </div>
            )}

            {generatingConcepts && (
              <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 8, marginBottom: 20 }}>
                <div className="generating-spinner" style={{ width: 30, height: 30, margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Generating 4 Concept Pages...</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  AI is creating strategic landing page concepts from the playbook. This takes 30-60 seconds.
                </div>
              </div>
            )}

            {/* Show concept briefs from playbook as the concept cards */}
            <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {(hasPlaybook && Array.isArray(playbook.concept_briefs) ? (playbook.concept_briefs as Array<Record<string, unknown>>) : [
                { name: '1A: Proven Pattern, Clean', strategy: 'Dominant market formula, executed sharper' },
                { name: '1B: Proven Pattern, Bold', strategy: 'Same strategy, bolder visual and urgency' },
                { name: '2: Gap Play', strategy: 'Exploits biggest gap competitors miss' },
                { name: '3: Aggressive DR', strategy: 'Pure conversion machine, max CTAs' },
              ]).map((concept, i) => (
                <div key={i} className="card" style={{ opacity: hasPlaybook ? 1 : 0.5 }}>
                  <div className="card-title">{String(concept.name)}</div>
                  <div className="card-meta" style={{ marginBottom: 8 }}>{String(concept.strategy || '')}</div>
                  <div className="card-body" style={{ fontSize: 13 }}>
                    {hasPlaybook ? (
                      <>
                        {concept.above_fold && <div style={{ marginBottom: 6 }}><strong style={{ color: 'var(--accent)' }}>Above Fold:</strong> {String(concept.above_fold)}</div>}
                        {Array.isArray(concept.key_sections) && (
                          <div style={{ marginBottom: 6 }}>
                            <strong style={{ color: 'var(--accent)' }}>Sections:</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {(concept.key_sections as string[]).map((s, j) => (
                                <span key={j} className="tag" style={{ fontSize: 10 }}>{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {concept.tone && <div style={{ marginBottom: 4 }}><strong style={{ color: 'var(--accent)' }}>Tone:</strong> {String(concept.tone)}</div>}
                        {concept.differentiator && <div><strong style={{ color: 'var(--accent)' }}>Differentiator:</strong> {String(concept.differentiator)}</div>}
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>Generate playbook to populate concept details</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {canEdit && hasPlaybook && !generatingConcepts && (
              <div style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                Concept briefs auto-populated from playbook. The Page Builder stage will use these to create actual pages.
              </div>
            )}
          </div>
        )}

        {activeStage === 'builder' && (
          <div style={{ padding: 24 }}>
            {/* If editing an active page, show the builder */}
            {activePage ? (
              <div className="lp-builder">
                {/* Builder header */}
                <div className="lp-builder-header">
                  <button className="btn btn-secondary btn-sm" onClick={() => setActivePage(null)}>
                    &larr; Back to Pages
                  </button>
                  <div className="lp-builder-meta">
                    <span className="tag">{approvedAvatars.find(a => a.id === activePage.avatar_id)?.name || 'Avatar'}</span>
                    <span className="tag">{approvedOffers.find(o => o.id === activePage.offer_id)?.name || 'Offer'}</span>
                    <span className="tag">{activePage.template_id?.replace(/_/g, ' ') || 'Template'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className={`btn btn-sm ${showEditModal ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowEditModal(!showEditModal)}>
                      &#9998; AI Edit
                    </button>
                    {activePage.page_html && (
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        const w = window.open('', '_blank')
                        if (w) { w.document.write(activePage.page_html!); w.document.close() }
                      }}>
                        Preview
                      </button>
                    )}
                  </div>
                </div>

                {/* Deploy Bar */}
                <div className="lp-deploy-bar">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>SLUG:</label>
                    <input
                      type="text"
                      className="input"
                      value={pageSlug || generateSlug(
                        approvedAvatars.find(a => a.id === activePage.avatar_id)?.name || 'page',
                        approvedOffers.find(o => o.id === activePage.offer_id)?.name || 'offer'
                      )}
                      onChange={e => setPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      style={{ width: 200, fontSize: 13, padding: '4px 8px' }}
                      placeholder="page-slug"
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>.html</span>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={deploying}
                      onClick={() => {
                        const slug = pageSlug || generateSlug(
                          approvedAvatars.find(a => a.id === activePage.avatar_id)?.name || 'page',
                          approvedOffers.find(o => o.id === activePage.offer_id)?.name || 'offer'
                        )
                        deployPage(activePage, slug)
                      }}
                    >
                      {deploying ? 'Deploying...' : activePage.deploy_status === 'deployed' ? 'Re-deploy' : 'Deploy Page'}
                    </button>
                  </div>
                  {activePage.deployed_url && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: activePage.deployed_url ? 0 : undefined }}>
                      <span className="tag" style={{ background: 'var(--success-muted)', color: 'var(--success)', fontSize: 11 }}>LIVE</span>
                      <a
                        href={activePage.deployed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}
                      >
                        {activePage.deployed_url}
                      </a>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => {
                          navigator.clipboard.writeText(activePage.deployed_url!)
                          showToast('URL copied!')
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Edit Panel */}
                {showEditModal && (
                  <div className="lp-edit-panel">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input type="radio" checked={editScope === 'full_page'} onChange={() => setEditScope('full_page')} />
                        Edit full page
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input type="radio" checked={editScope === 'section'} onChange={() => setEditScope('section')} />
                        Edit section:
                      </label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {editScope === 'section' && activePage.section_data && (
                        <select className="select" style={{ fontSize: 12, padding: '4px 8px' }} value={editingSectionId} onChange={e => setEditingSectionId(e.target.value)}>
                          <option value="">Select section...</option>
                          {((activePage.section_data || []) as any[]).map((s: any) => (
                            <option key={s.id} value={s.id}>{String(s.type || '').replace(/_/g, ' ')} ({s.id})</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        className="textarea"
                        placeholder="Describe what you want to change... e.g. 'Make the headline more urgent' or 'Add a money-back guarantee to the proof section'"
                        value={editingPrompt}
                        onChange={e => setEditingPrompt(e.target.value)}
                        rows={2}
                        style={{ flex: 1, fontSize: 13 }}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={isEditing || !editingPrompt.trim() || (editScope === 'section' && !editingSectionId)}
                        onClick={async () => {
                          if (!activePage) return
                          setIsEditing(true)
                          try {
                            const result = await editLandingPageSection(
                              activePage.id,
                              editingPrompt,
                              editScope,
                              editScope === 'section' ? editingSectionId : undefined
                            )
                            if (result.landing_page) {
                              setActivePage(result.landing_page)
                              if (client?.id) refreshLandingPages(client.id)
                              showToast('Page updated!')
                              setEditingPrompt('')
                            }
                          } catch (err) {
                            showToast('Edit failed: ' + (err as Error).message)
                          } finally {
                            setIsEditing(false)
                          }
                        }}
                      >
                        {isEditing ? 'Editing...' : 'Apply'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Section List + Preview */}
                <div className="lp-builder-layout">
                  {/* Left: Section list */}
                  <div className="lp-builder-sections">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
                      Sections ({((activePage.section_data || []) as unknown[]).length})
                    </div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {((activePage.section_data || []) as any[])
                      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                      .map((section: any) => (
                        <div key={section.id} className="lp-section-card">
                          <div className="lp-section-type">{String(section.type || '').replace(/_/g, ' ')}</div>
                          <div className="lp-section-preview">
                            {section.content?.headline && String(section.content.headline)}
                            {section.content?.text && String(section.content.text).substring(0, 60) + '...'}
                            {section.content?.content && String(section.content.content).substring(0, 60) + '...'}
                            {section.content?.items && `${(section.content.items as unknown[]).length} items`}
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '2px 6px' }}
                            onClick={() => {
                              setEditScope('section')
                              setEditingSectionId(section.id)
                              setShowEditModal(true)
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Right: Preview */}
                  <div className="lp-builder-preview">
                    <div className="lp-preview-controls">
                      <button className={`btn btn-sm ${previewSize === 'desktop' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPreviewSize('desktop')}>Desktop</button>
                      <button className={`btn btn-sm ${previewSize === 'tablet' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPreviewSize('tablet')}>Tablet</button>
                      <button className={`btn btn-sm ${previewSize === 'mobile' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPreviewSize('mobile')}>Mobile</button>
                    </div>
                    <div className="lp-preview-frame" style={{
                      maxWidth: previewSize === 'mobile' ? 375 : previewSize === 'tablet' ? 768 : '100%',
                      margin: previewSize !== 'desktop' ? '0 auto' : undefined,
                    }}>
                      {activePage.page_html ? (
                        <iframe
                          srcDoc={activePage.page_html}
                          title="Landing Page Preview"
                          className="lp-preview-iframe"
                        />
                      ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                          No HTML preview available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Page list if any exist */}
                {landingPages.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                      Built Pages ({landingPages.length})
                    </div>
                    <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                      {landingPages.map(page => (
                        <div key={page.id} className="card lp-page-card" onClick={() => setActivePage(page)} style={{ cursor: 'pointer' }}>
                          <div className="card-title" style={{ fontSize: 13 }}>
                            {approvedAvatars.find(a => a.id === page.avatar_id)?.name || 'Unknown Avatar'}
                          </div>
                          <div className="card-meta">
                            {approvedOffers.find(o => o.id === page.offer_id)?.name || 'Unknown Offer'}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <span className="tag" style={{ fontSize: 10 }}>{page.template_id?.replace(/_/g, ' ') || 'template'}</span>
                            <span className="tag" style={{ fontSize: 10, background: page.deploy_status === 'deployed' ? 'var(--success-muted)' : 'var(--bg-hover)' }}>
                              {page.deploy_status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New page generator */}
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-title" style={{ marginBottom: 16 }}>Build New Landing Page</div>

                  {approvedAvatars.length === 0 || approvedOffers.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      You need at least one approved Avatar and one approved Offer to build a landing page.
                      Go to the Avatars and Offers pages to review and approve them.
                    </div>
                  ) : (
                    <>
                      <div className="lp-build-form">
                        <div className="lp-build-row">
                          <label className="lp-build-label">Avatar</label>
                          <select className="select" value={selectedAvatarId} onChange={e => setSelectedAvatarId(e.target.value)}>
                            <option value="">Select avatar...</option>
                            {approvedAvatars.map((a, i) => (
                              <option key={a.id} value={a.id}>{i + 1}. {a.priority === 1 ? '★ ' : ''}{a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="lp-build-row">
                          <label className="lp-build-label">Offer</label>
                          <select className="select" value={selectedOfferId} onChange={e => setSelectedOfferId(e.target.value)}>
                            <option value="">Select offer...</option>
                            {approvedOffers.map(o => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="lp-build-row">
                          <label className="lp-build-label">Template</label>
                          <div className="lp-template-grid">
                            {([
                              { id: 'clean_authority' as TemplateId, name: 'Clean Authority', desc: 'Professional, generous whitespace, single-column flow' },
                              { id: 'bold_conversion' as TemplateId, name: 'Bold Conversion', desc: 'Full-bleed sections, urgency elements, strong contrast' },
                              { id: 'gap_play' as TemplateId, name: 'Gap Play', desc: 'Story-driven, comparison tables, editorial feel' },
                              { id: 'aggressive_dr' as TemplateId, name: 'Aggressive DR', desc: 'Maximum density, CTAs throughout, multi-proof' },
                            ]).map(tmpl => (
                              <button
                                key={tmpl.id}
                                className={`lp-template-option ${selectedTemplateId === tmpl.id ? 'lp-template-selected' : ''}`}
                                onClick={() => setSelectedTemplateId(tmpl.id)}
                              >
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{tmpl.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{tmpl.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {generatingPage && (
                        <div style={{ padding: 30, textAlign: 'center', background: 'var(--bg-hover)', borderRadius: 8, marginTop: 16 }}>
                          <div className="generating-spinner" style={{ width: 30, height: 30, margin: '0 auto 12px' }} />
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Building Landing Page...</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            AI is generating section content and rendering the page with your brand kit. This takes 30-60 seconds.
                          </div>
                        </div>
                      )}

                      {canEdit && !generatingPage && (
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: 16 }}
                          disabled={!selectedAvatarId || !selectedOfferId}
                          onClick={async () => {
                            if (!client) return
                            setGeneratingPage(true)
                            try {
                              const result = await generateLandingPage(
                                client.id,
                                selectedAvatarId,
                                selectedOfferId,
                                selectedTemplateId
                              )
                              if (result.landing_page) {
                                setActivePage(result.landing_page)
                                await refreshLandingPages(client.id)
                                showToast('Landing page generated!')
                              }
                            } catch (err) {
                              showToast('Generation failed: ' + (err as Error).message)
                            } finally {
                              setGeneratingPage(false)
                            }
                          }}
                        >
                          Generate Landing Page
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pipeline Info */}
      <div style={{ marginTop: 24, padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Landing Page Pipeline:</strong> Brand Kit &rarr; Competitive Analysis &rarr; Industry Playbook &rarr; 4 Concept Pages &rarr; Client Selects Direction &rarr; Build Pages per Avatar+Offer &rarr; Deploy to Cloudways
        </div>
      </div>
    </div>
  )
}
