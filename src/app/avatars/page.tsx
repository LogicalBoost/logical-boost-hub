'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import type { Avatar } from '@/types/database'
import { showToast } from '@/lib/demo-toast'

type StatusFilter = 'all' | 'approved' | 'denied'

const EMPTY_FORM = {
  name: '',
  avatar_type: '',
  description: '',
  pain_points: '',
  motivations: '',
  objections: '',
  desired_outcome: '',
  trigger_events: '',
  messaging_style: '',
  preferred_platforms: '',
  recommended_angles: '',
}

export default function AvatarsPage() {
  const { client, avatars, updateAvatar, refreshAvatars } = useAppStore()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function handleAddAvatar(e: React.FormEvent) {
    e.preventDefault()
    if (!client || !form.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('avatars').insert({
      client_id: client.id,
      name: form.name.trim(),
      avatar_type: form.avatar_type.trim() || null,
      description: form.description.trim() || null,
      pain_points: form.pain_points.trim() || null,
      motivations: form.motivations.trim() || null,
      objections: form.objections.trim() || null,
      desired_outcome: form.desired_outcome.trim() || null,
      trigger_events: form.trigger_events.trim() || null,
      messaging_style: form.messaging_style.trim() || null,
      preferred_platforms: form.preferred_platforms.trim()
        ? form.preferred_platforms.split(',').map(s => s.trim()).filter(Boolean)
        : null,
      recommended_angles: form.recommended_angles.trim()
        ? form.recommended_angles.split(',').map(s => s.trim()).filter(Boolean)
        : null,
      status: 'approved',
    })
    setSaving(false)
    if (error) {
      showToast('Failed to add avatar: ' + error.message)
      return
    }
    showToast('Avatar added')
    setForm(EMPTY_FORM)
    setShowAddForm(false)
    await refreshAvatars(client.id)
  }

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👤</div>
        <div className="empty-state-text">No client selected.</div>
        <div className="empty-state-sub">
          Select or create a client first.
        </div>
      </div>
    )
  }

  if (avatars.length === 0 && !showAddForm) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👤</div>
        <div className="empty-state-text">No avatars yet.</div>
        <div className="empty-state-sub">
          Go to Business Overview to analyze your business — AI will generate your initial avatars.
          <br />Or add one manually.
        </div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAddForm(true)}>
          + Add Avatar Manually
        </button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Avatars</h1>
            <p className="page-subtitle">
              Review and manage your target audience avatars
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            + Add Avatar
          </button>
        </div>
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

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Avatar</h2>
              <button className="modal-close" onClick={() => setShowAddForm(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddAvatar}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Budget-Conscious Homeowner" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Avatar Type</label>
                  <input className="form-input" value={form.avatar_type} onChange={e => setForm({ ...form, avatar_type: e.target.value })} placeholder="e.g. Residential, Commercial, B2B" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description of this audience segment" />
                </div>
                <div className="form-group">
                  <label className="form-label">Pain Points</label>
                  <textarea className="form-textarea" rows={2} value={form.pain_points} onChange={e => setForm({ ...form, pain_points: e.target.value })} placeholder="What problems do they face?" />
                </div>
                <div className="form-group">
                  <label className="form-label">Motivations</label>
                  <textarea className="form-textarea" rows={2} value={form.motivations} onChange={e => setForm({ ...form, motivations: e.target.value })} placeholder="What drives their decisions?" />
                </div>
                <div className="form-group">
                  <label className="form-label">Objections</label>
                  <textarea className="form-textarea" rows={2} value={form.objections} onChange={e => setForm({ ...form, objections: e.target.value })} placeholder="Common objections or hesitations" />
                </div>
                <div className="form-group">
                  <label className="form-label">Desired Outcome</label>
                  <textarea className="form-textarea" rows={2} value={form.desired_outcome} onChange={e => setForm({ ...form, desired_outcome: e.target.value })} placeholder="What result are they looking for?" />
                </div>
                <div className="form-group">
                  <label className="form-label">Trigger Events</label>
                  <textarea className="form-textarea" rows={2} value={form.trigger_events} onChange={e => setForm({ ...form, trigger_events: e.target.value })} placeholder="What events prompt them to take action?" />
                </div>
                <div className="form-group">
                  <label className="form-label">Messaging Style</label>
                  <input className="form-input" value={form.messaging_style} onChange={e => setForm({ ...form, messaging_style: e.target.value })} placeholder="e.g. Direct, empathetic, authoritative" />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Platforms (comma-separated)</label>
                  <input className="form-input" value={form.preferred_platforms} onChange={e => setForm({ ...form, preferred_platforms: e.target.value })} placeholder="e.g. Facebook, Google, Instagram" />
                </div>
                <div className="form-group">
                  <label className="form-label">Recommended Angles (comma-separated)</label>
                  <input className="form-input" value={form.recommended_angles} onChange={e => setForm({ ...form, recommended_angles: e.target.value })} placeholder="e.g. pain_point, social_proof, urgency" />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Add Avatar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
