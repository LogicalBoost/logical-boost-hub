'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { discoverCompetitors, analyzeCompetitorPages } from '@/lib/api'
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
  const { client, competitors, canEdit, loadClientData } = useAppStore()
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
  const [discovering, setDiscovering] = useState(false)
  const [analyzingPages, setAnalyzingPages] = useState(false)
  const [pageAnalyses, setPageAnalyses] = useState<Array<Record<string, unknown>>>([])
  const [patternSummary, setPatternSummary] = useState('')
  const [opportunities, setOpportunities] = useState<string[]>([])
  const [discoveryResult, setDiscoveryResult] = useState<{
    market_overview?: string
    competitors_added?: number
    keyword_opportunities?: string[]
    competitive_gaps?: string[]
  } | null>(null)

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
    // Refresh competitor data via store
    if (client) await loadClientData(client.id)
  }

  async function handleDiscoverCompetitors() {
    if (!client) return
    setDiscovering(true)
    setDiscoveryResult(null)
    try {
      const result = await discoverCompetitors(client.id)
      setDiscoveryResult(result)
      if (result.competitors_added > 0) {
        showToast(`Discovered ${result.competitors_added} competitors!`)
        await loadClientData(client.id)
      } else {
        showToast('No new competitors found')
      }
    } catch (err) {
      showToast('Discovery failed: ' + (err as Error).message)
    } finally {
      setDiscovering(false)
    }
  }

  async function handleAnalyzePages() {
    if (!client) return
    setAnalyzingPages(true)
    try {
      const result = await analyzeCompetitorPages(client.id)
      if (result.analyses) {
        setPageAnalyses(result.analyses)
        setPatternSummary(result.pattern_summary || '')
        setOpportunities(result.opportunities || [])
        showToast(`Analyzed ${result.analyses_added} competitor pages!`)
        await loadClientData(client.id)
      }
    } catch (err) {
      showToast('Page analysis failed: ' + (err as Error).message)
    } finally {
      setAnalyzingPages(false)
    }
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
              <button
                className="btn btn-primary"
                onClick={handleDiscoverCompetitors}
                disabled={discovering}
              >
                {discovering ? 'Discovering...' : '\u{1F916} AI Discover Competitors'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAddForm(true)}>
                + Add Manually
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

      {/* AI Discovery Loading State */}
      {discovering && (
        <div style={{
          padding: 24, marginBottom: 24,
          background: 'var(--bg-hover)', borderRadius: 8, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>{'\u{1F916}'}</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>AI is researching competitors...</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Analyzing {client.name}&apos;s market, industry, and services to identify competitors. This may take 15-30 seconds.
          </div>
        </div>
      )}

      {/* Discovery Results Summary */}
      {discoveryResult && !discovering && (
        <div style={{
          padding: 16, marginBottom: 24,
          background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)',
        }}>
          {discoveryResult.market_overview && (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              {discoveryResult.market_overview}
            </div>
          )}
          {discoveryResult.keyword_opportunities && discoveryResult.keyword_opportunities.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Target Keywords:</div>
              <div className="tag-list">
                {discoveryResult.keyword_opportunities.map((kw, i) => (
                  <span key={i} className="tag">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {discoveryResult.competitive_gaps && discoveryResult.competitive_gaps.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Market Gaps:</div>
              <div className="tag-list">
                {discoveryResult.competitive_gaps.map((gap, i) => (
                  <span key={i} className="tag" style={{ background: 'var(--accent-secondary)' }}>{gap}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          {/* Analyze button */}
          {canEdit && uniqueCompetitors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <button
                className="btn btn-primary"
                onClick={handleAnalyzePages}
                disabled={analyzingPages}
              >
                {analyzingPages ? 'Analyzing competitor pages...' : '\u{1F50D} AI Analyze Competitor Pages'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>
                Visits competitor websites and extracts above-fold patterns, CTAs, page structure
              </span>
            </div>
          )}

          {/* Loading state */}
          {analyzingPages && (
            <div style={{
              padding: 24, marginBottom: 20,
              background: 'var(--bg-hover)', borderRadius: 8, textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{'\u{1F50D}'}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Analyzing competitor landing pages...</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                AI is visiting {uniqueCompetitors.length} competitor websites and analyzing their above-fold content, page structure, offers, and conversion tactics. This may take 30-60 seconds.
              </div>
            </div>
          )}

          {/* Pattern Summary */}
          {patternSummary && (
            <div style={{
              padding: 16, marginBottom: 20,
              background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Pattern Summary</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{patternSummary}</div>
              {opportunities.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Opportunities:</div>
                  <div className="tag-list">
                    {opportunities.map((opp, i) => (
                      <span key={i} className="tag" style={{ background: 'var(--accent-secondary)' }}>{opp}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Page Analyses */}
          {pageAnalyses.length > 0 ? (
            <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
              {pageAnalyses.map((analysis, i) => {
                const aboveFold = analysis.above_fold as Record<string, unknown> | undefined
                const pageStructure = analysis.page_structure as Record<string, unknown> | undefined
                const offerAnalysis = analysis.offer_analysis as Record<string, unknown> | undefined
                const tactics = analysis.conversion_tactics as Record<string, unknown> | undefined
                const notes = analysis.strategic_notes as Record<string, unknown> | undefined
                return (
                  <div key={i} className="funnel-section-card">
                    <div className="funnel-section-header">
                      <h3>{String(analysis.competitor_name || 'Competitor')}</h3>
                      {analysis.website ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{String(analysis.website)}</span>
                      ) : null}
                    </div>
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Above Fold */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>ABOVE THE FOLD</div>
                          {aboveFold?.headline ? <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{String(aboveFold.headline)}</div> : null}
                          {aboveFold?.subheadline ? <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{String(aboveFold.subheadline)}</div> : null}
                          {aboveFold?.cta_text ? (
                            <div style={{ marginBottom: 6 }}>
                              <span className="tag" style={{ background: 'var(--accent)' }}>CTA: {String(aboveFold.cta_text)}</span>
                            </div>
                          ) : null}
                          <div className="tag-list" style={{ marginTop: 4 }}>
                            {aboveFold?.hero_type ? <span className="tag">{String(aboveFold.hero_type)}</span> : null}
                            {aboveFold?.urgency ? <span className="tag" style={{ background: '#ef4444' }}>{String(aboveFold.urgency)}</span> : null}
                          </div>
                        </div>

                        {/* Page Structure */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>PAGE STRUCTURE</div>
                          {pageStructure?.sections && Array.isArray(pageStructure.sections) ? (
                            <div className="tag-list" style={{ marginBottom: 8 }}>
                              {(pageStructure.sections as string[]).map((s, si) => (
                                <span key={si} className="tag" style={{ fontSize: 11 }}>{s}</span>
                              ))}
                            </div>
                          ) : null}
                          {pageStructure?.estimated_length ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Length: {String(pageStructure.estimated_length)}</div>
                          ) : null}
                          {pageStructure?.navigation_style ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nav: {String(pageStructure.navigation_style)}</div>
                          ) : null}
                        </div>

                        {/* Offer Analysis */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>OFFER</div>
                          {offerAnalysis?.primary_offer ? <div style={{ fontSize: 13, marginBottom: 4 }}>{String(offerAnalysis.primary_offer)}</div> : null}
                          <div className="tag-list">
                            {offerAnalysis?.offer_type ? <span className="tag">{String(offerAnalysis.offer_type)}</span> : null}
                            {offerAnalysis?.pricing_visible ? <span className="tag">Pricing Visible</span> : null}
                            {offerAnalysis?.guarantee ? <span className="tag">{String(offerAnalysis.guarantee)}</span> : null}
                          </div>
                        </div>

                        {/* Conversion Tactics */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>CONVERSION TACTICS</div>
                          {tactics?.social_proof_types && Array.isArray(tactics.social_proof_types) ? (
                            <div className="tag-list" style={{ marginBottom: 6 }}>
                              {(tactics.social_proof_types as string[]).map((t, ti) => (
                                <span key={ti} className="tag" style={{ fontSize: 11 }}>{t}</span>
                              ))}
                            </div>
                          ) : null}
                          {tactics?.form_fields ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Form fields: {String(tactics.form_fields)}</div>
                          ) : null}
                        </div>
                      </div>

                      {/* Strategic Notes */}
                      {notes && (
                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            {Array.isArray(notes.strengths) ? (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>STRENGTHS</div>
                                {(notes.strengths as string[]).map((s, si) => (
                                  <div key={si} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{s}</div>
                                ))}
                              </div>
                            ) : null}
                            {Array.isArray(notes.weaknesses) ? (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>WEAKNESSES</div>
                                {(notes.weaknesses as string[]).map((w, wi) => (
                                  <div key={wi} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{w}</div>
                                ))}
                              </div>
                            ) : null}
                            {notes.unique_approach ? (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', marginBottom: 4 }}>UNIQUE APPROACH</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{String(notes.unique_approach)}</div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : !analyzingPages ? (
            <div className="funnel-section-card">
              <div className="funnel-section-header">
                <h3>Above-Fold &amp; Landing Pages</h3>
              </div>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {/* Show stored landing page analyses from competitor_intel */}
                {competitors.filter(c => c.ad_type === 'landing_page').length > 0 ? (
                  <div>
                    {competitors.filter(c => c.ad_type === 'landing_page').map((c, idx) => {
                      let parsed: Record<string, unknown> | null = null
                      try { if (c.content) parsed = JSON.parse(c.content) } catch { /* not json */ }
                      return (
                        <div key={c.id || idx} style={{ textAlign: 'left', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.competitor_name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{c.competitor_website}</div>
                          {parsed ? (
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              {(parsed.above_fold as Record<string, unknown>)?.headline ? (
                                <div>Headline: {String((parsed.above_fold as Record<string, unknown>).headline)}</div>
                              ) : null}
                              {(parsed.above_fold as Record<string, unknown>)?.cta_text ? (
                                <span className="tag" style={{ marginTop: 4 }}>CTA: {String((parsed.above_fold as Record<string, unknown>).cta_text)}</span>
                              ) : null}
                            </div>
                          ) : c.content ? (
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.content}</div>
                          ) : null}
                        </div>
                      )
                    })}
                    {canEdit && (
                      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={handleAnalyzePages} disabled={analyzingPages}>
                        Re-analyze Pages
                      </button>
                    )}
                  </div>
                ) : uniqueCompetitors.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      {uniqueCompetitors.length} competitors discovered. Click the button above to analyze their landing pages.
                    </div>
                  </div>
                ) : (
                  <div>
                    No competitors found yet. Use &quot;AI Discover Competitors&quot; first, then analyze their pages.
                  </div>
                )}
              </div>
            </div>
          ) : null}
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
