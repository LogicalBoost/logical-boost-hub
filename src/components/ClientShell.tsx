'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { useAuth } from './AuthProvider'

const clientNavItems = [
  { href: '/client/dashboard/', label: 'Dashboard', icon: '◫' },
  { href: '/client/copy/', label: 'Copy', icon: '◬' },
  { href: '/client/landing-pages/', label: 'Landing Pages', icon: '◰' },
  { href: '/client/avatars/', label: 'Avatars', icon: '◪' },
  { href: '/client/offers/', label: 'Offers', icon: '◭' },
  { href: '/client/settings/', label: 'Settings', icon: '◷' },
]

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { client, loadAllClients, switchClient, setUserRole } = useAppStore()
  const { profile, signOut, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const restoredRef = useRef(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Sync role
  useEffect(() => {
    if (profile?.role) {
      setUserRole(profile.role)
    }
  }, [profile, setUserRole])

  // Auto-load client for client-role user
  useEffect(() => {
    if (!profile || restoredRef.current) return
    restoredRef.current = true

    loadAllClients().then((clients) => {
      if (profile.client_id) {
        const assigned = clients.find(c => c.id === profile.client_id)
        if (assigned) {
          switchClient(assigned.id)
          return
        }
      }
      // Fallback: single client
      if (clients.length === 1) {
        switchClient(clients[0].id)
      }
    })
  }, [profile, loadAllClients, switchClient])

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'User'
  const initials = displayName.charAt(0).toUpperCase()

  // Show loading while auth resolves or client data loads
  if (authLoading || !profile) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>&#9881;&#65039;</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>&#9881;&#65039;</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading your account...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="client-app-layout">
      {/* Client sidebar — minimal */}
      <aside className="client-sidebar">
        <div className="client-sidebar-logo">
          {client.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={client.logo_url} alt={client.name} style={{ height: 32, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{client.name}</span>
          )}
        </div>
        <nav className="client-sidebar-nav">
          {clientNavItems.map((item) => {
            const isActive = pathname?.startsWith(item.href.replace(/\/$/, '')) || false
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="client-main-area">
        {/* Client header — just user info + sign out */}
        <header className="client-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {client.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={client.logo_url}
                alt=""
                style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.1)' }}
              />
            )}
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
              {client.name}
            </span>
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
                  </div>
                  <div style={{ padding: 4 }}>
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

        <main className="client-content-area">
          {children}
        </main>
      </div>
    </div>
  )
}
