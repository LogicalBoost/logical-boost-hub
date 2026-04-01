'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { generateAvatars } from '@/lib/api'
import type { Avatar, PublishedPage } from '@/types/database'
import { getAngleLabel, ANGLE_COLORS } from '@/types/database'
import { showToast } from '@/lib/demo-toast'

const HUB_URL = 'https://hub.logicalboost.com'

type StatusFilter = 'all' | 'approved' | 'denied'

export default function AvatarsPage() {
  const { client, avatars, offers, publishedPages, updateAvatar, refreshAvatars, canEdit } = useAppStore()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [showPrompter, setShowPrompter] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [promptText, setPromptText] = useState('')
  const [promptQuantity, setPromptQuantity] = useState(5)

  async function handleGenerateAvatars() {
    if (!client) return
    setGenerating(true)
    setShowPrompter(false)
    try {
      const result = await generateAvatars(client.id, {
        quantity: promptQuantity,
        userPrompt: promptText || undefined,
      })
      await refreshAvatars(client.id)
      showToast(`${result.avatars_created} new avatars generated!`)
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setGenerating(false)
      setPromptText('')
    }
  }

  function openPrompter() {
    setPromptText('')
    setPromptQuantity(5)
    setShowPrompter(true)
  }

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128100;</div>
        <div className="empty-state-text">No client selected.</div>
        <div className="empty-state-sub">
          Select or create a client first.
        </div>
      </div>
    )
  }

  if (avatars.length === 0 && !generating) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Avatars</h1>
            <p className="page-subtitle">Target audience personas that power all campaign copy</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">&#128100;</div>
          <div className="empty-state-text">No avatars yet.</div>
          <div className="empty-state-sub">
            Go to Business Overview to analyze your business and auto-generate initial avatars.
            <br />Or use the AI avatar builder to create them now.
          </div>
          {canEdit && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openPrompter}>
              + Generate Avatars with AI
            </button>
          )}
        </div>

        {/* Prompter Modal */}
        {showPrompter && <AvatarPrompterModal
          promptText={promptText}
          setPromptText={setPromptText}
          promptQuantity={promptQuantity}
          setPromptQuantity={setPromptQuantity}
          onGenerate={handleGenerateAvatars}
          onClose={() => setShowPrompter(false)}
          existingCount={0}
        />}
      </div>
    )
  }

  // Extract unique avatar categories from avatar_type field
  const categories = useMemo(() => {
    const types = avatars.map(a => a.avatar_type || 'Uncategorized')
    return Array.from(new Set(types)).sort()
  }, [avatars])

  const filtered = avatars
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => categoryFilter === 'all' || (a.avatar_type || 'Uncategorized') === categoryFilter)

  const approvedCount = avatars.filter(a => a.status === 'approved').length

  function handleApprove(id: string) {
    updateAvatar(id, { status: 'approved' })
    showToast('Avatar approved')
    if (selectedAvatar?.id === id) {
      setSelectedAvatar({ ...selectedAvatar, status: 'approved' })
    }
  }

  function handleDeny(id: string) {
    updateAvatar(id, { status: 'denied' })
    showToast('Avatar denied')
    if (selectedAvatar?.id === id) {
      setSelectedAvatar({ ...selectedAvatar, status: 'denied' })
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!client) return
    // Check if avatar has published pages
    const avatarPages = publishedPages.filter(p => p.avatar_id === id)
    if (avatarPages.length > 0) {
      showToast(`Cannot delete: ${avatarPages.length} landing page(s) use this avatar. Archive or remove them first.`)
      setShowDeleteConfirm(null)
      return
    }
    await supabase.from('avatars').delete().eq('id', id)
    setSelectedAvatar(null)
    setShowDeleteConfirm(null)
    await refreshAvatars(client.id)
    showToast('Avatar deleted')
  }

  function getAvatarPages(avatarId: string): PublishedPage[] {
    return publishedPages.filter(p => p.avatar_id === avatarId && p.status === 'published')
  }

  function getOfferName(offerId: string | null): string {
    if (!offerId) return 'Unknown Offer'
    const offer = offers.find(o => o.id === offerId)
    return offer?.name || 'Unknown Offer'
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Avatars</h1>
            <p className="page-subtitle">
              {approvedCount} approved avatar{approvedCount !== 1 ? 's' : ''} &bull; {avatars.length} total
            </p>
          </div>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={openPrompter}
              disabled={generating}
            >
              {generating ? 'Generating...' : '+ Add Avatars'}
            </button>
          )}
        </div>
      </div>

      {/* Generating overlay */}
      {generating && (
        <div className="card" style={{ marginBottom: 16, padding: '20px 24px', textAlign: 'center' }}>
          <div className="generating-spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            AI is building your avatars...
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Creating detailed audience personas with pain points, motivations, objections, and messaging strategy.
          </div>
        </div>
      )}

      {/* Status Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['all', 'approved', 'denied'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'all' ? ` (${avatars.length})` : ` (${avatars.filter(a => a.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Category Filters */}
      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${categoryFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCategoryFilter('all')}
            style={{ fontSize: 12 }}
          >
            All Types
          </button>
          {categories.map((cat) => {
            const count = avatars.filter(a => (a.avatar_type || 'Uncategorized') === cat).length
            return (
              <button
                key={cat}
                className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCategoryFilter(cat)}
                style={{ fontSize: 12 }}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div className="card-grid">
        {filtered
          .sort((a, b) => {
            // Prioritized avatars first (priority > 0), then by priority number (1 highest)
            if (a.priority && b.priority) return a.priority - b.priority
            if (a.priority) return -1
            if (b.priority) return 1
            return 0
          })
          .map((avatar) => (
          <div
            key={avatar.id}
            className="card"
            style={{ cursor: 'pointer', borderLeft: avatar.priority ? `3px solid var(--accent)` : undefined }}
            onClick={() => setSelectedAvatar(avatar)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {avatar.priority ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {avatar.priority}
                  </span>
                ) : null}
                <div className="card-title">{avatar.name}</div>
              </div>
              <span
                className={`badge ${
                  avatar.status === 'approved' ? 'badge-approved' : 'badge-denied'
                }`}
              >
                {avatar.status}
              </span>
            </div>
            <div className="card-meta">{avatar.avatar_type}</div>
            <div className="card-body">
              {avatar.pain_points && (
                <p style={{ marginBottom: '8px' }}>
                  {avatar.pain_points.length > 120
                    ? avatar.pain_points.slice(0, 120) + '...'
                    : avatar.pain_points}
                </p>
              )}
              {avatar.recommended_angles && avatar.recommended_angles.length > 0 && (
                <div className="tag-list">
                  {avatar.recommended_angles.map((angle) => {
                    const color = ANGLE_COLORS[angle] || '#6b7280'
                    return (
                      <span key={angle} className="angle-badge" style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}>
                        {getAngleLabel(angle)}
                      </span>
                    )
                  })}
                </div>
              )}
              {/* Landing page thumbnails for this avatar */}
              {getAvatarPages(avatar.id).length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Landing Pages
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    {getAvatarPages(avatar.id).map(page => {
                      const pageUrl = `${HUB_URL}/p/${page.client_slug}/${page.slug}`
                      const heroImg = page.media_assets?.hero_image
                      const brandColors = page.brand_kit_snapshot as Record<string, string> | null
                      const primaryColor = brandColors?.primary_color || '#1a365d'
                      return (
                        <a
                          key={page.id}
                          href={pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`/${page.slug} — ${getOfferName(page.offer_id)}`}
                          style={{
                            display: 'block', width: 80, textDecoration: 'none',
                            borderRadius: 6, overflow: 'hidden',
                            border: '1px solid var(--border)',
                            transition: 'border-color 0.15s, transform 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.transform = 'translateY(-2px)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)'
                            e.currentTarget.style.transform = 'translateY(0)'
                          }}
                        >
                          <div style={{
                            width: '100%', height: 56, position: 'relative',
                            background: heroImg ? `url(${heroImg}) center/cover` : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {!heroImg && (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            )}
                          </div>
                          <div style={{
                            padding: '4px 6px', background: 'var(--bg-secondary)',
                            fontSize: 10, color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            textAlign: 'center',
                          }}>
                            /{page.slug}
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Prompter Modal */}
      {showPrompter && <AvatarPrompterModal
        promptText={promptText}
        setPromptText={setPromptText}
        promptQuantity={promptQuantity}
        setPromptQuantity={setPromptQuantity}
        onGenerate={handleGenerateAvatars}
        onClose={() => setShowPrompter(false)}
        existingCount={avatars.length}
      />}

      {/* Detail Modal */}
      {selectedAvatar && (
        <div className="modal-overlay" onClick={() => setSelectedAvatar(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedAvatar.name}</h2>
              <button
                className="modal-close"
                onClick={() => setSelectedAvatar(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">Type</div>
                  <div className="detail-value">{selectedAvatar.avatar_type}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">
                    <span
                      className={`badge ${
                        selectedAvatar.status === 'approved'
                          ? 'badge-approved'
                          : 'badge-denied'
                      }`}
                    >
                      {selectedAvatar.status}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Description</div>
                  <div className="detail-value">
                    {selectedAvatar.description || 'N/A'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Pain Points</div>
                  <div className="detail-value">
                    {selectedAvatar.pain_points || 'N/A'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Motivations</div>
                  <div className="detail-value">
                    {selectedAvatar.motivations || 'N/A'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Objections</div>
                  <div className="detail-value">
                    {selectedAvatar.objections || 'N/A'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Desired Outcome</div>
                  <div className="detail-value">
                    {selectedAvatar.desired_outcome || 'N/A'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Trigger Events</div>
                  <div className="detail-value">
                    {selectedAvatar.trigger_events || 'N/A'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Messaging Style</div>
                  <div className="detail-value">
                    {selectedAvatar.messaging_style || 'N/A'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Preferred Platforms</div>
                  <div className="detail-value">
                    {selectedAvatar.preferred_platforms &&
                    selectedAvatar.preferred_platforms.length > 0 ? (
                      <div className="tag-list">
                        {selectedAvatar.preferred_platforms.map((p) => (
                          <span key={p} className="tag">{p}</span>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Recommended Angles</div>
                  <div className="detail-value">
                    {selectedAvatar.recommended_angles &&
                    selectedAvatar.recommended_angles.length > 0 ? (
                      <div className="tag-list">
                        {selectedAvatar.recommended_angles.map((a) => {
                          const color = ANGLE_COLORS[a] || '#6b7280'
                          return (
                            <span key={a} className="angle-badge" style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}>
                              {getAngleLabel(a)}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>

                {/* Landing Pages for this avatar */}
                {getAvatarPages(selectedAvatar.id).length > 0 && (
                  <div className="detail-item">
                    <div className="detail-label">Landing Pages</div>
                    <div className="detail-value">
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {getAvatarPages(selectedAvatar.id).map(page => {
                          const pageUrl = `${HUB_URL}/p/${page.client_slug}/${page.slug}`
                          const heroImg = page.media_assets?.hero_image
                          const brandColors = page.brand_kit_snapshot as Record<string, string> | null
                          const primaryColor = brandColors?.primary_color || '#1a365d'
                          return (
                            <div key={page.id} style={{ width: 140 }}>
                              <a
                                href={pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'block', borderRadius: 8, overflow: 'hidden',
                                  border: '1px solid var(--border)', textDecoration: 'none',
                                  transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--accent)'
                                  e.currentTarget.style.transform = 'translateY(-2px)'
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--border)'
                                  e.currentTarget.style.transform = 'translateY(0)'
                                  e.currentTarget.style.boxShadow = 'none'
                                }}
                              >
                                <div style={{
                                  width: '100%', height: 90, position: 'relative',
                                  background: heroImg ? `url(${heroImg}) center/cover` : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {!heroImg && (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
                                      <rect x="3" y="3" width="18" height="18" rx="2" />
                                      <circle cx="8.5" cy="8.5" r="1.5" />
                                      <polyline points="21 15 16 10 5 21" />
                                    </svg>
                                  )}
                                </div>
                                <div style={{
                                  padding: '6px 8px', background: 'var(--bg-secondary)',
                                }}>
                                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>
                                    /{page.slug}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {getOfferName(page.offer_id)}
                                  </div>
                                </div>
                              </a>
                              <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center' }}>
                                <button
                                  onClick={() => window.open(pageUrl, '_blank', 'width=390,height=844,scrollbars=yes')}
                                  title="Mobile preview"
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                                    color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center',
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                    <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
                                  </svg>
                                </button>
                                <a href={pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', padding: 3, display: 'inline-flex', alignItems: 'center' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ flexDirection: 'column', gap: 12 }}>
              {/* Priority Ranking */}
              {canEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Priority:</span>
                  {[1, 2, 3, 4, 5].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        const newPriority = selectedAvatar.priority === p ? 0 : p
                        updateAvatar(selectedAvatar.id, { priority: newPriority })
                        setSelectedAvatar({ ...selectedAvatar, priority: newPriority })
                        showToast(newPriority ? `Priority set to #${newPriority}` : 'Priority removed')
                      }}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        border: selectedAvatar.priority === p ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: selectedAvatar.priority === p ? 'var(--accent)' : 'transparent',
                        color: selectedAvatar.priority === p ? '#fff' : 'var(--text-secondary)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  {selectedAvatar.priority ? (
                    <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 4 }}>
                      #{selectedAvatar.priority} priority
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                      Unranked
                    </span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                {canEdit && (
                  <div style={{ position: 'relative' }}>
                    {showDeleteConfirm === selectedAvatar.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <span style={{ fontSize: 12, color: '#ef4444' }}>Delete this avatar?</span>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDelete(selectedAvatar.id)}
                          style={{ background: '#ef4444', color: '#fff', fontSize: 11, padding: '3px 10px', border: 'none' }}
                        >
                          Yes, Delete
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setShowDeleteConfirm(null)}
                          style={{ fontSize: 11, padding: '3px 10px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(selectedAvatar.id)}
                        title="Delete avatar"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: 6, borderRadius: 6,
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDeny(selectedAvatar.id)}
                  >
                    Deny
                  </button>
                  {canEdit && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleApprove(selectedAvatar.id)}
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Avatar AI Prompter Modal ────────────────────────────────────────────
function AvatarPrompterModal({
  promptText,
  setPromptText,
  promptQuantity,
  setPromptQuantity,
  onGenerate,
  onClose,
  existingCount,
}: {
  promptText: string
  setPromptText: (v: string) => void
  promptQuantity: number
  setPromptQuantity: (v: number) => void
  onGenerate: () => void
  onClose: () => void
  existingCount: number
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal prompter-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">Generate Avatars with AI</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {existingCount > 0 && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--accent-muted)', fontSize: 13, color: 'var(--text-secondary)' }}>
              You already have {existingCount} avatar{existingCount !== 1 ? 's' : ''}. AI will create new, distinct personas that don&apos;t overlap with existing ones.
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">How many avatars?</label>
            <select
              className="form-input"
              value={promptQuantity}
              onChange={(e) => setPromptQuantity(Number(e.target.value))}
            >
              <option value={3}>3 avatars</option>
              <option value={5}>5 avatars</option>
              <option value={8}>8 avatars</option>
              <option value={10}>10 avatars</option>
              <option value={15}>15 avatars</option>
              <option value={20}>20 avatars</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Direction for AI (optional)</label>
            <textarea
              className="form-input"
              rows={5}
              placeholder={`Examples:\n\n"Generate 10 more avatars for a plumbing company. Include people in emergency situations, people doing renovations, commercial property managers, and landlords."\n\n"Add avatars for people who are price-shopping, people who got a bad experience elsewhere, and first-time homeowners who don't know anything about plumbing."\n\n"Focus on high-income homeowners who want premium service and don't care about price."`}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Leave blank and AI will analyze your business data to suggest the most relevant avatars.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onGenerate}>
            Generate {promptQuantity} Avatars
          </button>
        </div>
      </div>
    </div>
  )
}
