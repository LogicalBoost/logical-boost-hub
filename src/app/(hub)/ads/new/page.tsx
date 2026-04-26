'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import {
  AD_BODY_SH_TYPES, AD_BODY_PC_TYPES, AD_CTA_TYPES,
  BH_LENGTH_HARD, BH_LENGTH_WARN,
} from '@/types/database'
import type { Avatar, CopyComponent } from '@/types/database'
import { bhSeqFor } from '@/types/database'

type BodyGroup = 'SH' | 'PC'

export default function NewAdPage() {
  const router = useRouter()
  const {
    client, copyComponents, offers, avatars,
    refreshCopyComponents, refreshAds, canEdit,
  } = useAppStore()
  const bannerHeadlines = useMemo(
    () => copyComponents.filter(c => c.type === 'banner_headline'),
    [copyComponents],
  )

  const [offerId, setOfferId] = useState<string>('')
  const [audienceId, setAudienceId] = useState<string>('')
  const [bhId, setBhId] = useState<string>('')
  const [bodyGroup, setBodyGroup] = useState<BodyGroup>('SH')
  const [bodyId, setBodyId] = useState<string>('')
  const [ctaId, setCtaId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Inline create — BH only (other types live in /copy/).
  const [creatingBh, setCreatingBh] = useState(false)
  const [newBhContent, setNewBhContent] = useState('')
  const [newBhAudienceIds, setNewBhAudienceIds] = useState<string[]>([])
  const [bhBusy, setBhBusy] = useState(false)

  const offer    = offers.find(o => o.id === offerId)
  const audience = avatars.find(a => a.id === audienceId)
  const bh       = bannerHeadlines.find(c => c.id === bhId)
  const body     = copyComponents.find(c => c.id === bodyId)
  const cta      = copyComponents.find(c => c.id === ctaId)

  const bhOptions = useMemo(() => (
    bannerHeadlines.filter(c => audienceId ? c.avatar_ids.includes(audienceId) : true)
  ), [bannerHeadlines, audienceId])

  const bodyOptions = useMemo(() => {
    const allowed = bodyGroup === 'SH' ? AD_BODY_SH_TYPES : AD_BODY_PC_TYPES
    if (!client) return []
    return copyComponents
      .filter(c => c.client_id === client.id && allowed.includes(c.type) && c.status === 'approved')
      .sort((a, b) => a.created_at < b.created_at ? -1 : 1)
  }, [copyComponents, bodyGroup, client])

  const ctaOptions = useMemo(() => {
    if (!client) return []
    return copyComponents
      .filter(c => c.client_id === client.id && AD_CTA_TYPES.includes(c.type) && c.status === 'approved')
      .sort((a, b) => a.created_at < b.created_at ? -1 : 1)
  }, [copyComponents, client])

  const previewName = useMemo(() => {
    if (!offer || !audience || !bh || !body || !cta) return null
    // Stable per-client per-group seq for body and cta. We compute these
    // client-side here to match what the trigger would produce.
    const bodyAllowed = bodyGroup === 'SH' ? AD_BODY_SH_TYPES : AD_BODY_PC_TYPES
    const bodyPool = copyComponents.filter(c => c.client_id === offer.client_id && bodyAllowed.includes(c.type))
    const bodyOrdered = [...bodyPool].sort((a, b) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1)
    const bodySeq = bodyOrdered.findIndex(c => c.id === body.id) + 1

    const ctaPool = copyComponents.filter(c => c.client_id === offer.client_id && AD_CTA_TYPES.includes(c.type))
    const ctaOrdered = [...ctaPool].sort((a, b) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1)
    const ctaSeq = ctaOrdered.findIndex(c => c.id === cta.id) + 1
    const bhSeq = bhSeqFor(bh, copyComponents)
    return `AU${audience.display_id}_OF${offer.display_id}_BH${bhSeq}-${bodyGroup}${bodySeq}-CTA${ctaSeq}`
  }, [offer, audience, bh, body, cta, bodyGroup, copyComponents])

  function setAudienceAndClearBh(id: string) {
    setAudienceId(id)
    const current = bannerHeadlines.find(c => c.id === bhId)
    if (current && !current.avatar_ids.includes(id)) setBhId('')
  }

  async function handleCreateBh() {
    if (!client) return
    if (!newBhContent.trim()) { showToast('Enter content'); return }
    if (newBhContent.length > BH_LENGTH_HARD) { showToast(`BH must be ≤${BH_LENGTH_HARD} chars`); return }
    if (newBhAudienceIds.length === 0) { showToast('BH must be tagged to at least one audience'); return }
    setBhBusy(true)
    try {
      // BH rows live in copy_components and need a segment_id (this DB has a
      // NOT NULL on segment_id; default segment exists per client).
      const { data: seg } = await supabase
        .from('segments').select('id').eq('client_id', client.id).eq('is_default', true).single()
      const { data, error } = await supabase.from('copy_components').insert({
        client_id: client.id,
        type: 'banner_headline',
        text: newBhContent.trim(),
        avatar_ids: newBhAudienceIds,
        segment_id: seg?.id,
        status: 'approved',
      }).select('*').single()
      if (error) throw error
      await refreshCopyComponents(client.id)
      setBhId(data.id)
      setCreatingBh(false)
      setNewBhContent('')
      setNewBhAudienceIds([])
      showToast('Banner Headline created')
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setBhBusy(false)
    }
  }

  async function handleSave() {
    if (!client || !offer || !audience || !bh || !body || !cta) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('ads').insert({
        client_id:         client.id,
        offer_id:          offer.id,
        audience_id:       audience.id,
        bh_component_id:   bh.id,
        body_component_id: body.id,
        cta_component_id:  cta.id,
        status: 'approved',
      }).select('*').single()
      if (error) throw error
      await refreshAds(client.id)
      showToast(`Ad ${data.name} created`)
      router.push(`/ads/${data.id}/`)
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!client) {
    return (
      <div>
        <div className="page-header"><div><h1 className="page-title">Build New Ad</h1></div></div>
        <div className="empty-state">Select a client first.</div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div>
        <div className="page-header"><div><h1 className="page-title">Build New Ad</h1></div></div>
        <div className="empty-state">Read-only role. Switch to an editor account to compose ads.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Build New Ad</h1>
          <p className="page-subtitle">Pick a Banner Headline, body, and CTA for one offer × audience pair.</p>
        </div>
        <Link className="btn btn-secondary" href="/ads/">← Back to ads</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">1. Offer</div>
        <div className="card-body">
          <select className="form-input" value={offerId} onChange={e => setOfferId(e.target.value)}>
            <option value="">— Select an offer —</option>
            {offers.map(o => (
              <option key={o.id} value={o.id}>OF{o.display_id} · {o.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">2. Audience</div>
        <div className="card-body">
          <select className="form-input" value={audienceId} onChange={e => setAudienceAndClearBh(e.target.value)}>
            <option value="">— Select an audience —</option>
            {avatars.map(a => (
              <option key={a.id} value={a.id}>AU{a.display_id} · {a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">3. Top — Banner Headline</div>
        <div className="card-body">
          {!audienceId && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Pick an audience first to see eligible Banner Headlines.</div>
          )}
          <select className="form-input" value={bhId} onChange={e => setBhId(e.target.value)} disabled={!audienceId}>
            <option value="">— Select a Banner Headline —</option>
            {bhOptions.map(c => (
              <option key={c.id} value={c.id}>BH{bhSeqFor(c, copyComponents)} · {c.text}</option>
            ))}
          </select>
          {audienceId && bhOptions.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              No Banner Headlines tagged for this audience yet.
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setCreatingBh(true); setNewBhAudienceIds(audienceId ? [audienceId] : []) }}
              disabled={!audienceId}
            >
              + New Banner Headline
            </button>
          </div>
          {creatingBh && (
            <BhInlineCreate
              busy={bhBusy}
              content={newBhContent}
              setContent={setNewBhContent}
              audienceIds={newBhAudienceIds}
              setAudienceIds={setNewBhAudienceIds}
              avatars={avatars}
              onCancel={() => { setCreatingBh(false); setNewBhContent(''); setNewBhAudienceIds([]) }}
              onCreate={handleCreateBh}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">4. Body (Subheadline or Proof)</div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              className={`btn btn-sm ${bodyGroup === 'SH' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setBodyGroup('SH'); setBodyId('') }}
            >
              Subheadline
            </button>
            <button
              className={`btn btn-sm ${bodyGroup === 'PC' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setBodyGroup('PC'); setBodyId('') }}
            >
              Proof Copy
            </button>
          </div>
          <select className="form-input" value={bodyId} onChange={e => setBodyId(e.target.value)}>
            <option value="">— Select a {bodyGroup} component —</option>
            {bodyOptions.map(c => (
              <option key={c.id} value={c.id}>{c.text.length > 80 ? c.text.slice(0, 80) + '…' : c.text}</option>
            ))}
          </select>
          {bodyOptions.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              No {bodyGroup === 'SH' ? 'subheadline' : 'proof'} copy yet. Add some via <Link href="/copy/" style={{ color: 'var(--accent)' }}>/copy</Link>.
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">5. Call to Action</div>
        <div className="card-body">
          <select className="form-input" value={ctaId} onChange={e => setCtaId(e.target.value)}>
            <option value="">— Select a CTA —</option>
            {ctaOptions.map(c => (
              <option key={c.id} value={c.id}>{c.text.length > 80 ? c.text.slice(0, 80) + '…' : c.text}</option>
            ))}
          </select>
          {ctaOptions.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              No CTAs yet. Add some via <Link href="/copy/" style={{ color: 'var(--accent)' }}>/copy</Link>.
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Preview</div>
        <div className="card-body">
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, marginBottom: 12, wordBreak: 'break-all' }}>
            <strong>Name:</strong> {previewName ?? '— pick all 5 slots to see the generated name —'}
          </div>
          <div style={{ background: 'var(--bg-secondary, #1a1a1a)', padding: 24, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border, #333)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, minHeight: 28 }}>
              {bh?.text ?? <span style={{ color: 'var(--text-secondary)' }}>Banner headline goes here</span>}
            </div>
            <div style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)', minHeight: 22 }}>
              {body?.text ?? 'Body copy goes here'}
            </div>
            <button className="btn btn-primary" type="button" disabled>{cta?.text ?? 'CTA'}</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Link className="btn btn-secondary" href="/ads/">Cancel</Link>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !offer || !audience || !bh || !body || !cta}
        >
          {saving ? 'Saving…' : 'Save Ad'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BhInlineCreate — small editor for adding a Banner Headline without leaving
// ---------------------------------------------------------------------------
function BhInlineCreate({
  busy,
  content,
  setContent,
  audienceIds,
  setAudienceIds,
  avatars,
  onCancel,
  onCreate,
}: {
  busy: boolean
  content: string
  setContent: (v: string) => void
  audienceIds: string[]
  setAudienceIds: (v: string[]) => void
  avatars: Avatar[]
  onCancel: () => void
  onCreate: () => void
}) {
  const len = content.length
  const overHard = len > BH_LENGTH_HARD
  const overWarn = len > BH_LENGTH_WARN

  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border, #333)', borderRadius: 8 }}>
      <div style={{ background: 'var(--bg-secondary, #222)', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
        <strong>Banner Headline rules:</strong> short (≤{BH_LENGTH_HARD} chars), calls out the audience by name or trait, opens a loop or asks a question.
      </div>
      <textarea
        className="form-textarea"
        rows={2}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="e.g. Are you undocumented? You have options."
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, marginTop: 4 }}>
        <span style={{ color: overHard ? 'var(--danger, #ef4444)' : overWarn ? 'var(--warning, #f59e0b)' : 'var(--text-secondary)' }}>
          {len} / {BH_LENGTH_HARD} chars{overWarn && !overHard ? ' · getting long' : ''}{overHard ? ' · too long' : ''}
        </span>
      </div>
      <div style={{ marginTop: 10 }}>
        <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Audiences this BH targets *</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {avatars.map(a => {
            const checked = audienceIds.includes(a.id)
            return (
              <label key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--border, #333)', borderRadius: 999, fontSize: 13, cursor: 'pointer', background: checked ? 'var(--accent, #3b82f6)' : 'transparent', color: checked ? '#fff' : 'inherit' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setAudienceIds(checked ? audienceIds.filter(id => id !== a.id) : [...audienceIds, a.id])}
                  style={{ display: 'none' }}
                />
                AU{a.display_id} · {a.name}
              </label>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={onCreate}
          disabled={busy || content.trim().length === 0 || overHard || audienceIds.length === 0}
        >
          {busy ? 'Creating…' : 'Create BH'}
        </button>
      </div>
    </div>
  )
}

