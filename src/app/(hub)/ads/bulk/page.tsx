'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import {
  AD_BODY_TYPES_FLAT, AD_CTA_TYPES,
  adBodyGroupCode, bhSeqFor,
} from '@/types/database'
import type { Ad, BannerAsset, CopyComponent } from '@/types/database'

const BANNER_BUCKET = 'client-assets'
const PAGE_SIZE = 50

type AssetMap = Record<string, BannerAsset[]>

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: 14,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  display: 'block',
}

export default function AdsBulkPage() {
  const {
    client, ads, copyComponents, offers, avatars,
    refreshAds, canEdit,
  } = useAppStore()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ---------------------------------------------------------------------------
  // Selection state — persisted in URL search params.
  // ---------------------------------------------------------------------------
  const urlOfferId    = searchParams.get('offer')
  const urlAudienceId = searchParams.get('audience')
  const [selectedOfferId,    setSelectedOfferId]    = useState<string | null>(urlOfferId)
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(urlAudienceId)
  useEffect(() => { setSelectedOfferId(urlOfferId) }, [urlOfferId])
  useEffect(() => { setSelectedAudienceId(urlAudienceId) }, [urlAudienceId])

  function updateSelection(next: { offerId?: string | null; audienceId?: string | null }) {
    const offerId    = next.offerId    !== undefined ? next.offerId    : selectedOfferId
    const audienceId = next.audienceId !== undefined ? next.audienceId : selectedAudienceId
    setSelectedOfferId(offerId)
    setSelectedAudienceId(audienceId)
    const params = new URLSearchParams(searchParams.toString())
    if (offerId)    params.set('offer', offerId);       else params.delete('offer')
    if (audienceId) params.set('audience', audienceId); else params.delete('audience')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const approvedAvatars = useMemo(
    () => [...avatars].filter(a => a.status === 'approved').sort((a, b) => a.priority - b.priority),
    [avatars],
  )
  const approvedOffers = useMemo(
    () => offers.filter(o => o.status === 'approved'),
    [offers],
  )

  const offer    = useMemo(() => offers.find(o => o.id === selectedOfferId)     ?? null, [offers, selectedOfferId])
  const audience = useMemo(() => avatars.find(a => a.id === selectedAudienceId) ?? null, [avatars, selectedAudienceId])

  // ---------------------------------------------------------------------------
  // Component pools — every slot now reads from copy_components.
  //   - BH:   type = 'banner_headline' AND avatar_ids contains the audience
  //   - body: type IN ('subheadline','hero_subheadline','proof')
  //   - cta:  type IN ('cta','hero_cta')
  // ---------------------------------------------------------------------------
  const bhs    = useMemo(() => audience ? copyComponents.filter(c => c.type === 'banner_headline' && Array.isArray(c.avatar_ids) && c.avatar_ids.includes(audience.id) && c.status === 'approved') : [], [copyComponents, audience])
  const bodies = useMemo(() => copyComponents.filter(c => AD_BODY_TYPES_FLAT.includes(c.type) && c.status === 'approved'), [copyComponents])
  const ctas   = useMemo(() => copyComponents.filter(c => AD_CTA_TYPES.includes(c.type) && c.status === 'approved'), [copyComponents])
  const expectedCombos = bhs.length * bodies.length * ctas.length

  const pairAds = useMemo(() => (
    offer && audience
      ? ads.filter(a => a.offer_id === offer.id && a.audience_id === audience.id)
      : []
  ), [ads, offer, audience])

  const missingCount = Math.max(0, expectedCombos - pairAds.length)

  // ---------------------------------------------------------------------------
  // Banner assets — fetch only for the visible pair's ads.
  // ---------------------------------------------------------------------------
  const [assets, setAssets] = useState<AssetMap>({})
  const [loadingAssets, setLoadingAssets] = useState(false)

  const loadAssets = useCallback(async () => {
    if (!client || pairAds.length === 0) {
      setAssets({})
      return
    }
    setLoadingAssets(true)
    try {
      const adIds = pairAds.map(a => a.id)
      const CHUNK = 200
      const all: BannerAsset[] = []
      for (let i = 0; i < adIds.length; i += CHUNK) {
        const slice = adIds.slice(i, i + CHUNK)
        const { data, error } = await supabase
          .from('banner_assets')
          .select('*')
          .in('ad_id', slice)
          .order('variation', { ascending: true })
        if (error) throw error
        if (data) all.push(...data)
      }
      const byAd: AssetMap = {}
      for (const a of all) (byAd[a.ad_id] ||= []).push(a)
      setAssets(byAd)
    } catch (err) {
      showToast('Failed to load banner assets: ' + (err as Error).message)
    } finally {
      setLoadingAssets(false)
    }
  }, [client, pairAds])

  useEffect(() => { loadAssets() }, [loadAssets])

  function publicUrl(path: string) {
    return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl
  }

  // ---------------------------------------------------------------------------
  // Bulk generate ads for the selected pair.
  // ---------------------------------------------------------------------------
  const [generating, setGenerating] = useState(false)
  const generate = useCallback(async () => {
    if (!client || !offer || !audience) return
    if (!offer.code || !audience.code) {
      showToast('Both offer and audience need short codes before generating ads.')
      return
    }
    if (expectedCombos === 0) {
      showToast('Need ≥1 BH for this audience, ≥1 body component, ≥1 CTA before generating.')
      return
    }
    setGenerating(true)
    let inserted = 0
    try {
      const rows: Array<Partial<Ad> & { client_id: string }> = []
      for (const bh of bhs) {
        for (const body of bodies) {
          for (const cta of ctas) {
            rows.push({
              client_id: client.id,
              offer_id: offer.id,
              audience_id: audience.id,
              bh_component_id: bh.id,
              body_component_id: body.id,
              cta_component_id: cta.id,
              status: 'approved',
            })
          }
        }
      }
      const CHUNK = 500
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK)
        const { data, error } = await supabase
          .from('ads')
          .upsert(slice, {
            onConflict: 'client_id,offer_id,audience_id,bh_component_id,body_component_id,cta_component_id',
            ignoreDuplicates: true,
          })
          .select('id')
        if (error) throw error
        inserted += data?.length ?? 0
      }
      await refreshAds(client.id)
      showToast(`Generated ${inserted} new ad${inserted === 1 ? '' : 's'}`)
    } catch (err) {
      showToast('Generation failed: ' + (err as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [client, offer, audience, bhs, bodies, ctas, expectedCombos, refreshAds])

  // BH AI generation has moved to the /copy page (Banner Headlines tab).
  // /ads/bulk just composes ads from existing copy_components.

  // ---------------------------------------------------------------------------
  // Banner uploads (renames to {ad.name}_V{n}.{ext})
  // ---------------------------------------------------------------------------
  const [uploadingAds, setUploadingAds] = useState<Set<string>>(new Set())

  async function uploadFiles(ad: Ad, files: FileList | File[]) {
    if (!client || !canEdit) return
    const fileList = Array.from(files)
    if (fileList.length === 0) return
    setUploadingAds(prev => new Set(prev).add(ad.id))
    try {
      const { data: existing, error: lookupErr } = await supabase
        .from('banner_assets')
        .select('variation')
        .eq('ad_id', ad.id)
        .order('variation', { ascending: false })
        .limit(1)
      if (lookupErr) throw lookupErr
      let nextVariation = ((existing?.[0]?.variation as number | undefined) ?? 0) + 1

      const created: BannerAsset[] = []
      for (const file of fileList) {
        const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
        let attempt = 0
        while (attempt < 5) {
          attempt++
          const filename = `${ad.name}_V${nextVariation}.${ext}`
          const path = `banners/${client.id}/${filename}`
          const { error: uploadErr } = await supabase.storage
            .from(BANNER_BUCKET)
            .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
          if (uploadErr) {
            const msg = uploadErr.message || ''
            if (/already exists|Duplicate/i.test(msg)) { nextVariation++; continue }
            throw uploadErr
          }
          const { data: row, error: rowErr } = await supabase
            .from('banner_assets')
            .insert({ ad_id: ad.id, variation: nextVariation, source: 'designer', storage_path: path })
            .select('*').single()
          if (rowErr) {
            await supabase.storage.from(BANNER_BUCKET).remove([path])
            if (rowErr.code === '23505') { nextVariation++; continue }
            throw rowErr
          }
          created.push(row as BannerAsset)
          nextVariation++
          break
        }
        if (attempt >= 5) throw new Error(`Could not allocate a variation slot for ${file.name} after 5 attempts`)
      }
      setAssets(prev => ({
        ...prev,
        [ad.id]: [...(prev[ad.id] ?? []), ...created].sort((a, b) => a.variation - b.variation),
      }))
      showToast(`Uploaded ${created.length} variation${created.length === 1 ? '' : 's'}`)
    } catch (err) {
      showToast('Upload failed: ' + (err as Error).message)
    } finally {
      setUploadingAds(prev => {
        const next = new Set(prev)
        next.delete(ad.id)
        return next
      })
    }
  }

  async function handleDeleteAsset(asset: BannerAsset) {
    if (!confirm(`Delete V${asset.variation}? Removes the file and the record.`)) return
    try {
      await supabase.storage.from(BANNER_BUCKET).remove([asset.storage_path])
      const { error } = await supabase.from('banner_assets').delete().eq('id', asset.id)
      if (error) throw error
      setAssets(prev => ({ ...prev, [asset.ad_id]: (prev[asset.ad_id] ?? []).filter(a => a.id !== asset.id) }))
      showToast('Deleted')
    } catch (err) {
      showToast('Delete failed: ' + (err as Error).message)
    }
  }

  async function handleDeleteAd(ad: Ad) {
    if (!client) return
    const adAssets = assets[ad.id] ?? []
    const note = adAssets.length > 0 ? ` and its ${adAssets.length} banner asset${adAssets.length === 1 ? '' : 's'}` : ''
    if (!confirm(`Delete ad ${ad.name}${note}? This cannot be undone.`)) return
    try {
      const paths = adAssets.map(a => a.storage_path)
      if (paths.length > 0) await supabase.storage.from(BANNER_BUCKET).remove(paths)
      const { error } = await supabase.from('ads').delete().eq('id', ad.id)
      if (error) throw error
      setAssets(prev => { const next = { ...prev }; delete next[ad.id]; return next })
      await refreshAds(client.id)
    } catch (err) {
      showToast('Delete failed: ' + (err as Error).message)
    }
  }

  async function handleDeleteAll() {
    if (!client || !offer || !audience || pairAds.length === 0) return
    const totalAssets = pairAds.reduce((n, a) => n + (assets[a.id]?.length ?? 0), 0)
    const assetNote = totalAssets > 0 ? ` and ${totalAssets} banner asset${totalAssets === 1 ? '' : 's'}` : ''
    if (!confirm(`Delete all ${pairAds.length} ad${pairAds.length === 1 ? '' : 's'}${assetNote} for ${offer.name} × ${audience.name}? This cannot be undone.`)) return
    try {
      const allPaths = pairAds.flatMap(a => (assets[a.id] ?? []).map(x => x.storage_path))
      if (allPaths.length > 0) {
        const CHUNK = 100
        for (let i = 0; i < allPaths.length; i += CHUNK) {
          await supabase.storage.from(BANNER_BUCKET).remove(allPaths.slice(i, i + CHUNK))
        }
      }
      const ids = pairAds.map(a => a.id)
      const { error } = await supabase.from('ads').delete().in('id', ids)
      if (error) throw error
      setAssets({})
      await refreshAds(client.id)
      showToast(`Deleted ${ids.length} ad${ids.length === 1 ? '' : 's'}`)
    } catch (err) {
      showToast('Delete failed: ' + (err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Pagination + lightbox
  // ---------------------------------------------------------------------------
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [selectedOfferId, selectedAudienceId])
  const [lightbox, setLightbox] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(pairAds.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visibleAds = pairAds.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  if (!client) {
    return (
      <div>
        <div className="page-header"><div><h1 className="page-title">Bulk Ad Builder</h1></div></div>
        <div className="empty-state">Select a client first.</div>
      </div>
    )
  }

  const bothSelected = !!offer && !!audience
  const codesMissing = bothSelected && (!offer.code || !audience.code)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bulk Ad Builder</h1>
          <p className="page-subtitle">Pick an audience and an offer, then generate every valid BH × body × CTA combination.</p>
        </div>
        <Link className="btn btn-secondary" href="/ads/">← Back to ads</Link>
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Select Audience Profile + Offer</h3>
        <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
          <div>
            <label style={labelStyle}>Audience Profile</label>
            <select
              style={selectStyle}
              value={selectedAudienceId || ''}
              onChange={e => updateSelection({ audienceId: e.target.value || null })}
            >
              <option value="">Choose a profile...</option>
              {approvedAvatars.map(a => (
                <option key={a.id} value={a.id}>
                  {a.code ? `${a.code} · ` : ''}{a.name}{a.priority === 1 ? ' (Primary)' : a.priority ? ` (#${a.priority})` : ''}{!a.code ? ' — no code' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Offer</label>
            <select
              style={selectStyle}
              value={selectedOfferId || ''}
              onChange={e => updateSelection({ offerId: e.target.value || null })}
            >
              <option value="">Choose an offer...</option>
              {approvedOffers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.code ? `${o.code} · ` : ''}{o.name}{!o.code ? ' — no code' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!bothSelected && (
        <div className="empty-state">Pick an audience and an offer above to see the ads for that pair.</div>
      )}

      {bothSelected && codesMissing && (
        <div className="card" style={{ borderColor: 'var(--warning)' }}>
          <div className="card-title" style={{ color: 'var(--warning)' }}>Short codes are missing</div>
          <div className="card-body" style={{ fontSize: 14 }}>
            {!offer!.code && <div>The offer <strong>{offer!.name}</strong> has no code.</div>}
            {!audience!.code && <div>The audience <strong>{audience!.name}</strong> has no code.</div>}
            <div style={{ marginTop: 8 }}>Set codes from <Link href="/ads/new/" style={{ color: 'var(--accent)' }}>/ads/new</Link>.</div>
          </div>
        </div>
      )}

      {/* Pool summary — what's available for this audience right now */}
      {bothSelected && !codesMissing && (bhs.length === 0 || bodies.length === 0 || ctas.length === 0) && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning)' }}>
          <div className="card-title" style={{ color: 'var(--warning)' }}>Missing copy for this pair</div>
          <div className="card-body" style={{ fontSize: 14 }}>
            {bhs.length === 0 && <div>No Banner Headlines tagged for <strong>{audience!.name}</strong>. Generate some on the <Link href="/copy/" style={{ color: 'var(--accent)' }}>Copy page</Link> (Banner Headlines column).</div>}
            {bodies.length === 0 && <div>No body copy (subheadlines or proof) yet — add some via <Link href="/copy/" style={{ color: 'var(--accent)' }}>/copy</Link>.</div>}
            {ctas.length === 0 && <div>No CTAs yet — add some via <Link href="/copy/" style={{ color: 'var(--accent)' }}>/copy</Link>.</div>}
          </div>
        </div>
      )}

      {/* Ads section for the pair */}
      {bothSelected && !codesMissing && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div className="card-title" style={{ marginBottom: 4 }}>
                {offer!.name} <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}>({offer!.code})</span>
                {' × '}
                {audience!.name} <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}>({audience!.code})</span>
              </div>
              <div className="card-meta">
                {pairAds.length} ad{pairAds.length === 1 ? '' : 's'} · {expectedCombos} possible combo{expectedCombos === 1 ? '' : 's'}
                {missingCount > 0 ? ` · ${missingCount} missing` : expectedCombos > 0 ? ' · all generated' : ''}
              </div>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={generating || missingCount === 0 || expectedCombos === 0}
                  onClick={generate}
                  title={
                    expectedCombos === 0 ? 'Needs ≥1 BH tagged for this audience, ≥1 body, ≥1 CTA' :
                    missingCount === 0 ? 'All combos generated' :
                    `Generate ${missingCount} missing combo${missingCount === 1 ? '' : 's'}`
                  }
                >
                  {generating ? 'Generating…' : missingCount > 0 ? `Generate ${missingCount}` : 'Up to date'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={pairAds.length === 0 || generating}
                  onClick={handleDeleteAll}
                >
                  Delete all
                </button>
              </div>
            )}
          </div>

          {expectedCombos === 0 && pairAds.length === 0 ? (
            <div className="card-body" style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
              No combos available for this pair yet. Generate Banner Headlines for <strong>{audience!.name}</strong> in the panel above, and confirm there&apos;s body copy and CTAs in <Link href="/copy/" style={{ color: 'var(--accent)' }}>/copy</Link>.
            </div>
          ) : pairAds.length === 0 ? (
            <div className="card-body" style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
              No ads yet for this pair. {canEdit && missingCount > 0 && `Click "Generate ${missingCount}" to create them.`}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #333)' }}>
                      <th style={{ padding: '8px 6px', minWidth: 220 }}>Ad name</th>
                      <th style={{ padding: '8px 6px', minWidth: 200 }}>BH</th>
                      <th style={{ padding: '8px 6px', minWidth: 200 }}>Body</th>
                      <th style={{ padding: '8px 6px', minWidth: 150 }}>CTA</th>
                      <th style={{ padding: '8px 6px', minWidth: 280 }}>Banner assets</th>
                      <th style={{ padding: '8px 6px', width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAds.map(ad => (
                      <BulkAdRow
                        key={ad.id}
                        ad={ad}
                        bhs={bhs}
                        allCopy={copyComponents}
                        bodies={bodies}
                        ctas={ctas}
                        assets={assets[ad.id] ?? []}
                        loadingAssets={loadingAssets}
                        uploading={uploadingAds.has(ad.id)}
                        canEdit={canEdit}
                        onDeleteAd={() => handleDeleteAd(ad)}
                        onUploadFiles={(files) => uploadFiles(ad, files)}
                        onDeleteAsset={handleDeleteAsset}
                        onLightbox={setLightbox}
                        publicUrl={publicUrl}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>← Prev</button>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, pairAds.length)} of {pairAds.length}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {lightbox && (
        <div className="modal-overlay" onClick={() => setLightbox(null)} style={{ cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="banner preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', boxShadow: '0 0 40px #000' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single row in the bulk table
// ---------------------------------------------------------------------------
function BulkAdRow({
  ad,
  bhs,
  allCopy,
  bodies,
  ctas,
  assets,
  loadingAssets,
  uploading,
  canEdit,
  onDeleteAd,
  onUploadFiles,
  onDeleteAsset,
  onLightbox,
  publicUrl,
}: {
  ad: Ad
  bhs: CopyComponent[]
  allCopy: CopyComponent[]
  bodies: CopyComponent[]
  ctas: CopyComponent[]
  assets: BannerAsset[]
  loadingAssets: boolean
  uploading: boolean
  canEdit: boolean
  onDeleteAd: () => void
  onUploadFiles: (files: FileList | File[]) => void
  onDeleteAsset: (asset: BannerAsset) => void
  onLightbox: (url: string) => void
  publicUrl: (path: string) => string
}) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bh   = useMemo(() => bhs.find(c => c.id === ad.bh_component_id), [bhs, ad.bh_component_id])
  const body = useMemo(() => bodies.find(c => c.id === ad.body_component_id), [bodies, ad.body_component_id])
  const cta  = useMemo(() => ctas.find(c => c.id === ad.cta_component_id), [ctas, ad.cta_component_id])
  const bodyCode = body ? adBodyGroupCode(body.type) : null

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (!canEdit) return
    if (e.dataTransfer.files.length > 0) onUploadFiles(e.dataTransfer.files)
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--border, #2a2a2a)', verticalAlign: 'top' }}>
      <td style={{ padding: '8px 6px', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, wordBreak: 'break-all' }}>
        <Link href={`/ads/${ad.id}/`} style={{ color: 'var(--accent)' }}>{ad.name}</Link>
      </td>
      <td style={{ padding: '8px 6px' }}>
        <div style={{ fontWeight: 600 }}>{bh?.text ?? '—'}</div>
        {bh && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>BH{bhSeqFor(bh, allCopy)}</div>}
      </td>
      <td style={{ padding: '8px 6px' }}>
        <div>{body?.text ?? '—'}</div>
        {body && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{bodyCode ?? '?'} · {body.type}</div>}
      </td>
      <td style={{ padding: '8px 6px', color: 'var(--accent)' }}>
        <div>{cta?.text ?? '—'}</div>
        {cta && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cta.type}</div>}
      </td>
      <td style={{ padding: '8px 6px' }}>
        <div
          onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragOver(true) } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
            padding: 6,
            border: dragOver ? '2px dashed var(--accent)' : '1px dashed var(--border, #444)',
            borderRadius: 6,
            background: dragOver ? 'rgba(59,130,246,0.05)' : 'transparent',
            minHeight: 60,
          }}
        >
          {assets.map(asset => (
            <div key={asset.id} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrl(asset.storage_path)}
                alt={`V${asset.variation}`}
                title={`V${asset.variation} · ${asset.source}`}
                onClick={() => onLightbox(publicUrl(asset.storage_path))}
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, background: '#000', cursor: 'zoom-in' }}
              />
              <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, padding: '1px 4px', borderRadius: 2 }}>
                V{asset.variation}
              </span>
              {canEdit && (
                <button
                  onClick={() => onDeleteAsset(asset)}
                  title="Delete this variation"
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--danger, #ef4444)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: '18px', padding: 0,
                  }}
                >×</button>
              )}
            </div>
          ))}
          {canEdit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                background: 'transparent', border: '1px dashed var(--text-secondary)', color: 'var(--text-secondary)',
                padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, minHeight: 36, minWidth: 90,
              }}
            >
              {uploading ? 'Uploading…' : assets.length === 0 ? 'Drop or click to upload' : '+ Add'}
            </button>
          )}
          {!canEdit && assets.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No banners</span>}
          {loadingAssets && assets.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Loading…</span>}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files && e.target.files.length > 0) onUploadFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = '' }}
        />
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
        {canEdit && (
          <button
            onClick={onDeleteAd}
            title="Delete this ad"
            style={{ background: 'transparent', border: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer', fontSize: 16, padding: 4 }}
          >🗑</button>
        )}
      </td>
    </tr>
  )
}
