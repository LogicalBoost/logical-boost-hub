'use client'

import { useState } from 'react'
import { ANGLES, getAngleLabel } from '@/types/database'

const mockHeadlines = [
  { id: '1', text: "Don't Let Storm Damage Become a $15,000 Problem", char_count: 49, platform: 'meta' },
  { id: '2', text: 'Free Storm Damage Inspection', char_count: 30, platform: 'google' },
  { id: '3', text: 'Your Roof Took a Hit — Here\'s What to Do Next', char_count: 46, platform: 'meta' },
  { id: '4', text: 'Storm Damage? Free Inspection', char_count: 29, platform: 'google' },
  { id: '5', text: '70% of Storm-Damaged Roofs Look Fine from the Ground', char_count: 52, platform: 'meta' },
]

const mockSocialCopy = [
  { id: '10', text: 'That storm last week? It may have done more damage than you think. Most homeowners don\'t realize they have roof damage until leaks start — and by then, repair costs can triple. We\'ll inspect your roof for free and handle the entire insurance claim. Schedule your free inspection today.', char_count: 286, platform: 'meta' },
  { id: '11', text: 'Your neighbors are filing insurance claims for storm damage. Are you? 7 out of 10 roofs we inspect after a storm have damage the homeowner couldn\'t see. Free inspection — we handle everything.', char_count: 198, platform: 'meta' },
]

const mockBenefits = [
  { id: '20', text: '100% free inspection — you pay nothing unless we find damage and file a claim', char_count: 76 },
  { id: '21', text: 'Full insurance claim management from filing to approval', char_count: 54 },
  { id: '22', text: 'GAF Master Elite certified — top 3% of contractors nationwide', char_count: 61 },
  { id: '23', text: 'Most homeowners pay $0 out of pocket after insurance', char_count: 52 },
  { id: '24', text: 'Written damage report with photos — yours to keep regardless', char_count: 59 },
]

const mockProof = [
  { id: '30', text: 'Over 2,300 roofs inspected since 2015 — GAF Master Elite certified', char_count: 65 },
  { id: '31', text: '4.9 stars across 500+ Google reviews', char_count: 36 },
  { id: '32', text: '97% insurance claim approval rate', char_count: 33 },
]

const mockVideoScript = [
  { id: '40', text: 'HOOK: Your roof might be damaged right now and you don\'t even know it.\n\nAfter last month\'s storms, we\'ve inspected over 200 roofs in the DFW area. 7 out of 10 had damage the homeowner couldn\'t see from the ground.\n\nHere\'s what happens if you don\'t get it checked: Small cracks become leaks. Leaks become mold. Mold becomes a $15,000 problem that insurance won\'t cover — because you waited too long to file.\n\nWe\'re RoofCo Exteriors, GAF Master Elite certified with over 2,300 completed projects. We come out, inspect your roof for free, and document everything. If there\'s damage, we handle your entire insurance claim — most homeowners pay zero out of pocket.\n\nClick below to schedule your free inspection before the filing deadline passes.', char_count: 712 },
]

interface CopyItem {
  id: string
  text: string
  char_count: number
  platform?: string
}

function FunnelSection({ title, items, showPlatform }: { title: string; items: CopyItem[]; showPlatform?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const displayItems = expanded ? items : items.slice(0, 3)

  return (
    <div className="section-card">
      <div className="section-header">
        <span className="section-title">{title}</span>
        <span className="section-count">{items.length} items</span>
      </div>
      <div className="section-body">
        {displayItems.map((item) => (
          <div key={item.id} className="copy-item">
            <div className="copy-text">{item.text}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {showPlatform && item.platform && (
                <span className="tag" style={{ fontSize: 11 }}>{item.platform}</span>
              )}
              <span className="char-count">{item.char_count} chars</span>
            </div>
            <div className="copy-item-actions">
              <button className="btn btn-danger btn-sm btn-icon" title="Deny">&#10005;</button>
            </div>
          </div>
        ))}
        {items.length > 3 && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : `View All (${items.length})`}
          </button>
        )}
      </div>
      <div className="section-actions">
        <button className="btn btn-secondary btn-sm">+ Add</button>
        <button className="btn btn-primary btn-sm">Generate More</button>
      </div>
    </div>
  )
}

