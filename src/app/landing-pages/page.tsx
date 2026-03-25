'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'

type Stage = 'brand_kit' | 'competitive' | 'playbook' | 'concepts' | 'builder'

const STAGES: { key: Stage; label: string; icon: string; description: string }[] = [
  { key: 'brand_kit', label: 'Brand Kit', icon: '&#127912;', description: 'Extract brand colors, fonts, logo, and visual identity from client website' },
  { key: 'competitive', label: 'Competitive Analysis', icon: '&#128269;', description: 'Analyze competitor landing pages for above-fold patterns and page structure' },
  { key: 'playbook', label: 'Industry Playbook', icon: '&#128218;', description: 'Synthesize competitive data into patterns, gaps, and concept briefs' },
  { key: 'concepts', label: 'Concept Pages', icon: '&#127919;', description: 'AI generates 4 strategic landing page concepts for client to choose from' },
  { key: 'builder', label: 'Page Builder', icon: '&#9889;', description: 'Build, preview, and deploy landing pages with AI-assisted editing' },
]

export default function LandingPagesPage() {
  const { client, canEdit } = useAppStore()
  const [activeStage, setActiveStage] = useState<Stage>('brand_kit')

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128196;</div>
        <div className="empty-state-text">No client selected</div>
        <div className="empty-state-sub">Select or create a client first.</div>
      </div>
    )
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
                <div className="card-title">Logo</div>
                <div className="card-body" style={{ color: 'var(--text-muted)' }}>
                  No logo uploaded yet
                </div>
              </div>
              <div className="card">
                <div className="card-title">Button Style</div>
                <div className="card-body" style={{ color: 'var(--text-muted)' }}>
                  No button style defined yet
                </div>
              </div>
            </div>
            {canEdit && (
              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" disabled>
                  Analyze Website for Brand Kit
                </button>
                <button className="btn btn-secondary" disabled>
                  Upload Logo
                </button>
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
