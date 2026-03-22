'use client'

import { useState } from 'react'

const mockOffers = [
  {
    id: '1',
    name: 'Free Roof Inspection',
    offer_type: 'lead_generation',
    headline: 'Get a Free Professional Roof Inspection',
    subheadline: 'We inspect, document, and handle your insurance claim — all at no cost',
    description: 'Our certified team will inspect your entire roof with professional equipment, document all findings with photos and measurements, and provide a detailed damage report. If damage is found, we handle the full insurance claim process.',
    primary_cta: 'Schedule Your Free Inspection',
    conversion_type: 'lead_form',
    benefits: ['100% free — no cost unless we find claimable damage', 'Full photo documentation you keep regardless', 'Insurance claim management included', 'GAF Master Elite certified inspectors', 'Available within 48 hours'],
    proof_elements: ['2,300+ inspections completed', 'GAF Master Elite certified', '4.9 stars on Google'],
    urgency_elements: ['Storm damage claims must be filed within 12 months', 'Limited inspection slots this week'],
    faq: [
      { question: 'Is it really free?', answer: 'Yes — if no damage is found, you owe nothing. If damage exists, we only proceed with your approval.' },
      { question: 'Will a claim raise my rates?', answer: 'Storm damage claims are "acts of God" and typically do not affect premiums.' },
    ],
    landing_page_type: 'lead_capture',
    status: 'approved' as const,
  },
  {
    id: '2',
    name: 'Storm Damage Emergency Response',
    offer_type: 'appointment',
    headline: 'Emergency Roof Repair — Same Day Response',
    subheadline: 'Active leak or visible damage? We\'re on our way.',
    description: 'When storm damage can\'t wait, our emergency response team provides same-day tarping, temporary repairs, and full damage assessment. We stabilize your roof immediately and then handle the permanent repair and insurance claim.',
    primary_cta: 'Call Now for Emergency Service',
    conversion_type: 'phone_call',
    benefits: ['Same-day emergency response', '24/7 availability', 'Immediate tarping to prevent further damage', 'Full repair + insurance claim management'],
    proof_elements: ['8+ years emergency response experience', 'Licensed and fully insured'],
    urgency_elements: ['Every hour of delay risks more damage', 'Emergency slots fill fast during storm season'],
    faq: [
      { question: 'How fast can you get here?', answer: 'We respond within 2 hours for emergency calls in our service area.' },
    ],
    landing_page_type: 'call_only',
    status: 'approved' as const,
  },
  {
    id: '3',
    name: 'Insurance Claim Assistance',
    offer_type: 'lead_generation',
    headline: 'We Handle Your Roof Insurance Claim — Start to Finish',
    subheadline: 'Most homeowners pay $0 out of pocket. Let us show you how.',
    description: 'Our claims specialists work directly with your insurance company to ensure you get the coverage you deserve. We handle all paperwork, adjuster meetings, and supplemental claims.',
    primary_cta: 'Check Your Coverage Free',
    conversion_type: 'lead_form',
    benefits: ['Full claim management from filing to approval', 'We meet the adjuster on-site', 'Supplemental claims for missed damage', 'Most homeowners pay $0 out of pocket'],
    proof_elements: ['97% claim approval rate', 'Average claim value: $12,500', '2,300+ claims processed'],
    urgency_elements: ['Filing deadlines vary by policy — check yours now'],
    faq: [
      { question: 'What if my claim is denied?', answer: 'We specialize in supplemental claims and appeals. Most denials can be overturned with proper documentation.' },
    ],
    landing_page_type: 'lead_capture',
    status: 'approved' as const,
  },
  {
    id: '4',
    name: 'Roof Replacement Quote',
    offer_type: 'quote',
    headline: 'Get Your Free Roof Replacement Estimate',
    subheadline: 'Transparent pricing. No pressure. Multiple options.',
    description: 'Thinking about a new roof? Get a detailed, no-obligation estimate with material options, timeline, and financing details. We offer GAF certified materials with lifetime warranties.',
    primary_cta: 'Get My Free Estimate',
    conversion_type: 'booking',
    benefits: ['Detailed written estimate with options', 'Multiple material choices and price points', 'Financing available', 'Lifetime workmanship warranty'],
    proof_elements: ['GAF Master Elite — top 3% nationwide', 'Lifetime warranty on materials and labor'],
    urgency_elements: ['Book before busy season for faster scheduling'],
    faq: [
      { question: 'How much does a new roof cost?', answer: 'Costs vary by size and material, typically $8,000–$25,000. Insurance may cover most or all of it if damage qualifies.' },
    ],
    landing_page_type: 'booking',
    status: 'approved' as const,
  },
]

export default function OffersPage() {
  const [selectedOffer, setSelectedOffer] = useState<typeof mockOffers[0] | null>(null)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Offers</h1>
          <p className="page-subtitle">Conversion propositions for campaigns</p>
        </div>
        <button className="btn btn-primary">Suggest Offers</button>
      </div>

      <div className="card-grid">
        {mockOffers.map((offer) => (
          <div key={offer.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedOffer(offer)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title">{offer.name}</div>
              <span className={`badge badge-${offer.status}`}>{offer.status}</span>
            </div>
            <div className="card-meta">{offer.offer_type} &bull; {offer.conversion_type}</div>
            <div className="card-body" style={{ marginTop: 8 }}>{offer.primary_cta}</div>
            <div className="card-actions">
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedOffer(offer) }}>View Details</button>
              <button className="btn btn-secondary btn-sm">Edit</button>
              <button className="btn btn-danger btn-sm">Deny</button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedOffer && (
        <div className="modal-overlay" onClick={() => setSelectedOffer(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{selectedOffer.name}</h2>
                <span className="card-meta">{selectedOffer.offer_type} &bull; {selectedOffer.conversion_type}</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedOffer(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Headline</span>
                  <span className="detail-value" style={{ fontSize: 16, fontWeight: 600 }}>{selectedOffer.headline}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Subheadline</span>
                  <span className="detail-value">{selectedOffer.subheadline}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedOffer.description}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Primary CTA</span>
                  <span className="detail-value" style={{ color: 'var(--accent)' }}>{selectedOffer.primary_cta}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Benefits</span>
                  <ul style={{ paddingLeft: 16, color: 'var(--text-primary)' }}>
                    {selectedOffer.benefits?.map((b, i) => <li key={i} style={{ fontSize: 14, marginBottom: 4 }}>{b}</li>)}
                  </ul>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Proof Elements</span>
                  <div className="tag-list">
                    {selectedOffer.proof_elements?.map((p, i) => <span key={i} className="tag">{p}</span>)}
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Urgency Elements</span>
                  <div className="tag-list">
                    {selectedOffer.urgency_elements?.map((u, i) => <span key={i} className="tag" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>{u}</span>)}
                  </div>
                </div>
                {selectedOffer.faq && selectedOffer.faq.length > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">FAQ</span>
                    {selectedOffer.faq.map((item, i) => (
                      <div key={i} style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.question}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>{item.answer}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger">Deny</button>
              <button className="btn btn-secondary">Edit</button>
              <button className="btn btn-primary" onClick={() => setSelectedOffer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
