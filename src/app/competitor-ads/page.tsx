'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'

export default function CompetitorAdsPage() {
  const { client, competitors, setCompetitors } = useAppStore()
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add form state
  const [newCompetitorName, setNewCompetitorName] = useState('')
  const [newCompetitorWebsite, setNewCompetitorWebsite] = useState('')
  const [newSource, setNewSource] = useState('manual')
  const [newAdType, setNewAdType] = useState('social')
  const [newContent, setNewContent] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [newNotes, setNewNotes] = useState('')

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128269;</div>
        <div className="empty-state-text">No client selected</div>
        <div className="empty-state-sub">Set up your client first in Business Overview.</div>
      </div>
    )
  }

  if (competitors.length === 0 && !showAddForm) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Competitor Ads</h1>
            <p className="page-subtitle">Monitor competitor advertising across channels</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add Intel</button>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">&#128269;</div>
          <div className="empty-state-text">No competitor intel yet</div>
          <div className="empty-state-sub">
            Start tracking competitor ads by adding intel manually or through analysis.
          </div>
        </div>
      </div>
    )
  }

  const competitorNames = [...new Set(competitors.map((a) => a.competitor_name))]
  const filtered = competitors.filter((ad) => {
    if (filterCompetitor !== 'all' && ad.competitor_name !== filterCompetitor) return false
    if (filterSource !== 'all' && ad.source !== filterSource) return false
    return true
  })

  async function handleAddIntel() {
    if (!client || !newCompetitorName.trim() || !newContent.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('competitor_intel').insert({
        client_id: client.id,
        competitor_name: newCompetitorName.trim(),
        competitor_website: newCompetitorWebsite.trim() || null,
        source: newSource,
        ad_type: newAdType,
        content: newContent.trim(),
        keywords: newKeywords.trim() ? newKeywords.split(',').map((k) => k.trim()).filter(Boolean) : null,
        notes: newNotes.trim() || null,
      }).select().single()
      if (error) throw error
      setCompetitors([...competitors, data])
      setShowAddForm(false)
      setNewCompetitorName('')
      setNewCompetitorWebsite('')
      setNewSource('manual')
      setNewAdType('social')
      setNewContent('')
      setNewKeywords('')
      setNewNotes('')
      showToast('Competitor intel added')
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Competitor Ads</h1>
          <p className="page-subtitle">Monitor competitor advertising across channels</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Intel'}
        </button>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Add Competitor Intel</div>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Competitor Name *</label>
                <input className="form-input" value={newCompetitorName} onChange={(e) => setNewCompetitorName(e.target.value)} placeholder="Company name" />
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-input" value={newCompetitorWebsite} onChange={(e) => setNewCompetitorWebsite(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Source</label>
                <select className="form-input" value={newSource} onChange={(e) => setNewSource(e.target.value)}>
                  <option value="manual">Manual</option>
                  <option value="meta_ad_library">Meta Ad Library</option>
                  <option value="google_ads">Google Ads</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ad Type</label>
                <select className="form-input" value={newAdType} onChange={(e) => setNewAdType(e.target.value)}>
                  <option value="social">Social</option>
                  <option value="search">Search</option>
                  <option value="display">Display</option>
                  <option value="video">Video</option>
                  <option value="landing_page">Landing Page</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Ad Content / Copy *</label>
              <textarea className="form-input form-textarea" rows={4} value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Paste the ad copy or describe the ad content..." />
            </div>
            <div className="form-group">
              <label className="form-label">Keywords (comma-separated)</label>
              <input className="form-input" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="keyword 1, keyword 2, ..." />
            </div>
            <div className="form-group">
              <label className="form-label">Notes / Analysis</label>
              <textarea className="form-input form-textarea" rows={3} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Your observations about this ad..." />
            </div>
            <div>
              <button className="btn btn-primary" onClick={handleAddIntel} disabled={saving || !newCompetitorName.trim() || !newContent.trim()}>
                {saving ? 'Saving...' : 'Save Intel'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="form-input" style={{ maxWidth: 200 }} value={filterCompetitor} onChange={(e) => setFilterCompetitor(e.target.value)}>
          <option value="all">All Competitors</option>
          {competitorNames.map((c) => <option key={c} value={c}>{c}</option>)}
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
                {ad.competitor_website && <div className="card-meta">{ad.competitor_website}</div>}
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
                  {ad.keywords.map((kw: string) => <span key={kw} className="tag">{kw}</span>)}
                </div>
              </div>
            )}
            {ad.notes && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {ad.notes}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Captured: {new Date(ad.captured_at).toLocaleDateString()}
            </div>
          </div>
        ))}
        {filtered.length === 0 && competitors.length > 0 && (
          <div className="empty-state">
            <div className="empty-state-text">No results match your filters</div>
          </div>
        )}
      </div>
    </div>
  )
}
