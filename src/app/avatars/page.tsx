'use client'

import { useState } from 'react'
import { MOCK_AVATARS } from '@/lib/mock-data'
import { demoAction, showToast } from '@/lib/demo-toast'
import type { Avatar } from '@/types/database'

type StatusFilter = 'all' | 'approved' | 'denied'

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([...MOCK_AVATARS])
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredAvatars = statusFilter === 'all'
    ? avatars
    : avatars.filter((a) => a.status === statusFilter)

  function handleDeny(avatar: Avatar) {
    setAvatars((prev) =>
      prev.map((a) => (a.id === avatar.id ? { ...a, status: 'denied' as const } : a))
    )
    if (selectedAvatar?.id === avatar.id) {
      setSelectedAvatar((prev) => prev ? { ...prev, status: 'denied' as const } : null)
    }
    showToast('Avatar denied')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Avatars</h1>
          <p className="page-subtitle">Target audience profiles for campaign targeting</p>
        </div>
        <button className="btn btn-primary" onClick={() => demoAction('Generate Avatars with AI')}>
          Generate Avatars
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'approved', 'denied'] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            className={`btn btn-sm ${statusFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="card-grid">
        {filteredAvatars.map((avatar) => (
          <div key={avatar.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedAvatar(avatar)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title">{avatar.name}</div>
              <span className={`badge badge-${avatar.status}`}>{avatar.status}</span>
            </div>
            <div className="card-meta">{avatar.avatar_type}</div>
            <div className="card-body" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
              {avatar.pain_points}
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="tag-list">
                {avatar.recommended_angles?.slice(0, 3).map((angle) => (
                  <span key={angle} className="tag">{angle}</span>
                ))}
              </div>
            </div>
            <div className="card-actions">
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedAvatar(avatar) }}>View Details</button>
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); demoAction('Edit Avatar') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeny(avatar) }}>Deny</button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedAvatar && (
        <div className="modal-overlay" onClick={() => setSelectedAvatar(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{selectedAvatar.name}</h2>
                <span className="card-meta">{selectedAvatar.avatar_type}</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedAvatar(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedAvatar.description}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Pain Points</span>
                  <span className="detail-value">{selectedAvatar.pain_points}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Motivations</span>
                  <span className="detail-value">{selectedAvatar.motivations}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Objections</span>
                  <span className="detail-value">{selectedAvatar.objections}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Desired Outcome</span>
                  <span className="detail-value">{selectedAvatar.desired_outcome}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Trigger Events</span>
                  <span className="detail-value">{selectedAvatar.trigger_events}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Messaging Style</span>
                  <span className="detail-value">{selectedAvatar.messaging_style}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Preferred Platforms</span>
                  <div className="tag-list">
                    {selectedAvatar.preferred_platforms?.map((p) => (
                      <span key={p} className="tag">{p}</span>
                    ))}
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Recommended Angles</span>
                  <div className="tag-list">
                    {selectedAvatar.recommended_angles?.map((a) => (
                      <span key={a} className="tag">{a}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={() => handleDeny(selectedAvatar)}>Deny</button>
              <button className="btn btn-secondary" onClick={() => demoAction('Edit Avatar')}>Edit</button>
              <button className="btn btn-primary" onClick={() => setSelectedAvatar(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
