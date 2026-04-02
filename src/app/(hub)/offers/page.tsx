'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { suggestOffers } from '@/lib/api'
import { showToast } from '@/lib/demo-toast'
import type { Offer } from '@/types/database'

type StatusFilter = 'all' | 'approved' | 'denied'

export default function OffersPage() {
  const { client, offers, updateOffer, refreshOffers, setLoading, loading, canEdit } = useAppStore()
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [suggesting, setSuggesting] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [savingOffer, setSavingOffer] = useState(false)

  // Manual add form state
  const [newName, setNewName] = useState('')
  const [newOfferType, setNewOfferType] = useState('consultation')
  const [newHeadline, setNewHeadline] = useState('')
  const [newSubheadline, setNewSubheadline] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCta, setNewCta] = useState('')
  const [newConversionType, setNewConversionType] = useState('phone_consultation_booking')
  const [newBenefits, setNewBenefits] = useState('')

  function resetAddForm() {
    setNewName('')
    setNewOfferType('consultation')
    setNewHeadline('')
    setNewSubheadline('')
    setNewDescription('')
    setNewCta('')
    setNewConversionType('phone_consultation_booking')
    setNewBenefits('')
    setShowAddForm(false)
  }

  async function handleManualAdd() {
    if (!client || !newName.trim()) return
    setSavingOffer(true)
    try {
      const benefits = newBenefits.split('\n').map(b => b.trim()).filter(Boolean)
      const { error } = await supabase.from('offers').insert({
        client_id: client.id,
        name: newName.trim(),
        offer_type: newOfferType,
        headline: newHeadline.trim() || null,
        subheadline: newSubheadline.trim() || null,
        description: newDescription.trim() || null,
        primary_cta: newCta.trim() || null,
        conversion_type: newConversionType,
        benefits: benefits.length > 0 ? benefits : null,
        status: 'approved',
      })
      if (error) throw error
      await refreshOffers(client.id)
      resetAddForm()
      showToast('Offer added successfully')
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setSavingOffer(false)
    }
  }

  const filteredOffers = statusFilter === 'all'
    ? offers
    : offers.filter((o) => o.status === statusFilter)

  function handleDeny(offerId: string) {
    updateOffer(offerId, { status: 'denied' })
    if (selectedOffer?.id === offerId) {
      setSelectedOffer((prev) => prev ? { ...prev, status: 'denied' as const } : null)
    }
    showToast('Offer denied')
  }

  function handleApprove(offerId: string) {
    updateOffer(offerId, { status: 'approved' })
    if (selectedOffer?.id === offerId) {
      setSelectedOffer((prev) => prev ? { ...prev, status: 'approved' as const } : null)
    }
    showToast('Offer approved')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this offer? This cannot be undone.')) return
    if (!client) return
    await supabase.from('offers').delete().eq('id', id)
    setSelectedOffer(null)
    await refreshOffers(client.id)
    showToast('Offer deleted')
  }

  async function handleSuggestMore() {
    if (!client) return
    setSuggesting(true)
    setLoading(true)
    try {
      await suggestOffers(client.id)
      await refreshOffers(client.id)
      showToast('New offers suggested successfully')
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setSuggesting(false)
      setLoading(false)
    }
  }

  if (!client) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Offers</h1>
            <p className="page-subtitle">Conversion propositions for campaigns</p>
          </div>
        </div>
        <div className="empty-state">
          Select a client to manage offers.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Offers</h1>
          <p className="page-subtitle">Conversion propositions for campaigns</p>
        </div>
        {canEdit && (
          <div className="btn-group-responsive" style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAddForm(true)}
            >
              + Add Offer
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSuggestMore}
              disabled={suggesting || loading}
            >
              {suggesting ? 'Suggesting...' : 'Suggest More Offers'}
            </button>
          </div>
        )}
      </div>

      {/* Manual Add Offer Form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title">Add New Offer</div>
            <button className="btn btn-secondary btn-sm" onClick={resetAddForm}>Cancel</button>
          </div>
          <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Offer Name *</label>
              <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Free Roof Inspection" />
            </div>
            <div className="form-group">
              <label className="form-label">Offer Type</label>
              <select className="form-input" value={newOfferType} onChange={e => setNewOfferType(e.target.value)}>
                <option value="consultation">Consultation</option>
                <option value="lead_magnet">Lead Magnet</option>
                <option value="discount">Discount</option>
                <option value="bundle">Bundle</option>
                <option value="free_trial">Free Trial</option>
                <option value="assessment">Assessment</option>
                <option value="application">Application</option>
                <option value="offer_verification">Offer Verification</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Headline</label>
              <input className="form-input" value={newHeadline} onChange={e => setNewHeadline(e.target.value)} placeholder="Compelling headline for the offer" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Subheadline</label>
              <input className="form-input" value={newSubheadline} onChange={e => setNewSubheadline(e.target.value)} placeholder="Supporting line that expands on the headline" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={3} value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="What does this offer include? Why should someone take it?" />
            </div>
            <div className="form-group">
              <label className="form-label">Primary CTA</label>
              <input className="form-input" value={newCta} onChange={e => setNewCta(e.target.value)} placeholder="e.g. Get My Free Quote" />
            </div>
            <div className="form-group">
              <label className="form-label">Conversion Type</label>
              <select className="form-input" value={newConversionType} onChange={e => setNewConversionType(e.target.value)}>
                <option value="phone_consultation_booking">Phone Consultation</option>
                <option value="form_submission">Form Submission</option>
                <option value="lead_magnet_download">Lead Magnet Download</option>
                <option value="soft_inquiry_application">Soft Inquiry</option>
                <option value="loan_application">Application</option>
                <option value="direct_purchase">Direct Purchase</option>
                <option value="free_trial_signup">Free Trial</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Benefits (one per line)</label>
              <textarea className="form-textarea" rows={4} value={newBenefits} onChange={e => setNewBenefits(e.target.value)} placeholder={"Save $200 on your first service\nNo-obligation, completely free\n30-minute personalized session"} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={handleManualAdd}
              disabled={savingOffer || !newName.trim()}
            >
              {savingOffer ? 'Saving...' : 'Add Offer'}
            </button>
          </div>
        </div>
      )}

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
              <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeny(offer.id) }}>Deny</button>
              {canEdit && (
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleApprove(offer.id) }}>Approve</button>
              )}
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
              {canEdit && (
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selectedOffer.id)}>Delete</button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => handleDeny(selectedOffer.id)}>Deny</button>
                {canEdit && (
                  <button className="btn btn-primary" onClick={() => handleApprove(selectedOffer.id)}>Approve</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
