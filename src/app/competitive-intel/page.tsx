'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'

type Tab = 'overview' | 'offers' | 'pages' | 'ad_copy' | 'video'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'offers', label: 'Competitor Offers' },
  { key: 'pages', label: 'Above-Fold & Pages' },
  { key: 'ad_copy', label: 'Ad Copy & Hooks' },
  { key: 'video', label: 'Video & Creative' },
]

export default function CompetitiveIntelPage() {
  const { client, competitors, canEdit } = useAppStore()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add competitor form state
  const [compName, setCompName] = useState('')
  const [compWebsite, setCompWebsite] = useState('')
  const [compSource, setCompSource] = useState('manual')
  const [compAdType, setCompAdType] = useState('social')
  const [compContent, setCompContent] = useState('')
  const [compKeywords, setCompKeywords] = useState('')
  const [compNotes, setCompNotes] = useState('')

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128269;</div>
        <div className="empty-state-text">No client selected</div>
        <div className="empty-state-sub">Select or create a client first.</div>
      </div>
    )
  }

  const uniqueCompetitors = useMemo(() => {
    const names = new Set(competitors.map(c => c.competitor_name))
    return Array.from(names)
  }, [competitors])

  async function handleAddIntel(e: React.FormEvent) {
    e.preventDefault()
    if (!client || !compName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('competitor_intel').insert({
      client_id: client.id,
      competitor_name: compName.trim(),
      competitor_website: compWebsite.trim(),
      source: compSource,
      ad_type: compAdType,
      content: compContent.trim() || null,
      keywords: compKeywords.trim() ? compKeywords.split(',').map(s => s.trim()).filter(Boolean) : null,
      notes: compNotes.trim() || null,
      captured_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      showToast('Failed to add: ' + error.message)
      return
    }
    showToast('Competitor intel added')
    setCompName('')
    setCompWebsite('')
    setCompContent('')
    setCompKeywords('')
    setCompNotes('')
    setShowAddForm(false)
    // Refresh via store — for now just reload
    window.location.reload()
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Competitive Intelligence</h1>
            <p className="page-subtitle">
              Analyze competitor ads, offers, landing pages, and creative strategies
            </p>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                + Add Intel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="funnel-tabs" style={{ marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`funnel-tab ${activeTab === tab.key ? 'funnel-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Competitor Summary Cards */}
          {uniqueCompetitors.length > 0 ? (
            <>
              <div className="funnel-stats-bar" style={{ marginBottom: 24 }}>
                <div className="funnel-stat">
                  <div className="funnel-stat-value">{uniqueCompetitors.length}</div>
                  <div className="funnel-stat-label">Competitors Tracked</div>
                </div>
                <div className="funnel-stat">
                  <div className="funnel-stat-value">{competitors.filter(c => c.ad_type === 'social').length}</div>
                  <div className="funnel-stat-label">Social Ads</div>
                </div>
                <div className="funnel-stat">
                  <div className="funnel-stat-value">{competitors.filter(c => c.ad_type === 'search').length}</div>
                  <div className="funnel-stat-label">Search Ads</div>
                </div>
                <div className="funnel-stat">
                  <div className="funnel-stat-value">{competitors.filter(c => c.ad_type === 'landing_page').length}</div>
                  <div className="funnel-stat-label">Landing Pages</div>
                </div>
              </div>

              <div className="card-grid">
                {uniqueCompetitors.map((name) => {
                  const items = competitors.filter(c => c.competitor_name === name)
                  const website = items[0]?.competitor_website
                  return (
                    <div key={name} className="card">
                      <div className="card-title">{name}</div>
                      {website && <div className="card-meta">{website}</div>}
                      <div className="card-body">
                        <div className="tag-list" style={{ marginTop: 8 }}>
                          {items.some(i => i.ad_type === 'social') && <span className="tag">Social Ads</span>}
                          {items.some(i => i.ad_type === 'search') && <span className="tag">Search Ads</span>}
                          {items.some(i => i.ad_type === 'display') && <span className="tag">Display</span>}
                          {items.some(i => i.ad_type === 'landing_page') && <span className="tag">Landing Page</span>}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                          {items.length} item{items.length !== 1 ? 's' : ''} tracked
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-state-icon">&#128269;</div>
              <div className="empty-state-text">No competitive intelligence yet</div>
              <div className="empty-state-sub">
                Add competitor ads, landing pages, and offers to build your competitive analysis.
              </div>
              {canEdit && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAddForm(true)}>
                  + Add Your First Competitor
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'offers' && (
        <div>
          <div className="funnel-section-card">
            <div className="funnel-section-header">
              <h3>Competitor Offers</h3>
            </div>
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              {competitors.length > 0 ? (
                <div>
                  {competitors.filter(c => c.notes).map((c, i) => (
                    <div key={c.id || i} className="copy-row" style={{ textAlign: 'left' }}>
                      <div className="copy-row-text">
                        <strong>{c.competitor_name}</strong>: {c.notes || c.content || 'No details'}
                      </div>
                      <div className="copy-row-meta">
                        <span className="tag">{c.source}</span>
                        <span className="tag">{c.ad_type}</span>
                      </div>
                    </div>
                  ))}
                  {competitors.filter(c => c.notes).length === 0 && 'No competitor offer analysis yet. Add intel with offer details.'}
                </div>
              ) : (
                'Add competitor intelligence to see their offers analyzed here.'
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pages' && (
        <div>
          <div className="funnel-section-card">
            <div className="funnel-section-header">
              <h3>Above-Fold &amp; Landing Pages</h3>
            </div>
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              {competitors.filter(c => c.ad_type === 'landing_page').length > 0 ? (
                <div>
                  {competitors.filter(c => c.ad_type === 'landing_page').map((c, i) => (
                    <div key={c.id || i} style={{ textAlign: 'left', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.competitor_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{c.competitor_website}</div>
                      {c.content && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{c.content}</div>}
                      {c.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{c.notes}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                'No competitor landing pages tracked yet. Add landing page intel to analyze above-fold patterns.'
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ad_copy' && (
        <div>
          <div className="funnel-section-card">
            <div className="funnel-section-header">
              <h3>Ad Copy &amp; Hooks</h3>
            </div>
            <div style={{ padding: 20 }}>
              {competitors.filter(c => c.content && (c.ad_type === 'social' || c.ad_type === 'search')).length > 0 ? (
                competitors.filter(c => c.content && (c.ad_type === 'social' || c.ad_type === 'search')).map((c, i) => (
                  <div key={c.id || i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{c.competitor_name}</span>
                      <div className="tag-list">
                        <span className="tag">{c.source}</span>
                        <span className="tag">{c.ad_type}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{c.content}</div>
                    {c.keywords && c.keywords.length > 0 && (
                      <div className="tag-list" style={{ marginTop: 6 }}>
                        {c.keywords.map((k, ki) => <span key={ki} className="tag" style={{ fontSize: 11 }}>{k}</span>)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                  No competitor ad copy tracked yet. Add social or search ads to see them here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'video' && (
        <div>
          <div className="funnel-section-card">
            <div className="funnel-section-header">
              <h3>Video &amp; Creative</h3>
            </div>
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Video and creative analysis coming soon. Track competitor video ads and creative strategies.
            </div>
          </div>
        </div>
      )}

      {/* Add Intel Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Competitor Intel</h2>
              <button className="modal-close" onClick={() => setShowAddForm(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddIntel}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Competitor Name *</label>
                    <input className="form-input" value={compName} onChange={e => setCompName(e.target.value)} placeholder="e.g. ABC Plumbing" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Website</label>
                    <input className="form-input" value={compWebsite} onChange={e => setCompWebsite(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Source</label>
                    <select className="form-input" value={compSource} onChange={e => setCompSource(e.target.value)}>
                      <option value="manual">Manual</option>
                      <option value="meta_ad_library">Meta Ad Library</option>
                      <option value="google_ads">Google Ads</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-input" value={compAdType} onChange={e => setCompAdType(e.target.value)}>
                      <option value="social">Social Ad</option>
                      <option value="search">Search Ad</option>
                      <option value="display">Display Ad</option>
                      <option value="landing_page">Landing Page</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ad Copy / Content</label>
                  <textarea className="form-textarea" rows={4} value={compContent} onChange={e => setCompContent(e.target.value)} placeholder="Paste the ad copy, landing page headline, or describe the creative..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Keywords (comma-separated)</label>
                  <input className="form-input" value={compKeywords} onChange={e => setCompKeywords(e.target.value)} placeholder="e.g. emergency plumber, 24/7 service" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes / Analysis</label>
                  <textarea className="form-textarea" rows={3} value={compNotes} onChange={e => setCompNotes(e.target.value)} placeholder="What stands out? What offer are they running? What's their angle?" />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Add Intel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
