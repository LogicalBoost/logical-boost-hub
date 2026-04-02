'use client'

import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { useAuth } from '@/components/AuthProvider'

export default function ClientDashboardPage() {
  const { client, avatars, offers, copyComponents, publishedPages } = useAppStore()
  const { profile } = useAuth()

  const approvedAvatars = avatars.filter(a => a.status === 'approved').length
  const approvedOffers = offers.filter(o => o.status === 'approved').length
  const livePages = publishedPages.filter(p => p.status === 'published').length

  if (!client) return null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {profile?.name || client.name}</h1>
          <p className="page-subtitle">{client.name} dashboard</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="funnel-stats-bar" style={{ marginBottom: 24 }}>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{approvedAvatars}</div>
          <div className="funnel-stat-label">Audiences</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{approvedOffers}</div>
          <div className="funnel-stat-label">Offers</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{copyComponents.length}</div>
          <div className="funnel-stat-label">Copy Components</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{livePages}</div>
          <div className="funnel-stat-label">Live Pages</div>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Link href="/client/landing-pages/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '24px', display: 'block' }}>
          <h3 style={{ fontSize: 15, marginBottom: 6, color: 'var(--accent)' }}>&#128196; Landing Pages</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {livePages > 0 ? `${livePages} live landing pages` : 'View your landing pages'}
          </p>
        </Link>
        <Link href="/client/settings/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '24px', display: 'block' }}>
          <h3 style={{ fontSize: 15, marginBottom: 6, color: 'var(--accent)' }}>&#9881;&#65039; Settings</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Manage your account and preferences
          </p>
        </Link>
      </div>
    </div>
  )
}
