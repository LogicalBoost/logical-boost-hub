'use client'

import { useState } from 'react'

const mockCompetitorAds = [
  {
    id: '1',
    competitor_name: 'StormGuard Roofing',
    competitor_website: 'https://stormguardroofing.com',
    source: 'meta_ad_library',
    ad_type: 'social',
    content: 'Did your roof survive the storm? FREE inspection + we handle your insurance claim. Don\'t wait — damage gets worse every day. Call now: (555) 123-4567',
    keywords: null,
    notes: 'Heavy fear-based messaging. Similar free inspection offer. Running multiple variations.',
    captured_at: '2026-03-15',
  },
  {
    id: '2',
    competitor_name: 'StormGuard Roofing',
    competitor_website: 'https://stormguardroofing.com',
    source: 'meta_ad_library',
    ad_type: 'social',
    content: 'JUST IN: Over 500 homes in your area reported storm damage this month. Is yours one of them? Get a FREE roof inspection before it\'s too late.',
    keywords: null,
    notes: 'Urgency-driven. Uses location targeting. Video ad format with drone footage of damaged roofs.',
    captured_at: '2026-03-12',
  },
  {
    id: '3',
    competitor_name: 'DFW Roof Pros',
    competitor_website: 'https://dfwroofpros.com',
    source: 'google_ads',
    ad_type: 'search',
    content: 'Roof Repair DFW - $500 Off Any Repair | Licensed & Insured | Free Estimates. New Roof Starting at $5,999. Financing Available.',
    keywords: ['roof repair dfw', 'roofing company dallas', 'storm damage roof repair'],
    notes: 'Competing on price. Discount-heavy messaging. Weaker brand positioning.',
    captured_at: '2026-03-18',
  },
  {
    id: '4',
    competitor_name: 'Apex Restoration',
    competitor_website: 'https://apexrestoration.com',
    source: 'meta_ad_library',
    ad_type: 'social',
    content: 'Your home deserves the best. Apex Restoration: Award-winning roofing, siding, and windows. Premium materials. Lifetime warranty. Schedule your consultation.',
    keywords: null,
    notes: 'Premium positioning. Less focused on storm damage, more on full home exterior. Beautiful creative assets.',
    captured_at: '2026-03-10',
  },
  {
    id: '5',
    competitor_name: 'DFW Roof Pros',
    competitor_website: 'https://dfwroofpros.com',
    source: 'manual',
    ad_type: 'landing_page',
    content: 'Landing page at dfwroofpros.com/storm-damage — Features: comparison table vs competitors, customer video testimonials, live chat widget, "Price Match Guarantee" prominently displayed.',
    keywords: ['storm damage repair', 'emergency roof repair'],
    notes: 'Well-designed landing page. Price match guarantee could be an objection for our leads. Worth monitoring.',
    captured_at: '2026-03-20',
  },
]

export default function CompetitorAdsPage() {
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [filterSource, setFilterSource] = useState('all')

  const competitors = [...new Set(mockCompetitorAds.map((a) => a.competitor_name))]
  const filtered = mockCompetitorAds.filter((ad) => {
    if (filterCompetitor !== 'all' && ad.competitor_name !== filterCompetitor) return false
    if (filterSource !== 'all' && ad.source !== filterSource) return false
    return true
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Competitor Ads</h1>
          <p className="page-subtitle">Monitor competitor advertising across channels</p>
        </div>
        <button className="btn btn-primary">+ Add Intel</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="form-input" style={{ maxWidth: 200 }} value={filterCompetitor} onChange={(e) => setFilterCompetitor(e.target.value)}>
          <option value="all">All Competitors</option>
          {competitors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-input" style={{ maxWidth: 200 }} value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
          <option value="all">All Sources</option>
          <option value="meta_ad_library">Meta Ad Library</option>
          <option value="google_ads">Google Ads</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {filtered.map((ad) => (
          <div key={ad.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div className="card-title">{ad.competitor_name}</div>
                <div className="card-meta">{ad.competitor_website}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="tag">{ad.source.replace('_', ' ')}</span>
                <span className="tag">{ad.ad_type}</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 12 }}>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>{ad.content}</p>
            </div>
            {ad.keywords && ad.keywords.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <span className="detail-label" style={{ marginBottom: 6, display: 'block' }}>Keywords</span>
                <div className="tag-list">
                  {ad.keywords.map((kw) => <span key={kw} className="tag">{kw}</span>)}
                </div>
              </div>
            )}
            {ad.notes && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {ad.notes}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Captured: {ad.captured_at}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
