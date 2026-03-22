'use client'

import { useAppStore } from '@/lib/store'

export default function Header() {
  const { client } = useAppStore()

  return (
    <header className="header">
      <div className="client-switcher">
        <label>Client:</label>
        {client ? (
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {client.name}
          </span>
        ) : (
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>No client selected</span>
        )}
      </div>
      <div className="user-menu">
        <span className="user-name">Admin</span>
        <div className="user-avatar">A</div>
      </div>
    </header>
  )
}
