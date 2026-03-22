'use client'

import { useState } from 'react'
import { MOCK_OFFERS } from '@/lib/mock-data'
import { demoAction, showToast } from '@/lib/demo-toast'
import type { Offer } from '@/types/database'

type StatusFilter = 'all' | 'approved' | 'denied'

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>(MOCK_OFFERS)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredOffers = statusFilter === 'all'
    ? offers
    : offers.filter((o) => o.status === statusFilter)

  function handleDeny(offerId: string) {
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, status: 'denied' as const } : o))
    )
    if (selectedOffer?.id === offerId) {
      setSelectedOffer((prev) => prev ? { ...prev, status: 'denied' as const } : null)
    }
    showToast('Offer denied')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Offers</h1>
          <p className="page-subtitle">Conversion propositions for campaigns</p>
        </div>
        <button className="btn btn-primary" onClick={() => demoAction('Suggest Offers with AI')}>Suggest Offers</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'approved', 'denied'] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            className={`btn btn-sm ${statusFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="card-grid">
        {filteredOffers.map((offer) => (
          <div key={offer.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedOffer(offer)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title">{offer.name}</div>
              <span className={`badge badge-${offer.status}`}>{offer.status}</span>
            </div>
            <div className="card-meta">{offer.offer_type} &bull; {offer.conversion_type}</div>
            <div className="card-body" style={{ marginTop: 8 }}>{offer.primary_cta}</div>
            <div className="card-actions">
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedOffer(offer) }}>View Details</button>
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); demoAction('Edit Offer') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeny(offer.id) }}>Deny</button>
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
              <button className="btn btn-danger" onClick={() => handleDeny(selectedOffer.id)}>Deny</button>
              <button className="btn btn-secondary" onClick={() => demoAction('Edit Offer')}>Edit</button>
              <button className="btn btn-primary" onClick={() => setSelectedOffer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
