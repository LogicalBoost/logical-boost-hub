'use client'

import { useAppStore } from '@/lib/store'

export default function StatsPage() {
  const { client, avatars, offers, funnelInstances, copyComponents } = useAppStore()

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#9783;</div>
        <div className="empty-state-text">No client selected</div>
        <div className="empty-state-sub">Set up your client first in Business Overview.</div>
      </div>
    )
  }

  const approvedAvatars = avatars.filter((a) => a.status === 'approved')
  const approvedOffers = offers.filter((o) => o.status === 'approved')
  const activeFunnels = funnelInstances.filter((f) => f.status === 'active')
  const totalCopy = copyComponents.filter((c) => c.status !== 'denied')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">Campaign content overview for {client.name}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Avatars</div>
          <div className="stat-value">{avatars.length}</div>
          <div className="stat-change">
            {approvedAvatars.length} approved
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Offers</div>
          <div className="stat-value">{offers.length}</div>
          <div className="stat-change">
            {approvedOffers.length} approved
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Funnels Generated</div>
          <div className="stat-value">{funnelInstances.length}</div>
          <div className="stat-change">
            {activeFunnels.length} active
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Copy Components</div>
          <div className="stat-value">{totalCopy.length}</div>
          <div className="stat-change">
            Across all funnels
          </div>
        </div>
      </div>

      {funnelInstances.length > 0 ? (
        <div className="card">
          <div className="card-title">Generated Funnels</div>
          <div style={{ marginTop: 16 }}>
            {funnelInstances.map((fi) => {
              const avatar = avatars.find((a) => a.id === fi.avatar_id)
              const offer = offers.find((o) => o.id === fi.offer_id)
              const components = copyComponents.filter(
                (c) => c.funnel_instance_id === fi.id && c.status !== 'denied'
              )
              return (
                <div key={fi.id} className="copy-item" style={{ padding: '16px 0' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {avatar?.name || 'Unknown Avatar'} + {offer?.name || 'Unknown Offer'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {components.length} copy items &bull; {fi.status}
                    </div>
                  </div>
                  <span className={`badge ${fi.status === 'active' ? 'badge-approved' : 'badge-pending'}`}>
                    {fi.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center' as const }}>
          <div className="empty-state">
            <div className="empty-state-icon">&#9783;</div>
            <div className="empty-state-text">No funnels generated yet</div>
            <div className="empty-state-sub">
              Go to the Funnel page to generate your first campaign.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
