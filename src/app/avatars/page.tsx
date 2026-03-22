'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { Avatar } from '@/types/database'
import { showToast } from '@/lib/demo-toast'

type StatusFilter = 'all' | 'approved' | 'denied'

export default function AvatarsPage() {
  const { client, avatars, updateAvatar, refreshAvatars } = useAppStore()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)

  if (!client || !avatars || avatars.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👤</div>
        <div className="empty-state-text">No avatars yet.</div>
        <div className="empty-state-sub">
          Go to Business Overview to analyze your business — AI will generate your initial avatars.
        </div>
      </div>
    )
  }

  const filtered = filter === 'all'
    ? avatars
    : avatars.filter((a) => a.status === filter)

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

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Avatars</h1>
        <p className="page-subtitle">
          Review and manage your target audience avatars
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['all', 'approved', 'denied'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
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
            <div className="card-title">{avatar.name}</div>
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
                  {avatar.recommended_angles.map((angle) => (
                    <span key={angle} className="tag">{angle}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="card-actions">
              <span
                className={`badge ${
                  avatar.status === 'approved' ? 'badge-approved' : 'badge-denied'
                }`}
              >
                {avatar.status}
              </span>
            </div>
          </div>
        ))}
      </div>

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
                        {selectedAvatar.recommended_angles.map((a) => (
                          <span key={a} className="tag">{a}</span>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeny(selectedAvatar.id)}
              >
                Deny
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleApprove(selectedAvatar.id)}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
