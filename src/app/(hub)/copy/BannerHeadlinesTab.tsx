'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import { generateBannerHeadlines } from '@/lib/api'
import { BH_LENGTH_HARD, BH_LENGTH_WARN } from '@/types/database'
import type { Avatar, Client, CopyComponent, Offer } from '@/types/database'

// Banner Headlines column on /copy/. Each BH lives in copy_components with
// type = 'banner_headline' and uses avatar_ids to tag the targeted audience(s).
//
// The audience and offer come from the page-level selectors at the top of
// /copy/ — the same ones that scope every other tab. We do NOT introduce a
// second set of dropdowns here.

export default function BannerHeadlinesTab({
  client,
  avatars,
  offers,
  bhs,
  refreshCopy,
  canEdit,
  selectedAudienceId,
  selectedOfferId,
}: {
  client: Client
  avatars: Avatar[]
  offers: Offer[]
  bhs: CopyComponent[]
  refreshCopy: () => Promise<void>
  canEdit: boolean
  selectedAudienceId: string
  selectedOfferId: string
}) {
  const audience = avatars.find(a => a.id === selectedAudienceId) ?? null
  const offer    = offers.find(o => o.id === selectedOfferId)   ?? null

  // Manual add state — pre-tag with the page-level audience.
  const [manualOpen, setManualOpen] = useState(false)
  const [manualText, setManualText] = useState('')
  const [manualAudienceIds, setManualAudienceIds] = useState<string[]>([])
  const [manualBusy, setManualBusy] = useState(false)

  // When the page-level audience changes, default the manual-add audience
  // selection to that audience (user can still pick more).
  useEffect(() => {
    if (selectedAudienceId) setManualAudienceIds([selectedAudienceId])
  }, [selectedAudienceId])

  // AI generation state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiCount, setAiCount] = useState(8)
  const [aiUserPrompt, setAiUserPrompt] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set())
  const [aiSaving, setAiSaving] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editAudienceIds, setEditAudienceIds] = useState<string[]>([])
  const [editBusy, setEditBusy] = useState(false)

  const approvedAvatars = useMemo(() => avatars.filter(a => a.status === 'approved'), [avatars])

  // Filter BHs by the page-level audience. If no audience is selected at the
  // page level (rare — the page auto-picks the primary on load), show all.
  const visible = useMemo(() => {
    return bhs
      .filter(bh => selectedAudienceId
        ? Array.isArray(bh.avatar_ids) && bh.avatar_ids.includes(selectedAudienceId)
        : true)
      .sort((a, b) => a.created_at < b.created_at ? -1 : 1)
  }, [bhs, selectedAudienceId])

  async function getDefaultSegmentId(): Promise<string | null> {
    const { data } = await supabase
      .from('segments').select('id').eq('client_id', client.id).eq('is_default', true).single()
    return data?.id ?? null
  }

  async function handleManualSave() {
    if (!manualText.trim()) { showToast('Enter content'); return }
    if (manualText.length > BH_LENGTH_HARD) { showToast(`BH must be ≤${BH_LENGTH_HARD} chars`); return }
    if (manualAudienceIds.length === 0) { showToast('Tag ≥1 audience'); return }
    setManualBusy(true)
    try {
      const segId = await getDefaultSegmentId()
      const { error } = await supabase.from('copy_components').insert({
        client_id: client.id,
        type: 'banner_headline',
        text: manualText.trim(),
        avatar_ids: manualAudienceIds,
        segment_id: segId,
        status: 'approved',
      })
      if (error) throw error
      await refreshCopy()
      setManualOpen(false)
      setManualText('')
      // Reset the audience tag back to just the page-level audience.
      setManualAudienceIds(selectedAudienceId ? [selectedAudienceId] : [])
      showToast('Banner Headline added')
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setManualBusy(false)
    }
  }

  async function handleGenerate() {
    if (!selectedAudienceId || !selectedOfferId) {
      showToast('Pick an audience and an offer at the top of the page first.')
      return
    }
    setAiBusy(true)
    setAiSuggestions([])
    setAiSelected(new Set())
    try {
      const res = await generateBannerHeadlines(client.id, selectedAudienceId, selectedOfferId, {
        count: aiCount,
        userPrompt: aiUserPrompt.trim() || undefined,
      })
      const list = res.suggestions.BH ?? []
      if (list.length === 0) {
        showToast('No suggestions returned. Try a higher count or rewording the prompt.')
      } else {
        setAiSuggestions(list)
        setAiSelected(new Set(list.map((_, i) => i)))
      }
    } catch (err) {
      showToast('AI generation failed: ' + (err as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  async function handleSaveSelected() {
    const picked = aiSuggestions.filter((_, i) => aiSelected.has(i))
    if (picked.length === 0) { showToast('Pick at least one'); return }
    if (!selectedAudienceId) return
    setAiSaving(true)
    try {
      const segId = await getDefaultSegmentId()
      const rows = picked.map(text => ({
        client_id: client.id,
        type: 'banner_headline',
        text,
        avatar_ids: [selectedAudienceId],
        segment_id: segId,
        status: 'approved',
      }))
      const { error } = await supabase.from('copy_components').insert(rows)
      if (error) throw error
      await refreshCopy()
      showToast(`Saved ${picked.length} Banner Headline${picked.length === 1 ? '' : 's'}`)
      setAiSuggestions([])
      setAiSelected(new Set())
    } catch (err) {
      showToast('Save failed: ' + (err as Error).message)
    } finally {
      setAiSaving(false)
    }
  }

  function startEdit(bh: CopyComponent) {
    setEditingId(bh.id)
    setEditText(bh.text)
    setEditAudienceIds(Array.isArray(bh.avatar_ids) ? bh.avatar_ids : [])
  }

  async function handleSaveEdit(bh: CopyComponent) {
    if (!editText.trim()) { showToast('Enter content'); return }
    if (editText.length > BH_LENGTH_HARD) { showToast(`BH must be ≤${BH_LENGTH_HARD} chars`); return }
    if (editAudienceIds.length === 0) { showToast('Tag ≥1 audience'); return }
    setEditBusy(true)
    try {
      const { error } = await supabase
        .from('copy_components')
        .update({ text: editText.trim(), avatar_ids: editAudienceIds })
        .eq('id', bh.id)
      if (error) throw error
      await refreshCopy()
      setEditingId(null)
      showToast('Saved')
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setEditBusy(false)
    }
  }

  async function handleDelete(bh: CopyComponent) {
    if (!confirm('Delete this Banner Headline? Ads referencing it will block this delete.')) return
    try {
      const { error } = await supabase.from('copy_components').delete().eq('id', bh.id)
      if (error) throw error
      await refreshCopy()
      showToast('Deleted')
    } catch (err) {
      showToast('Cannot delete: ' + (err as Error).message)
    }
  }

  const noContext = !selectedAudienceId || !selectedOfferId

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ background: 'var(--bg-secondary, #1a1a1a)', padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
        <strong>Banner Headlines (BH):</strong> top-slot hooks for ad banners. ≤{BH_LENGTH_HARD} chars. Must call out the audience by name or trait, and open a hook (question, loop, or recognition).
        Used by the <a href="/ads/bulk/" style={{ color: 'var(--accent)' }}>Ad Builder</a> for the BH slot.
        {audience && <> Showing BHs tagged for <strong>{audience.name}</strong>.</>}
      </div>

      {/* Action buttons — use the page-level audience + offer for context */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setAiOpen(o => !o)}
            disabled={aiBusy}
            title={noContext ? 'Pick an audience + offer at the top of the page first' : ''}
          >
            {aiOpen ? 'Hide AI generator' : '✨ Generate with AI'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setManualOpen(o => !o)}
          >
            {manualOpen ? 'Hide manual add' : '+ Add manually'}
          </button>
        </div>
      )}

      {/* Manual add panel */}
      {manualOpen && canEdit && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">New Banner Headline</div>
          <div className="card-body">
            <textarea
              className="form-textarea"
              rows={2}
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="e.g. Are you undocumented? You have options."
            />
            <CharCounter len={manualText.length} />
            <AudienceTagger avatars={approvedAvatars} audienceIds={manualAudienceIds} setAudienceIds={setManualAudienceIds} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setManualOpen(false)} disabled={manualBusy}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleManualSave} disabled={manualBusy}>{manualBusy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* AI generation panel */}
      {aiOpen && canEdit && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">
            Generate with AI
            {audience && offer && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                · for {audience.name} · {offer.name}
              </span>
            )}
          </div>
          <div className="card-body">
            {noContext ? (
              <div style={{ fontSize: 13, color: 'var(--warning)' }}>
                Pick an audience and offer at the top of the page first — the AI needs both for context.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Count:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiCount}
                  onChange={e => setAiCount(Math.max(1, Math.min(20, Number(e.target.value) || 8)))}
                  className="form-input"
                  style={{ width: 80 }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional: extra direction (e.g. 'lean fearful')"
                  value={aiUserPrompt}
                  onChange={e => setAiUserPrompt(e.target.value)}
                  style={{ flex: 1, minWidth: 240 }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={aiBusy || aiSaving}>
                  {aiBusy ? 'Generating…' : aiSuggestions.length > 0 ? 'Regenerate' : 'Generate'}
                </button>
              </div>
            )}

            {aiSuggestions.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {aiSelected.size} of {aiSuggestions.length} selected. Each saved BH is tagged to <strong>{audience?.name}</strong>.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aiSuggestions.map((s, i) => {
                    const checked = aiSelected.has(i)
                    const len = s.length
                    const tooLong = len > BH_LENGTH_HARD
                    return (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 4, background: checked ? 'rgba(59,130,246,0.08)' : 'transparent', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = new Set(aiSelected)
                            if (checked) next.delete(i); else next.add(i)
                            setAiSelected(next)
                          }}
                          disabled={tooLong}
                        />
                        <span style={{ flex: 1, fontSize: 14 }}>{s}</span>
                        <span style={{ fontSize: 11, color: tooLong ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {len}/{BH_LENGTH_HARD}{tooLong ? ' · too long' : ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setAiSuggestions([]); setAiSelected(new Set()) }} disabled={aiSaving}>Discard</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveSelected} disabled={aiSaving || aiSelected.size === 0}>
                    {aiSaving ? 'Saving…' : `Save ${aiSelected.size} selected`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Existing BH list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.length === 0 ? (
          <div className="funnel-tab-empty">
            {selectedAudienceId
              ? `No Banner Headlines tagged for ${audience?.name ?? 'this audience'} yet.`
              : 'No Banner Headlines yet.'}
          </div>
        ) : (
          visible.map(bh => {
            const isEditing = editingId === bh.id
            const taggedAudiences = (Array.isArray(bh.avatar_ids) ? bh.avatar_ids : []) as string[]
            return (
              <div key={bh.id} className="card" style={{ padding: 12 }}>
                {isEditing ? (
                  <div>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                    />
                    <CharCounter len={editText.length} />
                    <AudienceTagger avatars={approvedAvatars} audienceIds={editAudienceIds} setAudienceIds={setEditAudienceIds} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)} disabled={editBusy}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(bh)} disabled={editBusy}>{editBusy ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{bh.text}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{bh.text.length} chars</div>
                    {/* Only show audience tags if the BH targets multiple audiences (otherwise it's redundant with the page-level filter). */}
                    {taggedAudiences.length > 1 && (
                      <div className="tag-list" style={{ marginTop: 8 }}>
                        {taggedAudiences.map(aid => {
                          const a = avatars.find(av => av.id === aid)
                          return <span key={aid} className="tag">{a ? `AU${a.display_id}` : '—'} · {a?.name ?? aid}</span>
                        })}
                      </div>
                    )}
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(bh)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(bh)}>Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
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
              AU{a.display_id} · {a.name}
            </label>
          )
        })}
      </div>
    </div>
  )
}
