'use client'

import Link from 'next/link'
import { useAppStore } from '@/lib/store'

export default function DashboardPage() {
  const { client, avatars, offers, intakeQuestions, funnelInstances } = useAppStore()

  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🚀</div>
        <div className="empty-state-text">Welcome to Logical Boost Hub</div>
        <div className="empty-state-sub">
          Get started by adding your first client&apos;s business information
        </div>
        <Link href="/business-overview/" className="btn btn-primary" style={{ marginTop: 24 }}>
          Start Setup
        </Link>
      </div>
    )
  }

  const gettingStartedSteps = [
    {
      number: 1,
      title: 'Add Business Info',
      href: '/business-overview/',
      isComplete: !!client.business_summary,
    },
    {
      number: 2,
      title: 'Complete Intake',
      href: '/intake/',
      isComplete: client.intake_status === 'completed',
    },
    {
      number: 3,
      title: 'Review Avatars',
      href: '/avatars/',
      isComplete: avatars.length > 0,
    },
    {
      number: 4,
      title: 'Review Offers',
      href: '/offers/',
      isComplete: offers.length > 0,
    },
    {
      number: 5,
      title: 'Generate Funnels',
      href: '/funnel/',
      isComplete: funnelInstances.length > 0,
    },
  ]

  const completedSteps = gettingStartedSteps.filter((s) => s.isComplete).length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="welcome-card">
        <h2>Welcome back, {client.name}</h2>
        <p>
          Your marketing hub is ready. View your campaign funnels, manage avatars and offers,
          and track performance all in one place.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Avatars</div>
          <div className="stat-value">{avatars.length}</div>
          <div className="stat-change">
            {avatars.length === 0 ? 'None yet' : `${avatars.length} defined`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Offers</div>
          <div className="stat-value">{offers.length}</div>
          <div className="stat-change">
            {offers.length === 0 ? 'None yet' : `${offers.length} active`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Funnels</div>
          <div className="stat-value">{funnelInstances.length}</div>
          <div className="stat-change">
            {funnelInstances.length === 0 ? 'Not started' : `${funnelInstances.length} generated`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Setup Progress</div>
          <div className="stat-value">{completedSteps}/{gettingStartedSteps.length}</div>
          <div className="stat-change">
            {completedSteps === gettingStartedSteps.length
              ? 'Complete'
              : `${gettingStartedSteps.length - completedSteps} remaining`}
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>Getting Started</h3>
      <div className="card">
        <div className="card-body">
          {gettingStartedSteps.map((step) => (
            <Link
              key={step.number}
              href={step.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid #eee',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    background: step.isComplete ? '#22c55e' : '#e5e7eb',
                    color: step.isComplete ? '#fff' : '#6b7280',
                  }}
                >
                  {step.isComplete ? '\u2713' : step.number}
                </span>
                <span style={{ fontWeight: 500 }}>
                  Step {step.number}: {step.title}
                </span>
              </span>
              <span className={step.isComplete ? 'badge badge-approved' : 'badge badge-pending'}>
                {step.isComplete ? 'Completed' : 'Pending'}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 18, fontWeight: 600 }}>Quick Links</h3>
      <div className="card-grid">
        <Link href="/funnel/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Funnel Builder</div>
          <div className="card-body">
            Select an avatar, offer, and angle to view or generate your complete campaign system.
          </div>
        </Link>
        <Link href="/avatars/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Avatars</div>
          <div className="card-body">
            View and manage your target audience profiles. {avatars.length} active avatars defined.
          </div>
        </Link>
        <Link href="/offers/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Offers</div>
          <div className="card-body">
            Manage your conversion offers. {offers.length} offers ready for campaigns.
          </div>
        </Link>
        <Link href="/business-overview/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Business Overview</div>
          <div className="card-body">
            Review and update your company profile, ad copy rules, and brand guidelines.
          </div>
        </Link>
      </div>
    </div>
  )
}
