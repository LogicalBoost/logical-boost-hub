'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import { AD_BODY_TYPES, BH_LENGTH_HARD, BH_LENGTH_WARN, CODE_REGEX } from '@/types/database'
import type { AdComponent, AdComponentType } from '@/types/database'

type BodyType = 'SH' | 'T' | 'PC'

export default function NewAdPage() {
  const router = useRouter()
  const { client, adComponents, offers, avatars, refreshAdComponents, refreshAds, refreshOffers, refreshAvatars, canEdit } = useAppStore()

  const [offerId, setOfferId] = useState<string>('')
  const [audienceId, setAudienceId] = useState<string>('')
  const [bhId, setBhId] = useState<string>('')
  const [bodyType, setBodyType] = useState<BodyType>('SH')
  const [bodyId, setBodyId] = useState<string>('')
  const [ctaId, setCtaId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Inline create state per type
  const [inlineCreate, setInlineCreate] = useState<AdComponentType | null>(null)
  const [newContent, setNewContent] = useState('')
  const [newAudienceIds, setNewAudienceIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const offer    = offers.find(o => o.id === offerId)
  const audience = avatars.find(a => a.id === audienceId)
  const bh       = adComponents.find(c => c.id === bhId)
  const body     = adComponents.find(c => c.id === bodyId)
  const cta      = adComponents.find(c => c.id === ctaId)

  // BH options must include the chosen audience in audience_ids.
  const bhOptions = useMemo(() => (
    adComponents.filter(c => c.type === 'BH' && (audienceId ? c.audience_ids.includes(audienceId) : true))
  ), [adComponents, audienceId])

  const bodyOptions = useMemo(() => (
    adComponents.filter(c => c.type === bodyType)
  ), [adComponents, bodyType])

  const ctaOptions = useMemo(() => (
    adComponents.filter(c => c.type === 'CTA')
  ), [adComponents])

  // Live name preview
  const previewName = useMemo(() => {
    if (!offer?.code || !audience?.code || !bh || !body || !cta) return null
    return `${offer.code}_${audience.code}_BH${bh.per_client_seq}-${body.type}${body.per_client_seq}-CTA${cta.per_client_seq}`
  }, [offer, audience, bh, body, cta])

  function clearBodyOnTypeChange(t: BodyType) {
    setBodyType(t)
    setBodyId('')
  }

  function clearBhOnAudienceChange(id: string) {
    setAudienceId(id)
    // If currently selected BH isn't tagged for this audience, clear it.
    const current = adComponents.find(c => c.id === bhId)
    if (current && !current.audience_ids.includes(id)) setBhId('')
  }

  async function handleCreate(type: AdComponentType) {
    if (!client) return
    setCreating(true)
    try {
      if (type === 'BH') {
        if (newContent.trim().length === 0) { showToast('Enter content'); return }
        if (newContent.length > BH_LENGTH_HARD) { showToast(`Banner Headline must be ≤${BH_LENGTH_HARD} chars`); return }
        if (newAudienceIds.length === 0) { showToast('BH must be tagged to at least one audience'); return }
      }
      const insert: Partial<AdComponent> & { client_id: string; type: AdComponentType; content: string; audience_ids: string[] } = {
        client_id: client.id,
        type,
        content: newContent.trim(),
        audience_ids: type === 'BH' ? newAudienceIds : [],
      }
      const { data, error } = await supabase.from('ad_components').insert(insert).select('*').single()
      if (error) throw error
      await refreshAdComponents(client.id)
      // Auto-select the newly created component into the appropriate slot.
      if (type === 'BH')         setBhId(data.id)
      else if (type === 'CTA')   setCtaId(data.id)
      else                       { setBodyType(type as BodyType); setBodyId(data.id) }
      setInlineCreate(null)
      setNewContent('')
      setNewAudienceIds([])
      showToast(`${type} created`)
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleSave() {
    if (!client || !offer || !audience || !bh || !body || !cta) return
    if (!offer.code || !audience.code) {
      showToast('Offer and Audience must each have a short code before they can be used in an ad.')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('ads').insert({
        client_id:         client.id,
        offer_id:          offer.id,
        audience_id:       audience.id,
        bh_component_id:   bh.id,
        body_component_id: body.id,
        cta_component_id:  cta.id,
        // versions are filled by the validate-and-fill trigger; we have to send
        // *something* because the columns are NOT NULL with no default.
        bh_component_version:   bh.version,
        body_component_version: body.version,
        cta_component_version:  cta.version,
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
        <div className="page-header">
          <div>
            <h1 className="page-title">Build New Ad</h1>
          </div>
        </div>
        <div className="empty-state">Select a client first.</div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Build New Ad</h1>
          </div>
        </div>
        <div className="empty-state">Read-only role. Switch to an editor account to compose ads.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Build New Ad</h1>
          <p className="page-subtitle">Compose a banner from BH + body + CTA</p>
        </div>
        <Link className="btn btn-secondary" href="/ads/">← Back to ads</Link>
      </div>

      {/* Codes editor — inline for any offer/audience missing a short code */}
      {(offers.some(o => !o.code) || avatars.some(a => !a.code)) && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning)' }}>
          <div className="card-title" style={{ color: 'var(--warning)' }}>Set short codes for offers and audiences</div>
          <div className="card-body" style={{ fontSize: 14 }}>
            <p style={{ marginTop: 0, marginBottom: 12 }}>
              Ad names depend on a short code (2–6 uppercase letters/digits) on each offer and audience. Set the missing codes below.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="grid-2col-responsive">
              <CodeEditor
                heading="Offers"
                rows={offers.filter(o => !o.code).map(o => ({ id: o.id, name: o.name }))}
                table="offers"
                existingCodes={offers.map(o => o.code).filter(Boolean) as string[]}
                onSaved={() => client && refreshOffers(client.id)}
              />
              <CodeEditor
                heading="Audiences"
                rows={avatars.filter(a => !a.code).map(a => ({ id: a.id, name: a.name }))}
                table="avatars"
                existingCodes={avatars.map(a => a.code).filter(Boolean) as string[]}
                onSaved={() => client && refreshAvatars(client.id)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">1. Offer</div>
        <div className="card-body">
          <select className="form-input" value={offerId} onChange={e => setOfferId(e.target.value)}>
            <option value="">— Select an offer —</option>
            {offers.map(o => (
              <option key={o.id} value={o.id} disabled={!o.code}>
                {o.code ?? 'NO_CODE'} · {o.name}{!o.code ? ' (set a code)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">2. Audience</div>
        <div className="card-body">
          <select className="form-input" value={audienceId} onChange={e => clearBhOnAudienceChange(e.target.value)}>
            <option value="">— Select an audience —</option>
            {avatars.map(a => (
              <option key={a.id} value={a.id} disabled={!a.code}>
                {a.code ?? 'NO_CODE'} · {a.name}{!a.code ? ' (set a code)' : ''}
              </option>
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
              <option key={c.id} value={c.id}>BH{c.per_client_seq} · {c.content}</option>
            ))}
          </select>
          {audienceId && bhOptions.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              No Banner Headlines tagged for this audience yet.
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setInlineCreate('BH'); setNewAudienceIds(audienceId ? [audienceId] : []) }} disabled={!audienceId}>
              + New Banner Headline
            </button>
          </div>
          {inlineCreate === 'BH' && (
            <InlineCreate
              type="BH"
              creating={creating}
              content={newContent}
              setContent={setNewContent}
              audienceIds={newAudienceIds}
              setAudienceIds={setNewAudienceIds}
              avatars={avatars}
              onCancel={() => { setInlineCreate(null); setNewContent(''); setNewAudienceIds([]) }}
              onCreate={() => handleCreate('BH')}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">4. Body</div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {AD_BODY_TYPES.map(t => (
              <button
                key={t}
                className={`btn btn-sm ${bodyType === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => clearBodyOnTypeChange(t as BodyType)}
              >
                {t === 'SH' ? 'Subheadline' : t === 'T' ? 'Trust Signal' : 'Proof Copy'}
              </button>
            ))}
          </div>
          <select className="form-input" value={bodyId} onChange={e => setBodyId(e.target.value)}>
            <option value="">— Select a {bodyType} —</option>
            {bodyOptions.map(c => (
              <option key={c.id} value={c.id}>{c.type}{c.per_client_seq} · {c.content}</option>
            ))}
          </select>
          {bodyOptions.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              No {bodyType} components yet.
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setInlineCreate(bodyType)}>
              + New {bodyType}
            </button>
          </div>
          {inlineCreate === bodyType && (
            <InlineCreate
              type={bodyType}
              creating={creating}
              content={newContent}
              setContent={setNewContent}
              audienceIds={[]}
              setAudienceIds={() => {}}
              avatars={[]}
              onCancel={() => { setInlineCreate(null); setNewContent('') }}
              onCreate={() => handleCreate(bodyType)}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">5. Call to Action</div>
        <div className="card-body">
          <select className="form-input" value={ctaId} onChange={e => setCtaId(e.target.value)}>
            <option value="">— Select a CTA —</option>
            {ctaOptions.map(c => (
              <option key={c.id} value={c.id}>CTA{c.per_client_seq} · {c.content}</option>
            ))}
          </select>
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setInlineCreate('CTA')}>
              + New CTA
            </button>
          </div>
          {inlineCreate === 'CTA' && (
            <InlineCreate
              type="CTA"
              creating={creating}
              content={newContent}
              setContent={setNewContent}
              audienceIds={[]}
              setAudienceIds={() => {}}
              avatars={[]}
              onCancel={() => { setInlineCreate(null); setNewContent('') }}
              onCreate={() => handleCreate('CTA')}
            />
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Preview</div>
        <div className="card-body">
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, marginBottom: 12, wordBreak: 'break-all' }}>
            <strong>Name:</strong> {previewName ?? '— pick all 5 slots to see the generated name —'}
          </div>
          <div style={{ background: 'var(--bg-secondary, #1a1a1a)', padding: 24, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border, #333)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, minHeight: 28 }}>
              {bh?.content ?? <span style={{ color: 'var(--text-secondary)' }}>Banner headline goes here</span>}
            </div>
            <div style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)', minHeight: 22 }}>
              {body?.content ?? 'Body copy goes here'}
            </div>
            <button className="btn btn-primary" type="button" disabled>
              {cta?.content ?? 'CTA'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Link className="btn btn-secondary" href="/ads/">Cancel</Link>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !offer?.code || !audience?.code || !bh || !body || !cta}
        >
          {saving ? 'Saving…' : 'Save Ad'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineCreate — small editor for adding a component without leaving this page
// ---------------------------------------------------------------------------
function InlineCreate({
  type,
  creating,
  content,
  setContent,
  audienceIds,
  setAudienceIds,
  avatars,
  onCancel,
  onCreate,
}: {
  type: AdComponentType
  creating: boolean
  content: string
  setContent: (v: string) => void
  audienceIds: string[]
  setAudienceIds: (v: string[]) => void
  avatars: { id: string; name: string; code: string | null }[]
  onCancel: () => void
  onCreate: () => void
}) {
  const isBh = type === 'BH'
  const len = content.length
  const overHard = isBh && len > BH_LENGTH_HARD
  const overWarn = isBh && len > BH_LENGTH_WARN

  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border, #333)', borderRadius: 8 }}>
      {isBh && (
        <div style={{ background: 'var(--bg-secondary, #222)', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
          <strong>Banner Headline rules:</strong> short (≤{BH_LENGTH_HARD} chars), calls out the audience by name or trait, opens a loop or asks a question.
          Generic headlines like &quot;Do you need a lawyer?&quot; aren&apos;t hooks — say who you&apos;re talking to.
        </div>
      )}
      <textarea
        className="form-textarea"
        rows={isBh ? 2 : 3}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={isBh ? 'e.g. Are you undocumented? You have options.' : type === 'CTA' ? 'e.g. Get My Free Consultation' : 'Enter content…'}
      />
      {isBh && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span style={{ color: overHard ? 'var(--danger, #ef4444)' : overWarn ? 'var(--warning, #f59e0b)' : 'var(--text-secondary)' }}>
            {len} / {BH_LENGTH_HARD} chars{overWarn && !overHard ? ' · getting long' : ''}{overHard ? ' · too long' : ''}
          </span>
        </div>
      )}
      {isBh && (
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
                  {a.code ?? '—'} · {a.name}
                </label>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={creating}>Cancel</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={onCreate}
          disabled={creating || content.trim().length === 0 || overHard || (isBh && audienceIds.length === 0)}
        >
          {creating ? 'Creating…' : `Create ${type}`}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CodeEditor — inline panel for assigning short codes to offers / audiences
// ---------------------------------------------------------------------------
function CodeEditor({
  heading,
  rows,
  table,
  existingCodes,
  onSaved,
}: {
  heading: string
  rows: { id: string; name: string }[]
  table: 'offers' | 'avatars'
  existingCodes: string[]
  onSaved: () => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{heading}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>All have codes ✓</div>
      </div>
    )
  }

  async function handleSave(id: string) {
    const code = (drafts[id] ?? '').toUpperCase().trim()
    if (!CODE_REGEX.test(code)) { showToast('Code must be 2–6 uppercase letters/digits'); return }
    if (existingCodes.includes(code)) { showToast(`Code "${code}" is already in use for another ${table === 'offers' ? 'offer' : 'audience'}`); return }
    setSaving(id)
    try {
      const { error } = await supabase.from(table).update({ code }).eq('id', id)
      if (error) throw error
      onSaved()
      showToast(`Code ${code} saved`)
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{heading}</div>
      {rows.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            className="form-input"
            value={drafts[r.id] ?? ''}
            placeholder="CODE"
            maxLength={6}
            onChange={e => setDrafts({ ...drafts, [r.id]: e.target.value.toUpperCase() })}
            style={{ width: 90, textTransform: 'uppercase', fontFamily: 'var(--font-mono, monospace)' }}
          />
          <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
          <button
            className="btn btn-primary btn-sm"
            disabled={saving === r.id || !drafts[r.id]}
            onClick={() => handleSave(r.id)}
          >
            {saving === r.id ? 'Saving…' : 'Save'}
          </button>
        </div>
      ))}
    </div>
  )
}