export default function FunnelPage() {
  const [avatar, setAvatar] = useState('storm-damage-homeowner')
  const [offer, setOffer] = useState('free-roof-inspection')
  const [angle, setAngle] = useState('problem')
  const [generated, setGenerated] = useState(true)

  const recommendedAngles = ['problem', 'fear', 'mechanism', 'proof', 'identity']

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Funnel</h1>
          <p className="page-subtitle">Complete campaign system for Avatar + Offer + Angle</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="selectors-row">
        <div className="selector-group">
          <label className="form-label">Avatar</label>
          <select className="form-input" value={avatar} onChange={(e) => setAvatar(e.target.value)}>
            <option value="storm-damage-homeowner">Storm-Damage Homeowner</option>
            <option value="proactive-homeowner">Proactive Homeowner</option>
            <option value="property-manager">Property Manager</option>
            <option value="insurance-aware">Insurance-Aware Homeowner</option>
          </select>
        </div>
        <div className="selector-group">
          <label className="form-label">Offer</label>
          <select className="form-input" value={offer} onChange={(e) => setOffer(e.target.value)}>
            <option value="free-roof-inspection">Free Roof Inspection</option>
            <option value="emergency-response">Storm Damage Emergency Response</option>
            <option value="insurance-claim">Insurance Claim Assistance</option>
            <option value="replacement-quote">Roof Replacement Quote</option>
          </select>
        </div>
        <div className="selector-group">
          <label className="form-label">Angle</label>
          <select className="form-input" value={angle} onChange={(e) => setAngle(e.target.value)}>
            <optgroup label="Recommended">
              {recommendedAngles.map((slug) => (
                <option key={slug} value={slug}>{getAngleLabel(slug)}</option>
              ))}
            </optgroup>
            <optgroup label="All Angles">
              {ANGLES.filter(a => !recommendedAngles.includes(a.slug)).map((a) => (
                <option key={a.slug} value={a.slug}>{a.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {generated ? (
        <>
          <FunnelSection title="Headlines" items={mockHeadlines} showPlatform />
          <FunnelSection title="Social Copy" items={mockSocialCopy} showPlatform />
          <FunnelSection title="Key Benefits" items={mockBenefits} />
          <FunnelSection title="Proof" items={mockProof} />
          <FunnelSection title="Video Script" items={mockVideoScript} />

          {/* Creatives */}
          <div className="section-card">
            <div className="section-header">
              <span className="section-title">Ad Concepts (Creatives)</span>
              <span className="section-count">3 items</span>
            </div>
            <div className="section-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {[
                  { type: 'static_image', headline: "Don't Let Storm Damage Become a $15,000 Problem", cta: 'Schedule Free Inspection' },
                  { type: 'static_image', headline: '70% of Storm-Damaged Roofs Look Fine', cta: 'Get Your Free Inspection' },
                  { type: 'video', headline: 'Your Roof Might Be Damaged Right Now', cta: 'Schedule Free Inspection' },
                ].map((creative, i) => (
                  <div key={i} className="card" style={{ padding: 16 }}>
                    <div style={{ height: 140, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
                      {creative.type === 'video' ? 'Video Concept' : 'Image Preview'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{creative.headline}</div>
                    <div className="tag" style={{ marginBottom: 8 }}>{creative.type}</div>
                    <div style={{ fontSize: 13, color: 'var(--accent)' }}>{creative.cta}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-actions">
              <button className="btn btn-primary btn-sm">Generate More</button>
            </div>
          </div>

          {/* Landing Page */}
          <div className="section-card">
            <div className="section-header">
              <span className="section-title">Landing Page</span>
              <span className="section-count">1 page</span>
            </div>
            <div className="section-body">
              <div className="card" style={{ padding: 20 }}>
                <div style={{ height: 200, background: 'linear-gradient(135deg, var(--accent-muted), var(--bg-input))', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' as const, padding: '0 20px' }}>Don&apos;t Let Storm Damage Become a $15,000 Problem</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' as const, padding: '0 20px' }}>Get a free professional roof inspection — we handle your insurance claim from start to finish</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm">View Full Page</button>
                  <button className="btn btn-danger btn-sm">Deny</button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">&#9889;</div>
          <div className="empty-state-text">No campaign generated for this combination</div>
          <div className="empty-state-sub">Click below to generate the full campaign asset set</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setGenerated(true)}>Generate Campaign</button>
        </div>
      )}
    </div>
  )
}
