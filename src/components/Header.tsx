'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { useAuth } from './AuthProvider'

export default function Header() {
  const { client, allClients, loadAllClients, switchClient, setUserRole, isClientRole } = useAppStore()
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

  // Track whether createClient has set a client before initial restore runs
  const clientRef = useRef(client)
  clientRef.current = client

  useEffect(() => {
    if (!profile) return // Wait for profile to load
    loadAllClients().then((clients) => {
      if (!restoredRef.current) {
        restoredRef.current = true
        if (clientRef.current) return // A client was already set (e.g., just created)

        // Client-role users: auto-select their assigned client
        if (profile.role === 'client') {
          if (profile.client_id) {
            const assigned = clients.find(c => c.id === profile.client_id)
            if (assigned) {
              switchClient(assigned.id)
              return
            }
          }
          // Fallback: if only one client visible, select it
          if (clients.length === 1) {
            switchClient(clients[0].id)
            return
          }
        }

        // Agency roles: restore from localStorage or auto-select
        if (clients.length > 0) {
          try {
            const savedId = localStorage.getItem('lbh_selected_client_id')
            if (savedId && clients.some(c => c.id === savedId)) {
              switchClient(savedId)
            } else if (clients.length === 1) {
              switchClient(clients[0].id)
            }
          } catch { /* storage unavailable */ }
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAllClients, switchClient, profile])

  async function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === '__new__') {
      router.push('/business-overview/?new=1')
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
        {/* Show client logo thumbnail if available */}
        {client?.logo_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={client.logo_url}
            alt=""
            style={{
              width: 28, height: 28, objectFit: 'contain',
              borderRadius: 4, background: 'rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}
          />
        )}
        {isClientRole ? (
          /* Client role: just show their client name, no switcher */
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
            {client?.name || 'My Account'}
          </span>
        ) : (
          /* Agency roles: full client switcher dropdown */
          <>
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
          </>
        )}
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
              background: '#141e1b', border: '1px solid var(--border)',
              borderRadius: 8, minWidth: 200, zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{displayName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{profile?.email}</div>
                {!isClientRole && (
                  <div style={{ marginTop: 4 }}>
                    <span className="tag" style={{ fontSize: 11 }}>{profile?.role || 'admin'}</span>
                  </div>
                )}
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
