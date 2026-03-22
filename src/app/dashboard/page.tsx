'use client'

import Link from 'next/link'
import { MOCK_CLIENT, MOCK_AVATARS, MOCK_OFFERS } from '@/lib/mock-data'

const GETTING_STARTED_STEPS = [
  {
    number: 1,
    title: 'Add Business Info',
    href: '/logical-boost-hub/business-overview/',
    isComplete: !!MOCK_CLIENT.business_summary,
  },
  {
    number: 2,
    title: 'Complete Intake',
    href: '/logical-boost-hub/intake/',
    isComplete: MOCK_CLIENT.intake_status === 'completed',
  },
  {
    number: 3,
    title: 'Review Avatars',
    href: '/logical-boost-hub/avatars/',
    isComplete: MOCK_AVATARS.length > 0,
  },
  {
    number: 4,
    title: 'Review Offers',
    href: '/logical-boost-hub/offers/',
    isComplete: MOCK_OFFERS.length > 0,
  },
  {
    number: 5,
    title: 'Generate Funnels',
    href: '/logical-boost-hub/funnel/',
    isComplete: false,
  },
]

export default function DashboardPage() {
  const approvedAvatars = MOCK_AVATARS.filter((a) => a.status === 'approved').length
  const approvedOffers = MOCK_OFFERS.filter((o) => o.status === 'approved').length
  const completedSteps = GETTING_STARTED_STEPS.filter((s) => s.isComplete).length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="welcome-card">
        <h2>Welcome back, {MOCK_CLIENT.name}</h2>
        <p>
          Your marketing hub is ready. View your campaign funnels, manage avatars and offers,
          and track performance all in one place.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Funnels</div>
          <div className="stat-value">0</div>
          <div className="stat-change">Not started</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avatars</div>
          <div className="stat-value">{MOCK_AVATARS.length}</div>
          <div className="stat-change positive">
            {approvedAvatars === MOCK_AVATARS.length ? 'All approved' : `${approvedAvatars} approved`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Offers</div>
          <div className="stat-value">{MOCK_OFFERS.length}</div>
          <div className="stat-change positive">
            {approvedOffers === MOCK_OFFERS.length ? 'All approved' : `${approvedOffers} approved`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Setup Progress</div>
          <div className="stat-value">{completedSteps}/{GETTING_STARTED_STEPS.length}</div>
          <div className="stat-change positive">
            {completedSteps === GETTING_STARTED_STEPS.length ? 'Complete' : `${GETTING_STARTED_STEPS.length - completedSteps} remaining`}
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>Getting Started</h3>
      <div className="card">
        <div className="card-body">
          {GETTING_STARTED_STEPS.map((step) => (
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
        <Link href="/logical-boost-hub/funnel/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Funnel Builder</div>
          <div className="card-body">
            Select an avatar, offer, and angle to view or generate your complete campaign system.
          </div>
        </Link>
        <Link href="/logical-boost-hub/avatars/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Avatars</div>
          <div className="card-body">
            View and manage your target audience profiles. {MOCK_AVATARS.length} active avatars defined.
          </div>
        </Link>
        <Link href="/logical-boost-hub/offers/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Offers</div>
          <div className="card-body">
            Manage your conversion offers. {approvedOffers} approved offers ready for campaigns.
          </div>
        </Link>
        <Link href="/logical-boost-hub/business-overview/" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-title">Business Overview</div>
          <div className="card-body">
            Review and update your company profile, ad copy rules, and brand guidelines.
          </div>
        </Link>
      </div>
    </div>
  )
}
