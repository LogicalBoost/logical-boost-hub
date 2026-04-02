'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'

export default function ClientSettingsPage() {
  const { profile, signOut } = useAuth()
  const { client } = useAppStore()
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  if (!client) return null

  async function handlePasswordChange() {
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      showToast(error.message)
    } else {
      showToast('Password updated successfully')
      setNewPassword('')
      setChangingPassword(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Settings</h1>
          <p className="page-subtitle">Manage your account</p>
        </div>
      </div>

      {/* Account info */}
      <div className="funnel-section-card" style={{ marginBottom: 24 }}>
        <div className="funnel-section-header">
          <h3>Account Information</h3>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px 16px', fontSize: 14 }}>
            <div style={{ color: 'var(--text-muted)' }}>Name</div>
            <div style={{ color: 'var(--text-primary)' }}>{profile?.name || 'N/A'}</div>
            <div style={{ color: 'var(--text-muted)' }}>Email</div>
            <div style={{ color: 'var(--text-primary)' }}>{profile?.email || 'N/A'}</div>
            <div style={{ color: 'var(--text-muted)' }}>Organization</div>
            <div style={{ color: 'var(--text-primary)' }}>{client.name}</div>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="funnel-section-card" style={{ marginBottom: 24 }}>
        <div className="funnel-section-header">
          <h3>Security</h3>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {!changingPassword ? (
            <button
              onClick={() => setChangingPassword(true)}
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
            >
              Change Password
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, maxWidth: 300 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                />
              </div>
              <button
                onClick={handlePasswordChange}
                disabled={saving}
                className="btn btn-primary"
                style={{ fontSize: 13 }}
              >
                {saving ? 'Saving...' : 'Update'}
              </button>
              <button
                onClick={() => { setChangingPassword(false); setNewPassword('') }}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div className="funnel-section-card">
        <div style={{ padding: '16px 20px' }}>
          <button
            onClick={signOut}
            className="btn"
            style={{
              fontSize: 13,
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'none',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
