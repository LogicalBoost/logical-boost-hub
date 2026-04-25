'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import { AD_BODY_TYPES } from '@/types/database'

type BodyFilter = 'all' | 'SH' | 'T' | 'PC'

export default function AdsListPage() {
  const { client, ads, adComponents, offers, avatars, refreshAds, canEdit } = useAppStore()
  const [search, setSearch] = useState('')
  const [offerFilter, setOfferFilter] = useState<string>('all')
  const [audienceFilter, setAudienceFilter] = useState<string>('all')
  const [bodyFilter, setBodyFilter] = useState<BodyFilter>('all')

  const componentById = useMemo(() => {
    const map = new Map(adComponents.map(c => [c.id, c]))
    return map
  }, [adComponents])

  const filteredAds = useMemo(() => {
    return ads.filter(ad => {
      if (search && !ad.name.toLowerCase().includes(search.toLowerCase())) return false
      if (offerFilter !== 'all' && ad.offer_id !== offerFilter) return false
      if (audienceFilter !== 'all' && ad.audience_id !== audienceFilter) return false
      if (bodyFilter !== 'all') {
        const body = componentById.get(ad.body_component_id)
        if (!body || body.type !== bodyFilter) return false
      }
      return true
    })
  }, [ads, componentById, search, offerFilter, audienceFilter, bodyFilter])

  async function handleDelete(adId: string) {
    if (!client) return
    if (!confirm('Delete this ad? This will also delete its banner asset records.')) return
    const { error } = await supabase.from('ads').delete().eq('id', adId)
    if (error) {
      showToast('Error: ' + error.message)
      return
    }
    await refreshAds(client.id)
    showToast('Ad deleted')
  }

  if (!client) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Ads</h1>
            <p className="page-subtitle">Composed ads built from your component library</p>
          </div>
        </div>
        <div className="empty-state">Select a client to manage ads.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ads</h1>
          <p className="page-subtitle">Composed ads built from your component library</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-secondary" href="/ads/library/">Component Library</Link>
          {canEdit && (
            <Link className="btn btn-primary" href="/ads/new/">+ Build New Ad</Link>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select className="form-input" value={offerFilter} onChange={e => setOfferFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All offers</option>
          {offers.map(o => (
            <option key={o.id} value={o.id}>{o.code ?? '—'} · {o.name}</option>
          ))}
        </select>
        <select className="form-input" value={audienceFilter} onChange={e => setAudienceFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="all">All audiences</option>
          {avatars.map(a => (
            <option key={a.id} value={a.id}>{a.code ?? '—'} · {a.name}</option>
          ))}
        </select>
        <select className="form-input" value={bodyFilter} onChange={e => setBodyFilter(e.target.value as BodyFilter)} style={{ maxWidth: 160 }}>
          <option value="all">Any body</option>
          {AD_BODY_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {filteredAds.length === 0 ? (
        <div className="empty-state">
          {ads.length === 0
            ? 'No ads yet. Build your first one to get started.'
            : 'No ads match the current filters.'}
        </div>
      ) : (
        <div className="card-grid">
          {filteredAds.map(ad => {
            const offer    = offers.find(o => o.id === ad.offer_id)
            const audience = avatars.find(a => a.id === ad.audience_id)
            const bh       = componentById.get(ad.bh_component_id)
            const body     = componentById.get(ad.body_component_id)
            const cta      = componentById.get(ad.cta_component_id)
            return (
              <div key={ad.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div className="card-title" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, wordBreak: 'break-all' }}>{ad.name}</div>
                  <span className={`badge badge-${ad.status}`}>{ad.status}</span>
                </div>
                <div className="card-meta">{offer?.name ?? '—'} &bull; {audience?.name ?? '—'} &bull; body: {body?.type ?? '?'}</div>
                <div className="card-body" style={{ marginTop: 8, fontSize: 13 }}>
                  <div style={{ marginBottom: 4 }}><strong>{bh?.content ?? '—'}</strong></div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{body?.content ?? '—'}</div>
                  <div style={{ color: 'var(--accent)' }}>{cta?.content ?? '—'}</div>
                </div>
                <div className="card-actions">
                  <Link className="btn btn-secondary btn-sm" href={`/ads/${ad.id}/`}>Open</Link>
                  {canEdit && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ad.id)}>Delete</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
