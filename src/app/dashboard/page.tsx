'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'

interface SetupStep {
  label: string
  description: string
  href: string
  isComplete: boolean
  icon: string
  order: number
}

export default function DashboardPage() {
  const { client, avatars, offers, funnelInstances, copyComponents, intakeQuestions, competitors } = useAppStore()

  const activeFunnels = funnelInstances.filter((fi) => fi.status === 'active').length
  const approvedAvatars = avatars.filter(a => a.status === 'approved').length
  const approvedOffers = offers.filter(o => o.status === 'approved').length
  const answeredIntake = intakeQuestions.filter(q => (q.answer ?? '').trim().length > 0).length

  // Setup steps checklist
  const setupSteps: SetupStep[] = useMemo(() => [
    {
      label: '1. Set Up Business Profile',
      description: 'Enter your client\'s name, website, and call notes. AI will analyze the business.',
      href: '/business-overview/',
      isComplete: !!(client?.business_summary && client.business_summary.trim().length > 0),
      icon: '&#128188;',
      order: 1,
    },
    {
      label: '2. Complete Intake Questions',
      description: 'Answer AI-generated questions to fill knowledge gaps about the client.',
      href: '/intake/',
      isComplete: intakeQuestions.length > 0 && answeredIntake >= intakeQuestions.length * 0.5,
      icon: '&#128221;',
      order: 2,
    },
    {
      label: '3. Review & Approve Avatars',
      description: 'Generate audience profiles with AI, then approve the best ones.',
      href: '/avatars/',
      isComplete: approvedAvatars >= 3,
      icon: '&#128100;',
      order: 3,
    },
    {
      label: '4. Review & Approve Offers',
      description: 'Approve or refine AI-generated conversion offers for your campaigns.',
      href: '/offers/',
      isComplete: approvedOffers >= 1,
      icon: '&#127873;',
      order: 4,
    },
    {
      label: '5. Add Competitive Intelligence',
      description: 'Track competitor ads, landing pages, and offers to inform your strategy.',
      href: '/competitive-intel/',
      isComplete: competitors.length >= 1,
      icon: '&#128269;',
      order: 5,
    },
    {
      label: '6. Build Campaign Funnels',
      description: 'Select avatar + offer + angle, then generate full campaign copy with AI.',
      href: '/funnel/',
      isComplete: activeFunnels >= 1,
      icon: '&#9889;',
      order: 6,
    },
    {
      label: '7. Build Landing Pages',
      description: 'Create landing pages using brand kit, competitive insights, and AI concepts.',
      href: '/landing-pages/',
      isComplete: false,
      icon: '&#128196;',
      order: 7,
    },
  ], [client, intakeQuestions, answeredIntake, approvedAvatars, approvedOffers, competitors, activeFunnels])

  const completedSteps = setupSteps.filter(s => s.isComplete).length
  const totalSteps = setupSteps.length
  const progressPercent = Math.round((completedSteps / totalSteps) * 100)
  const nextStep = setupSteps.find(s => !s.isComplete)

  // Build activity feed from recent items
  const activityFeed = useMemo(() => {
    const items: { text: string; time: string; icon: string }[] = []

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

    for (const a of avatars.slice(-3).reverse()) {
      items.push({
        text: `Avatar "${a.name}" ${a.status === 'approved' ? 'approved' : 'created'}`,
        time: a.created_at,
        icon: '&#128100;',
      })
    }

    for (const o of offers.slice(-3).reverse()) {
      items.push({
        text: `Offer "${o.name}" ${o.status === 'approved' ? 'approved' : 'created'}`,
        time: o.created_at,
        icon: '&#127873;',
      })
    }

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
          <div className="funnel-stat-value">{approvedAvatars}</div>
          <div className="funnel-stat-label">Approved Avatars</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{approvedOffers}</div>
          <div className="funnel-stat-label">Approved Offers</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{activeFunnels}</div>
          <div className="funnel-stat-label">Active Funnels</div>
        </div>
        <div className="funnel-stat">
          <div className="funnel-stat-value">{competitors.length}</div>
          <div className="funnel-stat-label">Competitors Tracked</div>
        </div>
      </div>

      {/* Setup Steps Checklist */}
      <div className="funnel-section-card" style={{ marginBottom: 24 }}>
        <div className="funnel-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Setup Progress</h3>
          <span style={{ fontSize: 14, color: completedSteps === totalSteps ? '#22c55e' : 'var(--text-muted)' }}>
            {completedSteps}/{totalSteps} complete
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                borderRadius: 3,
                background: progressPercent === 100 ? '#22c55e' : '#6366f1',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div>
          {setupSteps.map((step) => {
            const isNext = nextStep?.order === step.order
            return (
              <Link
                key={step.order}
                href={step.href}
                className="setup-step-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: isNext ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  border: step.isComplete ? '2px solid #22c55e' : '2px solid var(--border)',
                  background: step.isComplete ? '#22c55e' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 13,
                  color: '#fff',
                  fontWeight: 700,
                }}>
                  {step.isComplete ? '\u2713' : ''}
                </div>

                {/* Icon */}
                <span
                  style={{ fontSize: 18, flexShrink: 0 }}
                  dangerouslySetInnerHTML={{ __html: step.icon }}
                />

                {/* Label + Description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: step.isComplete ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: step.isComplete ? 'line-through' : 'none',
                    marginBottom: 2,
                  }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {step.description}
                  </div>
                </div>

                {/* Next indicator */}
                {isNext && (
                  <span className="badge badge-pending" style={{ flexShrink: 0, fontSize: 11 }}>
                    Next Step
                  </span>
                )}
                {step.isComplete && (
                  <span className="badge badge-approved" style={{ flexShrink: 0, fontSize: 11 }}>
                    Done
                  </span>
                )}
              </Link>
            )
          })}
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
                No activity yet. Start by setting up the business profile.
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
              {avatars.length} audience profiles ({approvedAvatars} approved)
            </p>
          </Link>
          <Link href="/offers/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', display: 'block' }}>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--accent)' }}>&#127873; Offers</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {offers.length} offers ({approvedOffers} approved)
            </p>
          </Link>
          <Link href="/competitive-intel/" className="funnel-section-card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', display: 'block' }}>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--accent)' }}>&#128269; Competitive Intel</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {competitors.length > 0 ? `${competitors.length} competitor entries tracked` : 'Start tracking competitors'}
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
