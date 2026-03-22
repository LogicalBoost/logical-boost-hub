'use client'

import { useState } from 'react'

const mockAvatars = [
  {
    id: '1',
    name: 'Storm-Damage Homeowner',
    avatar_type: 'homeowner',
    description: 'Homeowners who have recently experienced storm damage to their roof and are seeking immediate inspection and repair services.',
    pain_points: 'Visible roof damage after storms, fear of leaks and further deterioration, confusion about insurance claims, worry about choosing a trustworthy contractor',
    motivations: 'Protect their home and family, get their roof fixed quickly, minimize out-of-pocket costs through insurance',
    objections: 'Worried about cost, unsure if they actually have damage, fear of being scammed by storm chasers',
    desired_outcome: 'A fully repaired roof covered by insurance with zero hassle and zero out-of-pocket cost',
    trigger_events: 'Major storm in their area, neighbor getting roof replaced, visible damage spotted, insurance company outreach',
    messaging_style: 'Reassuring and empathetic — they\'re stressed about damage and cost',
    preferred_platforms: ['meta', 'google'],
    recommended_angles: ['problem', 'fear', 'mechanism'],
    status: 'approved' as const,
  },
  {
    id: '2',
    name: 'Proactive Homeowner',
    avatar_type: 'homeowner',
    description: 'Homeowners with aging roofs (10-15 years) who want to get ahead of problems before they become emergencies.',
    pain_points: 'Aging roof showing wear, worried about sudden failure, unsure when to replace, don\'t want to wait for a crisis',
    motivations: 'Prevent costly emergency repairs, increase home value, peace of mind',
    objections: 'Not sure if they need a new roof yet, concerned about cost of replacement, bad timing',
    desired_outcome: 'A modern, durable roof installed on their timeline with fair pricing',
    trigger_events: 'Roof hitting 15-year mark, seeing neighbors replace roofs, real estate agent suggestion, home inspection finding',
    messaging_style: 'Informative and advisory — they\'re planning, not panicking',
    preferred_platforms: ['google', 'youtube'],
    recommended_angles: ['mechanism', 'cost', 'authority'],
    status: 'approved' as const,
  },
  {
    id: '3',
    name: 'Property Manager',
    avatar_type: 'property_manager',
    description: 'Property managers overseeing multiple residential or small commercial properties who need reliable, scalable roofing services.',
    pain_points: 'Managing multiple properties with varying roof conditions, need fast turnaround to keep tenants happy, budget constraints across portfolio',
    motivations: 'Maintain property value, keep tenants satisfied, find one reliable contractor for all properties',
    objections: 'Need competitive volume pricing, worried about quality across multiple jobs, scheduling complexity',
    desired_outcome: 'A single trusted roofing partner who handles all their properties reliably and on schedule',
    trigger_events: 'Annual property inspections, tenant complaints about leaks, storm damage across multiple units, insurance renewal',
    messaging_style: 'Professional and efficient — they\'re business-minded and value reliability',
    preferred_platforms: ['google', 'meta'],
    recommended_angles: ['authority', 'speed', 'cost'],
    status: 'approved' as const,
  },
  {
    id: '4',
    name: 'Insurance-Aware Homeowner',
    avatar_type: 'homeowner',
    description: 'Homeowners who suspect they may have roof damage covered by insurance but don\'t know how to navigate the claims process.',
    pain_points: 'Don\'t understand insurance claims process, worried about rate increases, unsure if damage qualifies',
    motivations: 'Get roof repaired without paying out of pocket, understand their coverage, avoid claim denial',
    objections: 'Fear filing a claim will raise rates, don\'t trust contractors who push insurance work, unsure if damage is bad enough',
    desired_outcome: 'Successful insurance claim with full coverage and a new roof at zero or minimal cost',
    trigger_events: 'Receiving insurance renewal notice, talking to neighbors about claims, finding a leak, agent recommendation',
    messaging_style: 'Educational and trustworthy — demystify the process, reduce anxiety',
    preferred_platforms: ['meta', 'youtube'],
    recommended_angles: ['mechanism', 'hidden_truth', 'proof'],
    status: 'approved' as const,
  },
]

export default function AvatarsPage() {
  const [selectedAvatar, setSelectedAvatar] = useState<typeof mockAvatars[0] | null>(null)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Avatars</h1>
          <p className="page-subtitle">Target audience profiles for campaign targeting</p>
        </div>
        <button className="btn btn-primary">Generate Avatars</button>
      </div>

      <div className="card-grid">
        {mockAvatars.map((avatar) => (
          <div key={avatar.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedAvatar(avatar)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title">{avatar.name}</div>
              <span className={`badge badge-${avatar.status}`}>{avatar.status}</span>
            </div>
            <div className="card-meta">{avatar.avatar_type}</div>
            <div className="card-body" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
              {avatar.pain_points}
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="tag-list">
                {avatar.recommended_angles?.slice(0, 3).map((angle) => (
                  <span key={angle} className="tag">{angle}</span>
                ))}
              </div>
            </div>
            <div className="card-actions">
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedAvatar(avatar) }}>View Details</button>
              <button className="btn btn-secondary btn-sm">Edit</button>
              <button className="btn btn-danger btn-sm">Deny</button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedAvatar && (
        <div className="modal-overlay" onClick={() => setSelectedAvatar(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{selectedAvatar.name}</h2>
                <span className="card-meta">{selectedAvatar.avatar_type}</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedAvatar(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedAvatar.description}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Pain Points</span>
                  <span className="detail-value">{selectedAvatar.pain_points}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Motivations</span>
                  <span className="detail-value">{selectedAvatar.motivations}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Objections</span>
                  <span className="detail-value">{selectedAvatar.objections}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Desired Outcome</span>
                  <span className="detail-value">{selectedAvatar.desired_outcome}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Trigger Events</span>
                  <span className="detail-value">{selectedAvatar.trigger_events}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Messaging Style</span>
                  <span className="detail-value">{selectedAvatar.messaging_style}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Preferred Platforms</span>
                  <div className="tag-list">
                    {selectedAvatar.preferred_platforms?.map((p) => (
                      <span key={p} className="tag">{p}</span>
                    ))}
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Recommended Angles</span>
                  <div className="tag-list">
                    {selectedAvatar.recommended_angles?.map((a) => (
                      <span key={a} className="tag">{a}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger">Deny</button>
              <button className="btn btn-secondary">Edit</button>
              <button className="btn btn-primary" onClick={() => setSelectedAvatar(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
