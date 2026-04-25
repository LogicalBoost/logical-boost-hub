'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import { AD_COMPONENT_TYPES, BH_LENGTH_HARD, BH_LENGTH_WARN } from '@/types/database'
import type { AdComponent, AdComponentType, Avatar } from '@/types/database'

export default function AdLibraryPage() {
  const { client, adComponents, avatars, refreshAdComponents, canEdit } = useAppStore()
  const [activeType, setActiveType] = useState<AdComponentType>('BH')
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newAudienceIds, setNewAudienceIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editAudienceIds, setEditAudienceIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const isBh = activeType === 'BH'
  const components = useMemo(
    () => adComponents.filter(c => c.type === activeType).sort((a, b) => a.per_client_seq - b.per_client_seq),
    [adComponents, activeType],
  )
  const counts = useMemo(() => {
    const by: Record<AdComponentType, number> = { BH: 0, SH: 0, T: 0, PC: 0, CTA: 0 }
    for (const c of adComponents) by[c.type]++
    return by
  }, [adComponents])

  function startAdd() {
    setAdding(true)
    setNewContent('')
    setNewAudienceIds([])
    setEditingId(null)
  }

  function startEdit(c: AdComponent) {
    setEditingId(c.id)
    setEditContent(c.content)
    setEditAudienceIds(c.audience_ids)
    setAdding(false)
  }

  async function handleCreate() {
    if (!client) return
    if (!newContent.trim()) { showToast('Enter content'); return }
    if (isBh) {
      if (newContent.length > BH_LENGTH_HARD) { showToast(`BH must be ≤${BH_LENGTH_HARD} chars`); return }
      if (newAudienceIds.length === 0)        { showToast('BH must be tagged to at least one audience'); return }
    }
    setBusy(true)
    try {
      const { error } = await supabase.from('ad_components').insert({
        client_id: client.id,
        type: activeType,
        content: newContent.trim(),
        audience_ids: isBh ? newAudienceIds : [],
      })
      if (error) throw error
      await refreshAdComponents(client.id)
      setAdding(false)
      setNewContent('')
      setNewAudienceIds([])
      showToast(`${activeType} created`)
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit(c: AdComponent) {
    if (!client) return
    if (!editContent.trim()) { showToast('Enter content'); return }
    if (c.type === 'BH') {
      if (editContent.length > BH_LENGTH_HARD) { showToast(`BH must be ≤${BH_LENGTH_HARD} chars`); return }
      if (editAudienceIds.length === 0)        { showToast('BH must be tagged to at least one audience'); return }
    }
    setBusy(true)
    try {
      const { error } = await supabase
        .from('ad_components')
        .update({ content: editContent.trim(), audience_ids: c.type === 'BH' ? editAudienceIds : [] })
        .eq('id', c.id)
      if (error) throw error
      await refreshAdComponents(client.id)
      setEditingId(null)
      showToast('Saved (component version bumped)')
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(c: AdComponent) {
    if (!client) return
    if (!confirm(`Delete ${c.type}${c.per_client_seq}? Ads referencing it will block this delete.`)) return
    try {
      const { error } = await supabase.from('ad_components').delete().eq('id', c.id)
      if (error) throw error
      await refreshAdComponents(client.id)
      showToast('Deleted')
    } catch (err) {
      showToast('Cannot delete: ' + (err as Error).message)
    }
  }

  if (!client) {
    return (
      <div>
        <div className="page-header"><div><h1 className="page-title">Ad Component Library</h1></div></div>
        <div className="empty-state">Select a client to manage components.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ad Component Library</h1>
          <p className="page-subtitle">Reusable copy blocks for the Ad Builder</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-secondary" href="/ads/">← Back to ads</Link>
          {canEdit && (
            <button className="btn btn-primary" onClick={startAdd}>+ New {activeType}</button>
          )}
        </div>
      </div>

      <div className="funnel-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {AD_COMPONENT_TYPES.map(t => (
          <button
            key={t.value}
            className={`funnel-tab ${activeType === t.value ? 'funnel-tab-active' : ''}`}
            onClick={() => { setActiveType(t.value); setAdding(false); setEditingId(null) }}
          >
            {t.label} ({t.value})
            {counts[t.value] > 0 && <span className="funnel-tab-count">{counts[t.value]}</span>}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-secondary, #1a1a1a)', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
        {AD_COMPONENT_TYPES.find(t => t.value === activeType)?.help}
      </div>

      {adding && canEdit && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">New {activeType}</div>
          <div className="card-body">
            {isBh && <BannerHeadlineRules />}
            <textarea
              className="form-textarea"
              rows={isBh ? 2 : 3}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={isBh ? 'e.g. Are you undocumented? You have options.' : activeType === 'CTA' ? 'e.g. Get My Free Consultation' : 'Enter content…'}
            />
            {isBh && <CharCounter len={newContent.length} />}
            {isBh && (
              <AudienceTagger
                avatars={avatars}
                audienceIds={newAudienceIds}
                setAudienceIds={setNewAudienceIds}
              />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={busy}>
                {busy ? 'Creating…' : `Create ${activeType}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {components.length === 0 ? (
        <div className="empty-state">
          {canEdit ? `No ${activeType} components yet. Click "+ New ${activeType}" to add one.` : `No ${activeType} components.`}
        </div>
      ) : (
        <div className="card-grid">
          {components.map(c => {
            const isEditing = editingId === c.id
            return (
              <div key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div className="card-title">{c.type}{c.per_client_seq}</div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>v{c.version}</span>
                </div>
                {isEditing ? (
                  <div style={{ marginTop: 8 }}>
                    {c.type === 'BH' && <BannerHeadlineRules />}
                    <textarea
                      className="form-textarea"
                      rows={c.type === 'BH' ? 2 : 3}
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                    />
                    {c.type === 'BH' && <CharCounter len={editContent.length} />}
                    {c.type === 'BH' && (
                      <AudienceTagger
                        avatars={avatars}
                        audienceIds={editAudienceIds}
                        setAudienceIds={setEditAudienceIds}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)} disabled={busy}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(c)} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="card-body" style={{ marginTop: 8 }}>{c.content}</div>
                    {c.type === 'BH' && (
                      <div className="tag-list" style={{ marginTop: 8 }}>
                        {c.audience_ids.map(aid => {
                          const a = avatars.find(av => av.id === aid)
                          return <span key={aid} className="tag">{a?.code ?? '—'} · {a?.name ?? aid}</span>
                        })}
                      </div>
                    )}
                    {canEdit && (
                      <div className="card-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BannerHeadlineRules() {
  return (
    <div style={{ background: 'var(--bg-secondary, #222)', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
      <strong>Banner Headline rules:</strong> short (≤{BH_LENGTH_HARD} chars), calls out the audience by name or trait, opens a loop or asks a question.
      Generic headlines like &quot;Do you need a lawyer?&quot; aren&apos;t hooks — say who you&apos;re talking to.
    </div>
  )
}

function CharCounter({ len }: { len: number }) {
  const overHard = len > BH_LENGTH_HARD
  const overWarn = len > BH_LENGTH_WARN && !overHard
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, marginTop: 4 }}>
      <span style={{ color: overHard ? 'var(--danger, #ef4444)' : overWarn ? 'var(--warning, #f59e0b)' : 'var(--text-secondary)' }}>
        {len} / {BH_LENGTH_HARD} chars{overWarn ? ' · getting long' : ''}{overHard ? ' · too long' : ''}
      </span>
    </div>
  )
}

function AudienceTagger({
  avatars,
  audienceIds,
  setAudienceIds,
}: {
  avatars: Avatar[]
  audienceIds: string[]
  setAudienceIds: (v: string[]) => void
}) {
  return (
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
  )
}
