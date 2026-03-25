'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'

export default function DashboardPage() {
  const { client, avatars, offers, funnelInstances, copyComponents } = useAppStore()

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128640;</div>
        <div className="empty-state-text">Welcome to Logical Boost Hub</div>
        <div className="empty-state-sub">
          Add your first client to begin building AI-powered campaign funnels.
        </div>
        <Link href="/business-overview/" className="btn btn-primary" style={{ marginTop: 24 }}>
          + Add Your First Client
        </Link>
        <div className="empty-state-sub" style={{ marginTop: 12, fontSize: 13 }}>
          Or select an existing client from the dropdown above.
        </div>
      </div>
    )
  }

  const activeFunnels = funnelInstances.filter((fi) => fi.status === 'active').length

  // Build activity feed from recent items
  const activityFeed = useMemo(() => {
    const items: { text: string; time: string; icon: string }[] = []

    // Recent copy components
    const recentCopy = [...copyComponents]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)

    for (const cc of recentCopy) {
      const avatar = avatars.find((a) => (cc.avatar_ids || []).includes(a.id))
      items.push({
        text: `New ${cc.type.replace(/_/g, ' ')} added${avatar ? ` for ${avatar.name} funnel` : ''}`,
        time: cc.created_at,
        icon: '&#128221;',
      })
    }

    // Recent avatars
    for (const a of avatars.slice(-3).reverse()) {
      items.push({
        text: `Avatar "${a.name}" ${a.status === 'approved' ? 'approved' : 'created'}`,
        time: a.created_at,
        icon: '&#128100;',
      })
    }

    // Recent offers
    for (const o of offers.slice(-3).reverse()) {
      items.push({
        text: `Offer "${o.name}" ${o.status === 'approved' ? 'approved' : 'created'}`,
        time: o.created_at,
        icon: '&#127873;',
      })
    }

    // Sort by time descending, take top 10
    items.sort((a, b) => b.time.localeCompare(a.time))
    return items.slice(0, 10)
  }, [copyComponents, avatars, offers])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {client.name}</h1>
          <p className="page-subtitle">Your marketing hub overview</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="funnel-stats-bar" style={{ marginBottom: 24 }}>
        <div className="funnel-stat">
          <div className="funnel-stat-value">0</div>
          <div className="funnel-stat-label">Total Leads</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">--</div>
          <div className="funnel-stat-label">Cost Per Lead</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{activeFunnels}</div>
          <div className="funnel-stat-label">Active Funnels</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">0</div>
          <div className="funnel-stat-label">Landing Pages Live</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Activity Feed */}
        <div className="funnel-section-card" style={{ gridColumn: activityFeed.length > 0 ? '1' : '1 / -1' }}>
          <div className="funnel-section-header">
            <h3>Recent Activity</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {activityFeed.length > 0 ? (
              activityFeed.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 20px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 13,
                  }}
                >
                  <span dangerouslySetInnerHTML={{ __html: item.icon }} />
                  <span style={{ flex: 1, color: 'var(--text-primary)' }}>{item.text}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {timeAgo(item.time)}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No activity yet. Start by analyzing your business.
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/funnel/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', display: 'block' }}>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--accent)' }}>&#9889; Funnel Builder</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {activeFunnels > 0 ? `${activeFunnels} active funnels with ${copyComponents.length} copy components` : 'Generate your first campaign'}
            </p>
          </Link>
          <Link href="/avatars/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', display: 'block' }}>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--accent)' }}>&#128100; Avatars</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {avatars.length} audience profiles defined
            </p>
          </Link>
          <Link href="/offers/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', display: 'block' }}>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--accent)' }}>&#127873; Offers</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {offers.length} conversion offers ready
            </p>
          </Link>
          <Link href="/business-overview/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', display: 'block' }}>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--accent)' }}>&#128188; Business Overview</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Company profile, ad rules, and guidelines
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
