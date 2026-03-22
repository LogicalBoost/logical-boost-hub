'use client'

export default function StatsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">Campaign performance metrics and tracking</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Landing Page Visits</div>
          <div className="stat-value">2,847</div>
          <div className="stat-change positive">+12.3% vs last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leads Generated</div>
          <div className="stat-value">156</div>
          <div className="stat-change positive">+8.2% vs last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Calls</div>
          <div className="stat-value">89</div>
          <div className="stat-change positive">+15.6% vs last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Qualified Leads</div>
          <div className="stat-value">42</div>
          <div className="stat-change positive">+5.0% vs last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cost Per Lead</div>
          <div className="stat-value">$23.40</div>
          <div className="stat-change positive">-$2.10 vs last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value">5.5%</div>
          <div className="stat-change negative">-0.3% vs last month</div>
        </div>
      </div>

      <div className="card" style={{ padding: 40, textAlign: 'center' as const }}>
        <div className="empty-state">
          <div className="empty-state-icon">&#9783;</div>
          <div className="empty-state-text">Detailed Analytics Coming Soon</div>
          <div className="empty-state-sub">
            This page will integrate with GA4, CRM, call tracking, and ad platforms
            to show real-time campaign performance data.
          </div>
        </div>
      </div>
    </div>
  )
}
