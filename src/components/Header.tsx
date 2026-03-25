'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'

export default function Header() {
  const { client, allClients, loadAllClients, switchClient } = useAppStore()
  const router = useRouter()
  const restoredRef = useRef(false)

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
            // Only one client? Auto-select it
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
      <div className="user-menu">
        <span className="user-name">Admin</span>
        <div className="user-avatar">A</div>
      </div>
    </header>
  )
}
