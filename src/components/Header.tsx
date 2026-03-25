'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { useAuth } from './AuthProvider'

export default function Header() {
  const { client, allClients, loadAllClients, switchClient, setUserRole } = useAppStore()
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const restoredRef = useRef(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Sync auth profile role to store
  useEffect(() => {
    if (profile?.role) {
      setUserRole(profile.role)
    }
  }, [profile, setUserRole])

  useEffect(() => {
    loadAllClients().then((clients) => {
      // Auto-restore last selected client from localStorage
      if (!restoredRef.current && clients.length > 0) {
        restoredRef.current = true
        try {
          const savedId = localStorage.getItem('lbh_selected_client_id')
          if (savedId && clients.some(c => c.id === savedId)) {
            switchClient(savedId)
          } else if (clients.length === 1) {
            switchClient(clients[0].id)
          }
        } catch { /* storage unavailable */ }
      }
    })
  }, [loadAllClients, switchClient])

  async function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === '__new__') {
      router.push('/business-overview/')
      return
    }
    if (value) {
      await switchClient(value)
    }
  }

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'User'
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <header className="header">
      <div className="client-switcher">
        <label>Client:</label>
        <select
          value={client?.id || ''}
          onChange={handleClientChange}
          style={{ minWidth: 220 }}
        >
          {!client && <option value="">Select a client...</option>}
          {allClients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="__new__">+ Add New Client</option>
        </select>
      </div>
      <div className="user-menu" style={{ position: 'relative' }}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          <span className="user-name">{displayName}</span>
          <div className="user-avatar">{initials}</div>
        </button>

        {showUserMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setShowUserMenu(false)}
            />
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, minWidth: 200, zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{displayName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{profile?.email}</div>
                <div style={{ marginTop: 4 }}>
                  <span className="tag" style={{ fontSize: 11 }}>{profile?.role || 'admin'}</span>
                </div>
              </div>
              <div style={{ padding: 4 }}>
                <button
                  onClick={() => { setShowUserMenu(false); router.push('/settings/') }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', background: 'none', border: 'none',
                    color: 'var(--text-primary)', cursor: 'pointer', borderRadius: 4,
                    fontSize: 13,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  &#9881; Account Settings
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); signOut() }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', background: 'none', border: 'none',
                    color: '#ef4444', cursor: 'pointer', borderRadius: 4,
                    fontSize: 13,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  &#10140; Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
