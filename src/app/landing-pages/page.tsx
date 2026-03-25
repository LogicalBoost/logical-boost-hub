'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { analyzeBrandKit } from '@/lib/api'
import { showToast } from '@/lib/demo-toast'
import LogoUpload from '@/components/LogoUpload'
import type { BrandKit } from '@/types/database'

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
  const { client, canEdit } = useAppStore()
  const [activeStage, setActiveStage] = useState<Stage>('brand_kit')
  const [analyzing, setAnalyzing] = useState(false)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showLogoUpload, setShowLogoUpload] = useState(false)

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
  }, [])

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
      if (result.brand_kit) {
        setBrandKit(result.brand_kit)
        showToast('Brand kit analysis complete!')
      } else {
        showToast('Analysis completed but no brand data returned')
      }
    } catch (err) {
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
          const stageIndex = STAGES.findIndex(s => s.key === activeStage)
          const isPast = i < stageIndex
          return (
            <button
              key={stage.key}
              className={`lp-stage ${isActive ? 'lp-stage-active' : ''} ${isPast ? 'lp-stage-complete' : ''}`}
              onClick={() => setActiveStage(stage.key)}
            >
              <span className="lp-stage-number">{isPast ? '&#10003;' : i + 1}</span>
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
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">&#128269;</div>
              <div className="empty-state-text">No competitor pages analyzed yet</div>
              <div className="empty-state-sub">
                Add competitor landing page URLs in Competitive Intel, then analyze them here.
              </div>
              {canEdit && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} disabled>
                  Analyze Competitor Pages
                </button>
              )}
            </div>
          </div>
        )}

        {activeStage === 'playbook' && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              The industry playbook synthesizes all competitive intelligence into actionable insights:
              common patterns, market gaps, disconnects between ads and landing pages, and strategic concept briefs.
            </p>
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">&#128218;</div>
              <div className="empty-state-text">No playbook generated yet</div>
              <div className="empty-state-sub">
                Complete competitive analysis first, then generate the playbook.
              </div>
              {canEdit && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} disabled>
                  Generate Industry Playbook
                </button>
              )}
            </div>
          </div>
        )}

        {activeStage === 'concepts' && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              AI generates 4 strategically unique landing page concepts based on the playbook and brand kit.
              Each concept takes a different strategic approach. The client selects their preferred direction.
            </p>
            <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="card" style={{ opacity: 0.5 }}>
                <div className="card-title">1A: Proven Pattern, Clean</div>
                <div className="card-meta">Dominant market formula, executed sharper</div>
                <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Not generated yet
                </div>
              </div>
              <div className="card" style={{ opacity: 0.5 }}>
                <div className="card-title">1B: Proven Pattern, Bold</div>
                <div className="card-meta">Same strategy, bolder visual and urgency</div>
                <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Not generated yet
                </div>
              </div>
              <div className="card" style={{ opacity: 0.5 }}>
                <div className="card-title">2: Gap Play</div>
                <div className="card-meta">Exploits biggest gap competitors miss</div>
                <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Not generated yet
                </div>
              </div>
              <div className="card" style={{ opacity: 0.5 }}>
                <div className="card-title">3: Aggressive DR</div>
                <div className="card-meta">Pure conversion machine, max CTAs</div>
                <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Not generated yet
                </div>
              </div>
            </div>
            {canEdit && (
              <div style={{ marginTop: 20 }}>
                <button className="btn btn-primary" disabled>
                  Generate 4 Concept Pages
                </button>
              </div>
            )}
          </div>
        )}

        {activeStage === 'builder' && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              Build and deploy landing pages for each Avatar + Offer combination.
              Pages inherit the selected design direction, use copy from the funnel, and are styled with the brand kit.
              Use the AI prompter to iterate on page sections.
            </p>
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">&#9889;</div>
              <div className="empty-state-text">No landing pages built yet</div>
              <div className="empty-state-sub">
                Complete the concept selection stage first, then build pages for each Avatar + Offer.
              </div>
              {canEdit && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} disabled>
                  Build Landing Page
                </button>
              )}
            </div>
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
