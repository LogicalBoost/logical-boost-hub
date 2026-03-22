'use client'

export default function DashboardPage() {
  return (
    <div>
      <div className="welcome-card">
        <h2>Welcome back, RoofCo Exteriors</h2>
        <p>
          Your marketing hub is ready. View your campaign funnels, manage avatars and offers,
          and track performance all in one place.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Funnels</div>
          <div className="stat-value">12</div>
          <div className="stat-change positive">+3 this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avatars</div>
          <div className="stat-value">4</div>
          <div className="stat-change positive">All approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Offers</div>
          <div className="stat-value">6</div>
          <div className="stat-change positive">+2 new</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Copy Components</div>
          <div className="stat-value">184</div>
          <div className="stat-change positive">+47 this week</div>
        </div>
      </div>

      <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>Quick Links</h3>
      <div className="card-grid">
        <div className="card">
          <div className="card-title">Funnel Builder</div>
          <div className="card-body">
            Select an avatar, offer, and angle to view or generate your complete campaign system.
          </div>
        </div>
        <div className="card">
          <div className="card-title">Avatars</div>
          <div className="card-body">
            View and manage your target audience profiles. 4 active avatars defined.
          </div>
        </div>
        <div className="card">
          <div className="card-title">Offers</div>
          <div className="card-body">
            Manage your conversion offers. 6 approved offers ready for campaigns.
          </div>
        </div>
        <div className="card">
          <div className="card-title">Business Overview</div>
          <div className="card-body">
            Review and update your company profile, ad copy rules, and brand guidelines.
          </div>
        </div>
      </div>
    </div>
  )
}
