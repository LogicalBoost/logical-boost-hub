'use client'

import { useState } from 'react'
import { MOCK_CLIENT } from '@/lib/mock-data'
import { demoAction } from '@/lib/demo-toast'
import type { Competitor } from '@/types/database'

export default function BusinessOverviewPage() {
  const [editing, setEditing] = useState(false)

  // Core fields
  const [name, setName] = useState(MOCK_CLIENT.name)
  const [website, setWebsite] = useState(MOCK_CLIENT.website)
  const [businessSummary, setBusinessSummary] = useState(MOCK_CLIENT.business_summary ?? '')
  const [services, setServices] = useState(MOCK_CLIENT.services ?? '')
  const [differentiators, setDifferentiators] = useState(MOCK_CLIENT.differentiators ?? '')
  const [trustSignals, setTrustSignals] = useState(MOCK_CLIENT.trust_signals ?? '')
  const [tone, setTone] = useState(MOCK_CLIENT.tone ?? '')

  // Ad copy rules
  const [toneDescriptors, setToneDescriptors] = useState(
    MOCK_CLIENT.ad_copy_rules?.tone_descriptors.join(', ') ?? ''
  )
  const [bannedWords, setBannedWords] = useState(
    MOCK_CLIENT.ad_copy_rules?.banned_words.join(', ') ?? ''
  )
  const [requiredDisclaimers, setRequiredDisclaimers] = useState(
    MOCK_CLIENT.ad_copy_rules?.required_disclaimers.join(', ') ?? ''
  )
  const [googleHeadlineMax, setGoogleHeadlineMax] = useState(
    String(MOCK_CLIENT.ad_copy_rules?.platform_rules.google.headline_max_chars ?? 30)
  )
  const [googleDescMax, setGoogleDescMax] = useState(
    String(MOCK_CLIENT.ad_copy_rules?.platform_rules.google.description_max_chars ?? 90)
  )
  const [metaPrimaryMax, setMetaPrimaryMax] = useState(
    String(MOCK_CLIENT.ad_copy_rules?.platform_rules.meta.primary_text_max_chars ?? 125)
  )
  const [metaHeadlineMax, setMetaHeadlineMax] = useState(
    String(MOCK_CLIENT.ad_copy_rules?.platform_rules.meta.headline_max_chars ?? 40)
  )
  const [brandConstraints, setBrandConstraints] = useState(
    MOCK_CLIENT.ad_copy_rules?.brand_constraints ?? ''
  )
  const [complianceNotes, setComplianceNotes] = useState(
    MOCK_CLIENT.ad_copy_rules?.compliance_notes ?? ''
  )
  const [adCopyNotes, setAdCopyNotes] = useState(MOCK_CLIENT.ad_copy_notes ?? '')

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>(
    MOCK_CLIENT.competitors ?? []
  )

  // Call notes
  const [callNotes, setCallNotes] = useState('')

  // AI Analyze fields
  const [analyzeUrl, setAnalyzeUrl] = useState('')
  const [analyzeName, setAnalyzeName] = useState('')
  const [analyzeNotes, setAnalyzeNotes] = useState('')

  function handleToggleEdit() {
    if (editing) {
      demoAction('Save Business Data')
    }
    setEditing(!editing)
  }

  function handleAddCompetitor() {
    setCompetitors([...competitors, { name: '', website: '', notes: '' }])
  }

  function updateCompetitor(index: number, field: keyof Competitor, value: string) {
    const updated = competitors.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    )
    setCompetitors(updated)
  }

  function removeCompetitor(index: number) {
    setCompetitors(competitors.filter((_, i) => i !== index))
  }

  const toneList = toneDescriptors.split(',').map(s => s.trim()).filter(Boolean)
  const bannedList = bannedWords.split(',').map(s => s.trim()).filter(Boolean)
  const disclaimerList = requiredDisclaimers.split(',').map(s => s.trim()).filter(Boolean)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Overview</h1>
          <p className="page-subtitle">Foundation data that powers all AI generation</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleToggleEdit}>
            {editing ? 'Save Changes' : 'Edit'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Analyze with AI */}
        <div className="card">
          <div className="card-title">Analyze with AI</div>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Business Website URL</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://example.com"
                  value={analyzeUrl}
                  onChange={(e) => setAnalyzeUrl(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Company name"
                  value={analyzeName}
                  onChange={(e) => setAnalyzeName(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Call Notes / Raw Information</label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Paste call transcripts, notes, or any raw business information here..."
                value={analyzeNotes}
                onChange={(e) => setAnalyzeNotes(e.target.value)}
              />
            </div>
            <div>
              <button
                className="btn btn-primary"
                onClick={() => demoAction('Analyze Business with AI')}
              >
                Analyze Business
              </button>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="card">
          <div className="card-title">Company Info</div>
          <div className="detail-grid" style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="detail-item">
                <span className="detail-label">Business Name</span>
                {editing ? (
                  <input
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                ) : (
                  <span className="detail-value">{name}</span>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Website</span>
                {editing ? (
                  <input
                    className="form-input"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                ) : (
                  <span className="detail-value">{website}</span>
                )}
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Business Summary</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={businessSummary}
                  onChange={(e) => setBusinessSummary(e.target.value)}
                />
              ) : (
                <span className="detail-value">{businessSummary}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Services</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                />
              ) : (
                <span className="detail-value">{services}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Differentiators</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={differentiators}
                  onChange={(e) => setDifferentiators(e.target.value)}
                />
              ) : (
                <span className="detail-value">{differentiators}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Trust Signals</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={trustSignals}
                  onChange={(e) => setTrustSignals(e.target.value)}
                />
              ) : (
                <span className="detail-value">{trustSignals}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Tone</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                />
              ) : (
                <span className="detail-value">{tone}</span>
              )}
            </div>
          </div>
        </div>

        {/* Ad Copy Rules */}
        <div className="card">
          <div className="card-title">Ad Copy Rules &amp; Guidelines</div>
          <div className="detail-grid" style={{ marginTop: 16 }}>
            <div className="detail-item">
              <span className="detail-label">Tone Descriptors</span>
              {editing ? (
                <input
                  className="form-input"
                  value={toneDescriptors}
                  onChange={(e) => setToneDescriptors(e.target.value)}
                  placeholder="Comma-separated values"
                />
              ) : (
                <div className="tag-list">
                  {toneList.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Banned Words</span>
              {editing ? (
                <input
                  className="form-input"
                  value={bannedWords}
                  onChange={(e) => setBannedWords(e.target.value)}
                  placeholder="Comma-separated values"
                />
              ) : (
                <div className="tag-list">
                  {bannedList.map((w) => (
                    <span key={w} className="tag" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{w}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Required Disclaimers</span>
              {editing ? (
                <input
                  className="form-input"
                  value={requiredDisclaimers}
                  onChange={(e) => setRequiredDisclaimers(e.target.value)}
                  placeholder="Comma-separated values"
                />
              ) : (
                <div className="tag-list">
                  {disclaimerList.map((d) => (
                    <span key={d} className="tag">{d}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="detail-item">
                <span className="detail-label">Google Ads Limits</span>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Headlines:</span>
                    <input
                      className="form-input"
                      type="number"
                      style={{ width: 70 }}
                      value={googleHeadlineMax}
                      onChange={(e) => setGoogleHeadlineMax(e.target.value)}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desc:</span>
                    <input
                      className="form-input"
                      type="number"
                      style={{ width: 70 }}
                      value={googleDescMax}
                      onChange={(e) => setGoogleDescMax(e.target.value)}
                    />
                  </div>
                ) : (
                  <span className="detail-value">
                    Headlines: {googleHeadlineMax} chars | Descriptions: {googleDescMax} chars
                  </span>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Meta Ads Limits</span>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Primary:</span>
                    <input
                      className="form-input"
                      type="number"
                      style={{ width: 70 }}
                      value={metaPrimaryMax}
                      onChange={(e) => setMetaPrimaryMax(e.target.value)}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Headlines:</span>
                    <input
                      className="form-input"
                      type="number"
                      style={{ width: 70 }}
                      value={metaHeadlineMax}
                      onChange={(e) => setMetaHeadlineMax(e.target.value)}
                    />
                  </div>
                ) : (
                  <span className="detail-value">
                    Primary text: {metaPrimaryMax} chars | Headlines: {metaHeadlineMax} chars
                  </span>
                )}
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Brand Constraints</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={brandConstraints}
                  onChange={(e) => setBrandConstraints(e.target.value)}
                />
              ) : (
                <span className="detail-value">{brandConstraints}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Compliance Notes</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={complianceNotes}
                  onChange={(e) => setComplianceNotes(e.target.value)}
                />
              ) : (
                <span className="detail-value">{complianceNotes}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Additional Copy Notes</span>
              {editing ? (
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={adCopyNotes}
                  onChange={(e) => setAdCopyNotes(e.target.value)}
                />
              ) : (
                <span className="detail-value">{adCopyNotes}</span>
              )}
            </div>
          </div>
        </div>

        {/* Competitors */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Competitors</span>
            <button className="btn btn-secondary" onClick={handleAddCompetitor}>
              Add Competitor
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            {competitors.map((c, index) => (
              <div key={index} className="copy-item">
                <div style={{ flex: 1 }}>
                  {editing ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input
                        className="form-input"
                        placeholder="Competitor name"
                        value={c.name}
                        onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                      />
                      <input
                        className="form-input"
                        placeholder="Website URL"
                        value={c.website}
                        onChange={(e) => updateCompetitor(index, 'website', e.target.value)}
                      />
                      <textarea
                        className="form-textarea"
                        rows={2}
                        placeholder="Notes about this competitor"
                        value={c.notes}
                        onChange={(e) => updateCompetitor(index, 'notes', e.target.value)}
                      />
                      <button
                        className="btn btn-secondary"
                        style={{ justifySelf: 'start', fontSize: 13 }}
                        onClick={() => removeCompetitor(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{c.website}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{c.notes}</div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {competitors.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                No competitors added yet. Click &quot;Add Competitor&quot; to get started.
              </div>
            )}
          </div>
        </div>

        {/* Call Notes */}
        <div className="card">
          <div className="card-title">Call Notes / Raw Inputs</div>
          <div style={{ marginTop: 16 }}>
            <div className="form-group">
              <label className="form-label">Paste or type call notes, transcripts, or raw information</label>
              <textarea
                className="form-textarea"
                rows={6}
                placeholder="Upload call transcripts, documents, or paste notes here..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
