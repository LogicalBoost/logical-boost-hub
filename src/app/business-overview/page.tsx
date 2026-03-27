'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { analyzeBusiness } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { Competitor } from '@/types/database'
import TagInput from '@/components/TagInput'
import LogoUpload from '@/components/LogoUpload'

export default function BusinessOverviewPage() {
  const { client, loading, setClient, setLoading, setError, createClient, loadClientData, loadAllClients, canEdit, refreshClient, mediaAssets, refreshMediaAssets } = useAppStore()

  // New client setup form state
  const [showNewForm, setShowNewForm] = useState(false)
  const [setupName, setSetupName] = useState('')
  const [setupWebsite, setSetupWebsite] = useState('')
  const [setupNotes, setSetupNotes] = useState('')
  const [analyzeMessage, setAnalyzeMessage] = useState('')

  // Editing state
  const [editing, setEditing] = useState(false)

  // Editable fields (initialized from client when toggling edit)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [businessSummary, setBusinessSummary] = useState('')
  const [services, setServices] = useState('')
  const [differentiators, setDifferentiators] = useState('')
  const [trustSignals, setTrustSignals] = useState('')
  const [tone, setTone] = useState('')
  const [adCopyNotes, setAdCopyNotes] = useState('')

  // Ad copy rules editable fields (arrays for tag inputs)
  const [toneDescriptors, setToneDescriptors] = useState<string[]>([])
  const [bannedWords, setBannedWords] = useState<string[]>([])
  const [requiredDisclaimers, setRequiredDisclaimers] = useState<string[]>([])
  const [googleHeadlineMax, setGoogleHeadlineMax] = useState('30')
  const [googleDescMax, setGoogleDescMax] = useState('90')
  const [metaPrimaryMax, setMetaPrimaryMax] = useState('125')
  const [metaHeadlineMax, setMetaHeadlineMax] = useState('40')
  const [brandConstraints, setBrandConstraints] = useState('')
  const [complianceNotes, setComplianceNotes] = useState('')

  // Competitors editable
  const [competitors, setCompetitors] = useState<Competitor[]>([])

  // Re-analyze state
  const [reanalyzeNotes, setReanalyzeNotes] = useState('')
  const [reanalyzing, setReanalyzing] = useState(false)

  // Saving state
  const [saving, setSaving] = useState(false)

  // --- New Client Setup ---
  async function handleAnalyzeNewBusiness() {
    if (!setupName.trim() || !setupWebsite.trim()) {
      setError('Business name and website URL are required.')
      return
    }
    setLoading(true)
    setAnalyzeMessage('Creating client record...')
    setError(null)
    try {
      const newClient = await createClient(setupName.trim(), setupWebsite.trim())
      if (!newClient) {
        setLoading(false)
        setAnalyzeMessage('')
        return
      }
      setAnalyzeMessage('AI is analyzing your business...')
      await analyzeBusiness(newClient.id, setupWebsite.trim(), setupNotes.trim())
      await loadClientData(newClient.id)
      await loadAllClients()
      setAnalyzeMessage('')
      setSetupName('')
      setSetupWebsite('')
      setSetupNotes('')
      setShowNewForm(false)
    } catch (err) {
      setError((err as Error).message)
      setAnalyzeMessage('')
    } finally {
      setLoading(false)
    }
  }

  // --- Edit toggle ---
  function handleStartEdit() {
    if (!client) return
    setName(client.name)
    setWebsite(client.website)
    setBusinessSummary(client.business_summary ?? '')
    setServices(client.services ?? '')
    setDifferentiators(client.differentiators ?? '')
    setTrustSignals(client.trust_signals ?? '')
    setTone(client.tone ?? '')
    setAdCopyNotes(client.ad_copy_notes ?? '')
    setToneDescriptors(client.ad_copy_rules?.tone_descriptors ?? [])
    setBannedWords(client.ad_copy_rules?.banned_words ?? [])
    setRequiredDisclaimers(client.ad_copy_rules?.required_disclaimers ?? [])
    setGoogleHeadlineMax(String(client.ad_copy_rules?.platform_rules.google.headline_max_chars ?? 30))
    setGoogleDescMax(String(client.ad_copy_rules?.platform_rules.google.description_max_chars ?? 90))
    setMetaPrimaryMax(String(client.ad_copy_rules?.platform_rules.meta.primary_text_max_chars ?? 125))
    setMetaHeadlineMax(String(client.ad_copy_rules?.platform_rules.meta.headline_max_chars ?? 40))
    setBrandConstraints(client.ad_copy_rules?.brand_constraints ?? '')
    setComplianceNotes(client.ad_copy_rules?.compliance_notes ?? '')
    setCompetitors(client.competitors ? [...client.competitors] : [])
    setEditing(true)
  }

  async function handleSave() {
    if (!client) return
    setSaving(true)
    setError(null)
    try {
      const updates: Record<string, unknown> = {
        name: name.trim(),
        website: website.trim(),
        business_summary: businessSummary.trim() || null,
        services: services.trim() || null,
        differentiators: differentiators.trim() || null,
        trust_signals: trustSignals.trim() || null,
        tone: tone.trim() || null,
        ad_copy_notes: adCopyNotes.trim() || null,
        competitors: competitors.length > 0 ? competitors : null,
        ad_copy_rules: {
          tone_descriptors: toneDescriptors,
          banned_words: bannedWords,
          required_disclaimers: requiredDisclaimers,
          platform_rules: {
            google: {
              headline_max_chars: parseInt(googleHeadlineMax) || 30,
              description_max_chars: parseInt(googleDescMax) || 90,
            },
            meta: {
              primary_text_max_chars: parseInt(metaPrimaryMax) || 125,
              headline_max_chars: parseInt(metaHeadlineMax) || 40,
            },
            youtube: {},
          },
          brand_constraints: brandConstraints.trim(),
          compliance_notes: complianceNotes.trim(),
        },
      }
      const { error: updateError } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id)
      if (updateError) {
        setError(updateError.message)
      } else {
        await loadClientData(client.id)
        setEditing(false)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditing(false)
  }

  // --- Competitors (edit mode) ---
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

  // --- Re-analyze ---
  async function handleReanalyze() {
    if (!client) return
    setReanalyzing(true)
    setError(null)
    try {
      await analyzeBusiness(client.id, client.website, reanalyzeNotes.trim())
      await loadClientData(client.id)
      setReanalyzeNotes('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setReanalyzing(false)
    }
  }

  // --- No client or adding new: show setup form ---
  if (!client || showNewForm) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{showNewForm ? 'Add New Client' : 'Business Overview'}</h1>
            <p className="page-subtitle">{showNewForm ? 'Set up a new client for your agency' : 'Set up a new client to get started'}</p>
          </div>
          {showNewForm && client && (
            <button className="btn btn-secondary" onClick={() => setShowNewForm(false)}>
              Cancel
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-title">New Client Setup</div>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Business Name *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter business name"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Business Website URL *</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://example.com"
                value={setupWebsite}
                onChange={(e) => setSetupWebsite(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Call Notes / Raw Information</label>
              <textarea
                className="form-textarea"
                rows={6}
                placeholder="Paste call transcripts, notes, or any raw business information here..."
                value={setupNotes}
                onChange={(e) => setSetupNotes(e.target.value)}
              />
            </div>
            {analyzeMessage && (
              <div style={{ padding: 16, background: 'var(--surface-hover, #f0f4ff)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{analyzeMessage}</div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>Processing...</div>
              </div>
            )}
            <div>
              <button
                className="btn btn-primary"
                onClick={handleAnalyzeNewBusiness}
                disabled={loading || !setupName.trim() || !setupWebsite.trim()}
              >
                {loading ? 'Processing...' : 'Analyze Business'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Client exists: show data ---
  const adRules = client.ad_copy_rules
  const clientCompetitors = client.competitors ?? []

  const toneList = adRules?.tone_descriptors ?? []
  const bannedList = adRules?.banned_words ?? []
  const disclaimerList = adRules?.required_disclaimers ?? []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Overview</h1>
          <p className="page-subtitle">Foundation data that powers all AI generation</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button className="btn btn-secondary" onClick={() => setShowNewForm(true)}>
              + Add New Client
            </button>
          )}
          {canEdit && (editing ? (
            <>
              <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleStartEdit}>
              Edit
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
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
                  <span className="detail-value">{client.name}</span>
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
                  <span className="detail-value">{client.website}</span>
                )}
              </div>
            </div>
            {/* Client Logo */}
            <div className="detail-item">
              <span className="detail-label">Logo</span>
              {canEdit ? (
                <LogoUpload
                  clientId={client.id}
                  currentLogoUrl={client.logo_url || null}
                  onUploadComplete={() => refreshClient(client.id)}
                />
              ) : client.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={client.logo_url} alt={`${client.name} logo`} style={{ maxHeight: 80, objectFit: 'contain' }} />
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No logo uploaded yet</span>
              )}
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
              ) : client.business_summary ? (
                <span className="detail-value">{client.business_summary}</span>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-text">Not yet analyzed</span>
                  <span className="empty-state-sub">Click Analyze Business below to generate</span>
                </div>
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
              ) : client.services ? (
                <span className="detail-value">{client.services}</span>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-text">Not yet analyzed</span>
                  <span className="empty-state-sub">Click Analyze Business below to generate</span>
                </div>
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
              ) : client.differentiators ? (
                <span className="detail-value">{client.differentiators}</span>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-text">Not yet analyzed</span>
                  <span className="empty-state-sub">Click Analyze Business below to generate</span>
                </div>
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
              ) : client.trust_signals ? (
                <span className="detail-value">{client.trust_signals}</span>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-text">Not yet analyzed</span>
                  <span className="empty-state-sub">Click Analyze Business below to generate</span>
                </div>
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
              ) : client.tone ? (
                <span className="detail-value">{client.tone}</span>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-text">Not yet analyzed</span>
                  <span className="empty-state-sub">Click Analyze Business below to generate</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ad Copy Rules */}
        {(adRules || editing) && (
          <div className="card">
            <div className="card-title">Ad Copy Rules &amp; Guidelines</div>
            <div className="detail-grid" style={{ marginTop: 16 }}>
              <div className="detail-item">
                <span className="detail-label">Tone Descriptors</span>
                {editing ? (
                  <TagInput
                    tags={toneDescriptors}
                    onChange={setToneDescriptors}
                    placeholder="Type a tone descriptor and press Enter"
                  />
                ) : toneList.length > 0 ? (
                  <div className="tag-list">
                    {toneList.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">No tone descriptors set</span>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Banned Words</span>
                {editing ? (
                  <TagInput
                    tags={bannedWords}
                    onChange={setBannedWords}
                    placeholder="Type a banned word and press Enter"
                    tagColor="var(--danger)"
                  />
                ) : bannedList.length > 0 ? (
                  <div className="tag-list">
                    {bannedList.map((w) => (
                      <span key={w} className="tag" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{w}</span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">No banned words set</span>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Required Disclaimers</span>
                {editing ? (
                  <div className="disclaimer-list">
                    {requiredDisclaimers.map((d, i) => (
                      <div key={i} className="disclaimer-item">
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={d}
                          onChange={(e) => {
                            const updated = [...requiredDisclaimers]
                            updated[i] = e.target.value
                            setRequiredDisclaimers(updated)
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setRequiredDisclaimers(requiredDisclaimers.filter((_, idx) => idx !== i))}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm disclaimer-add-btn"
                      onClick={() => setRequiredDisclaimers([...requiredDisclaimers, ''])}
                    >
                      + Add Disclaimer
                    </button>
                  </div>
                ) : disclaimerList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {disclaimerList.map((d) => (
                      <div key={d} style={{ fontSize: 14, color: 'var(--text-primary)', padding: '6px 10px', background: 'var(--warning-muted)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        {d}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">No disclaimers set</span>
                  </div>
                )}
              </div>
              <div className="platform-rules-grid">
                <div className="platform-rule-card">
                  <div className="platform-rule-title">Google Ads Limits</div>
                  {editing ? (
                    <>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Headlines</span>
                        <input
                          className="form-input platform-rule-input"
                          type="number"
                          value={googleHeadlineMax}
                          onChange={(e) => setGoogleHeadlineMax(e.target.value)}
                        />
                        <span className="platform-rule-suffix">chars</span>
                      </div>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Descriptions</span>
                        <input
                          className="form-input platform-rule-input"
                          type="number"
                          value={googleDescMax}
                          onChange={(e) => setGoogleDescMax(e.target.value)}
                        />
                        <span className="platform-rule-suffix">chars</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Headlines</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.google.headline_max_chars ?? 30} chars</span>
                      </div>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Descriptions</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.google.description_max_chars ?? 90} chars</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="platform-rule-card">
                  <div className="platform-rule-title">Meta Ads Limits</div>
                  {editing ? (
                    <>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Primary text</span>
                        <input
                          className="form-input platform-rule-input"
                          type="number"
                          value={metaPrimaryMax}
                          onChange={(e) => setMetaPrimaryMax(e.target.value)}
                        />
                        <span className="platform-rule-suffix">chars</span>
                      </div>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Headlines</span>
                        <input
                          className="form-input platform-rule-input"
                          type="number"
                          value={metaHeadlineMax}
                          onChange={(e) => setMetaHeadlineMax(e.target.value)}
                        />
                        <span className="platform-rule-suffix">chars</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Primary text</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.meta.primary_text_max_chars ?? 125} chars</span>
                      </div>
                      <div className="platform-rule-row">
                        <span className="platform-rule-label">Headlines</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.meta.headline_max_chars ?? 40} chars</span>
                      </div>
                    </>
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
                ) : adRules?.brand_constraints ? (
                  <span className="detail-value">{adRules.brand_constraints}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">No brand constraints set</span>
                  </div>
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
                ) : adRules?.compliance_notes ? (
                  <span className="detail-value">{adRules.compliance_notes}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">No compliance notes set</span>
                  </div>
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
                ) : client.ad_copy_notes ? (
                  <span className="detail-value">{client.ad_copy_notes}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">No additional copy notes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!adRules && !editing && (
          <div className="card">
            <div className="card-title">Ad Copy Rules &amp; Guidelines</div>
            <div className="empty-state" style={{ marginTop: 16, padding: 24, textAlign: 'center' }}>
              <span className="empty-state-text">Not yet analyzed</span>
              <span className="empty-state-sub">Click Analyze Business below to generate ad copy rules</span>
            </div>
          </div>
        )}

        {/* Competitors */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Competitors</span>
            {editing && (
              <button className="btn btn-secondary" onClick={handleAddCompetitor}>
                Add Competitor
              </button>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            {editing ? (
              <>
                {competitors.map((c, index) => (
                  <div key={index} className="copy-item" style={{ marginBottom: 12 }}>
                    <div style={{ flex: 1, display: 'grid', gap: 8 }}>
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
                  </div>
                ))}
                {competitors.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    No competitors added yet. Click &quot;Add Competitor&quot; to get started.
                  </div>
                )}
              </>
            ) : clientCompetitors.length > 0 ? (
              clientCompetitors.map((c, index) => (
                <div key={index} className="copy-item" style={{ marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{c.website}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{c.notes}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
                <span className="empty-state-text">No competitors found</span>
                <span className="empty-state-sub">Not yet analyzed -- click Analyze Business below</span>
              </div>
            )}
          </div>
        </div>

        {/* Image Assets Section */}
        <div className="card">
          <div className="card-title">Image Assets</div>
          <div style={{ marginTop: 16 }}>
            {mediaAssets.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {mediaAssets.map(asset => (
                  <div key={asset.id} style={{
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                  }}>
                    <div style={{ height: 120, position: 'relative' }}>
                      <img
                        src={asset.file_url}
                        alt={asset.role}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: asset.role === 'hero_image' ? '#8b5cf6' : asset.role === 'parallax' ? '#3b82f6' : 'var(--text-muted)',
                          background: asset.role === 'hero_image' ? 'rgba(139,92,246,0.12)' : asset.role === 'parallax' ? 'rgba(59,130,246,0.12)' : 'var(--bg-input)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          {asset.role === 'hero_image' ? 'Hero' : asset.role}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {asset.style || ((asset.metadata as Record<string, unknown>)?.source === 'uploaded' ? 'Uploaded' : 'AI')}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(asset.created_at).toLocaleDateString()}
                      </div>
                      {canEdit && (
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this asset?')) return
                            await (await import('@/lib/supabase')).supabase.from('media_assets').delete().eq('id', asset.id)
                            if (asset.storage_path) {
                              await (await import('@/lib/supabase')).supabase.storage.from('client-assets').remove([asset.storage_path])
                            }
                            if (client) refreshMediaAssets(client.id)
                          }}
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
                <span className="empty-state-text">No image assets yet</span>
                <span className="empty-state-sub">Generate or upload images in the Landing Page Builder</span>
              </div>
            )}
          </div>
        </div>

        {/* Re-analyze Section (team only) */}
        {canEdit && (
          <div className="card">
            <div className="card-title">Re-analyze Business</div>
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">New Call Notes / Additional Information</label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder="Paste new call transcripts, notes, or any additional business information to re-run AI analysis..."
                  value={reanalyzeNotes}
                  onChange={(e) => setReanalyzeNotes(e.target.value)}
                />
              </div>
              {reanalyzing && (
                <div style={{ padding: 16, background: 'var(--surface-hover, #f0f4ff)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>AI is analyzing your business...</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>Processing...</div>
                </div>
              )}
              <div>
                <button
                  className="btn btn-primary"
                  onClick={handleReanalyze}
                  disabled={reanalyzing || !reanalyzeNotes.trim()}
                >
                  {reanalyzing ? 'Processing...' : 'Re-analyze Business'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
