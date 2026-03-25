'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { generateAvatars } from '@/lib/api'
import type { Avatar } from '@/types/database'
import { getAngleLabel, ANGLE_COLORS } from '@/types/database'
import { showToast } from '@/lib/demo-toast'

type StatusFilter = 'all' | 'approved' | 'denied'

export default function AvatarsPage() {
  const { client, avatars, updateAvatar, refreshAvatars, canEdit } = useAppStore()
  const [filter, setFilter] = useState<StatusFilter>('all')
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

  const filtered = filter === 'all'
    ? avatars
    : avatars.filter((a) => a.status === filter)

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

  async function handleDelete(id: string) {
    if (!confirm('Delete this avatar? This cannot be undone.')) return
    if (!client) return
    await supabase.from('avatars').delete().eq('id', id)
    setSelectedAvatar(null)
    await refreshAvatars(client.id)
    showToast('Avatar deleted')
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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
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

      <div className="card-grid">
        {filtered.map((avatar) => (
          <div
            key={avatar.id}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedAvatar(avatar)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title">{avatar.name}</div>
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
              </div>
            </div>
            <div className="modal-footer">
              {canEdit && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(selectedAvatar.id)}
                >
                  Delete
                </button>
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
