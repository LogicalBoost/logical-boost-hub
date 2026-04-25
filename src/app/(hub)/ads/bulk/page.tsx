'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import { AD_BODY_TYPES } from '@/types/database'
import type { Ad, AdComponent, Avatar, BannerAsset, Offer } from '@/types/database'

const BANNER_BUCKET = 'client-assets'
const PAGE_SIZE = 50

type AssetMap = Record<string, BannerAsset[]>

interface Section {
  key: string
  offer: Offer
  audience: Avatar
  bhs: AdComponent[]
  bodies: AdComponent[]
  ctas: AdComponent[]
  expectedCombos: number
  ads: Ad[]
}

export default function AdsBulkPage() {
  const { client, ads, adComponents, offers, avatars, refreshAds, canEdit } = useAppStore()

  const [assets, setAssets] = useState<AssetMap>({})
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null) // 'all' | section.key | null
  const [uploadingAds, setUploadingAds] = useState<Set<string>>(new Set())
  const [pageByPair, setPageByPair] = useState<Record<string, number>>({})
  const [lightbox, setLightbox] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Sections — one per (offer × audience) pair where both have a code.
  // ---------------------------------------------------------------------------
  const sections: Section[] = useMemo(() => {
    if (!client) return []
    const bodies = adComponents.filter(c => AD_BODY_TYPES.includes(c.type))
    const ctas = adComponents.filter(c => c.type === 'CTA')
    const out: Section[] = []
    for (const offer of offers) {
      if (!offer.code) continue
      for (const audience of avatars) {
        if (!audience.code) continue
        const bhs = adComponents.filter(c => c.type === 'BH' && c.audience_ids.includes(audience.id))
        out.push({
          key: `${offer.id}|${audience.id}`,
          offer,
          audience,
          bhs,
          bodies,
          ctas,
          expectedCombos: bhs.length * bodies.length * ctas.length,
          ads: ads.filter(a => a.offer_id === offer.id && a.audience_id === audience.id),
        })
      }
    }
    return out
  }, [client, ads, adComponents, offers, avatars])

  // ---------------------------------------------------------------------------
  // Eagerly fetch banner_assets for every ad belonging to this client.
  // ---------------------------------------------------------------------------
  const loadAssets = useCallback(async () => {
    if (!client || ads.length === 0) {
      setAssets({})
      return
    }
    setLoadingAssets(true)
    try {
      const adIds = ads.map(a => a.id)
      // Chunk into batches to avoid hitting URL/payload limits on large clients.
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
      for (const a of all) {
        ;(byAd[a.ad_id] ||= []).push(a)
      }
      setAssets(byAd)
    } catch (err) {
      showToast('Failed to load banner assets: ' + (err as Error).message)
    } finally {
      setLoadingAssets(false)
    }
  }, [client, ads])

  useEffect(() => { loadAssets() }, [loadAssets])

  function publicUrl(path: string) {
    return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl
  }

  // ---------------------------------------------------------------------------
  // Bulk generation — for each section, build every (BH × body × CTA) tuple
  // and upsert with ON CONFLICT DO NOTHING (the unique constraint is on the
  // composition tuple). One round-trip per section keeps the payload bounded.
  // ---------------------------------------------------------------------------
  const generateForSections = useCallback(async (targets: Section[], label: string) => {
    if (!client) return
    setGenerating(label)
    let inserted = 0
    let skippedDueToVoid = 0
    try {
      for (const s of targets) {
        if (s.expectedCombos === 0) {
          skippedDueToVoid++
          continue
        }
        const rows: Array<Partial<Ad> & { client_id: string }> = []
        for (const bh of s.bhs) {
          for (const body of s.bodies) {
            for (const cta of s.ctas) {
              rows.push({
                client_id: client.id,
                offer_id: s.offer.id,
                audience_id: s.audience.id,
                bh_component_id: bh.id,
                body_component_id: body.id,
                cta_component_id: cta.id,
                // Trigger overwrites these on insert; columns are NOT NULL so we
                // still need to send them.
                bh_component_version: bh.version,
                body_component_version: body.version,
                cta_component_version: cta.version,
                status: 'approved',
              })
            }
          }
        }
        if (rows.length === 0) continue
        // Batch into chunks of 500 to stay well under any payload caps.
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
      }
      await refreshAds(client.id)
      const skipNote = skippedDueToVoid > 0 ? ` (${skippedDueToVoid} pair${skippedDueToVoid === 1 ? '' : 's'} skipped — no valid combos)` : ''
      showToast(`Generated ${inserted} new ad${inserted === 1 ? '' : 's'}${skipNote}`)
    } catch (err) {
      showToast('Generation failed: ' + (err as Error).message)
    } finally {
      setGenerating(null)
    }
  }, [client, refreshAds])

  const generateAll = useCallback(() => generateForSections(sections, 'all'), [sections, generateForSections])
  const generateSection = useCallback((s: Section) => generateForSections([s], s.key), [generateForSections])

  // ---------------------------------------------------------------------------
  // Banner uploads — rename to {ad.name}_V{n}.{ext}, upload, insert row.
  // Sequenced per ad so two simultaneous files don't race on the variation seq.
  // ---------------------------------------------------------------------------
  async function uploadFiles(ad: Ad, files: FileList | File[]) {
    if (!client || !canEdit) return
    const fileList = Array.from(files)
    if (fileList.length === 0) return
    setUploadingAds(prev => new Set(prev).add(ad.id))
    try {
      // Find the current next variation by re-querying (handles concurrent edits).
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
        // Build the filename per spec: {ad.name}_V{n}.{ext}
        let attempt = 0
        // Up to 5 retries to handle racing with another tab/session.
        while (attempt < 5) {
          attempt++
          const filename = `${ad.name}_V${nextVariation}.${ext}`
          const path = `banners/${client.id}/${filename}`
          const { error: uploadErr } = await supabase.storage
            .from(BANNER_BUCKET)
            .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
          if (uploadErr) {
            // Likely "Duplicate" if the path already exists — bump and retry.
            const msg = uploadErr.message || ''
            if (/already exists|Duplicate/i.test(msg)) {
              nextVariation++
              continue
            }
            throw uploadErr
          }
          const { data: row, error: rowErr } = await supabase
            .from('banner_assets')
            .insert({
              ad_id: ad.id,
              variation: nextVariation,
              source: 'designer',
              storage_path: path,
            })
            .select('*')
            .single()
          if (rowErr) {
            // If the unique (ad_id, variation) constraint fired, clean the file
            // we just uploaded and retry with a higher variation.
            await supabase.storage.from(BANNER_BUCKET).remove([path])
            if (rowErr.code === '23505') { nextVariation++; continue }
            throw rowErr
          }
          created.push(row as BannerAsset)
          nextVariation++
          break
        }
        if (attempt >= 5) {
          throw new Error(`Could not allocate a variation slot for ${file.name} after 5 attempts`)
        }
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
      setAssets(prev => ({
        ...prev,
        [asset.ad_id]: (prev[asset.ad_id] ?? []).filter(a => a.id !== asset.id),
      }))
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
      setAssets(prev => {
        const next = { ...prev }
        delete next[ad.id]
        return next
      })
      await refreshAds(client.id)
    } catch (err) {
      showToast('Delete failed: ' + (err as Error).message)
    }
  }

  async function handleDeleteSection(s: Section) {
    if (!client || s.ads.length === 0) return
    const totalAssets = s.ads.reduce((n, a) => n + (assets[a.id]?.length ?? 0), 0)
    const assetNote = totalAssets > 0 ? ` and ${totalAssets} banner asset${totalAssets === 1 ? '' : 's'}` : ''
    if (!confirm(`Delete all ${s.ads.length} ad${s.ads.length === 1 ? '' : 's'}${assetNote} for ${s.offer.name} × ${s.audience.name}? This cannot be undone.`)) return
    try {
      const allPaths = s.ads.flatMap(a => (assets[a.id] ?? []).map(x => x.storage_path))
      if (allPaths.length > 0) {
        // remove() can take many paths in one call; chunk to be safe.
        const CHUNK = 100
        for (let i = 0; i < allPaths.length; i += CHUNK) {
          await supabase.storage.from(BANNER_BUCKET).remove(allPaths.slice(i, i + CHUNK))
        }
      }
      const ids = s.ads.map(a => a.id)
      const { error } = await supabase.from('ads').delete().in('id', ids)
      if (error) throw error
      setAssets(prev => {
        const next = { ...prev }
        for (const id of ids) delete next[id]
        return next
      })
      await refreshAds(client.id)
      showToast(`Deleted ${ids.length} ad${ids.length === 1 ? '' : 's'}`)
    } catch (err) {
      showToast('Section delete failed: ' + (err as Error).message)
    }
  }

  if (!client) {
    return (
      <div>
        <div className="page-header"><div><h1 className="page-title">Bulk Ad Builder</h1></div></div>
        <div className="empty-state">Select a client first.</div>
      </div>
    )
  }

  const totalExpected = sections.reduce((n, s) => n + s.expectedCombos, 0)
  const totalExisting = sections.reduce((n, s) => n + s.ads.length, 0)
  const missingPairs = sections.filter(s => s.expectedCombos === 0)
  const codedSections = sections.length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bulk Ad Builder</h1>
          <p className="page-subtitle">
            Generate every valid BH × body × CTA combo per offer × audience. {totalExisting} of {totalExpected} possible ad{totalExpected === 1 ? '' : 's'} created across {codedSections} pair{codedSections === 1 ? '' : 's'}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-secondary" href="/ads/">← Back to ads</Link>
          {canEdit && (
            <button
              className="btn btn-primary"
              disabled={generating !== null || totalExpected === 0}
              onClick={generateAll}
            >
              {generating === 'all' ? 'Generating…' : 'Generate all combinations'}
            </button>
          )}
        </div>
      </div>

      {(offers.some(o => !o.code) || avatars.some(a => !a.code)) && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning)' }}>
          <div className="card-title" style={{ color: 'var(--warning)' }}>Some offers/audiences are missing short codes</div>
          <div className="card-body" style={{ fontSize: 14 }}>
            Pairs without codes on both sides aren&apos;t shown. Set codes from <Link href="/ads/new/" style={{ color: 'var(--accent)' }}>/ads/new</Link>.
          </div>
        </div>
      )}

      {missingPairs.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning)' }}>
          <div className="card-title" style={{ color: 'var(--warning)' }}>{missingPairs.length} pair{missingPairs.length === 1 ? '' : 's'} have no valid combos</div>
          <div className="card-body" style={{ fontSize: 14 }}>
            A pair needs at least one BH tagged for that audience, one body component (SH / T / PC), and one CTA. <Link href="/ads/library/" style={{ color: 'var(--accent)' }}>Add components</Link>.
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="empty-state">
          No offer × audience pairs available. Both an offer and an audience need short codes before bulk generation can run.
        </div>
      ) : (
        sections.map(s => (
          <SectionCard
            key={s.key}
            section={s}
            assets={assets}
            loadingAssets={loadingAssets}
            uploadingAds={uploadingAds}
            generating={generating}
            canEdit={canEdit}
            page={pageByPair[s.key] ?? 0}
            setPage={(p) => setPageByPair(prev => ({ ...prev, [s.key]: p }))}
            onGenerate={() => generateSection(s)}
            onDeleteSection={() => handleDeleteSection(s)}
            onDeleteAd={handleDeleteAd}
            onUploadFiles={uploadFiles}
            onDeleteAsset={handleDeleteAsset}
            onLightbox={setLightbox}
            publicUrl={publicUrl}
          />
        ))
      )}

      {lightbox && (
        <div
          className="modal-overlay"
          onClick={() => setLightbox(null)}
          style={{ cursor: 'zoom-out' }}
        >
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
// Section card — one per offer × audience pair
// ---------------------------------------------------------------------------
function SectionCard({
  section,
  assets,
  loadingAssets,
  uploadingAds,
  generating,
  canEdit,
  page,
  setPage,
  onGenerate,
  onDeleteSection,
  onDeleteAd,
  onUploadFiles,
  onDeleteAsset,
  onLightbox,
  publicUrl,
}: {
  section: Section
  assets: AssetMap
  loadingAssets: boolean
  uploadingAds: Set<string>
  generating: string | null
  canEdit: boolean
  page: number
  setPage: (p: number) => void
  onGenerate: () => void
  onDeleteSection: () => void
  onDeleteAd: (ad: Ad) => void
  onUploadFiles: (ad: Ad, files: FileList | File[]) => void
  onDeleteAsset: (asset: BannerAsset) => void
  onLightbox: (url: string) => void
  publicUrl: (path: string) => string
}) {
  const { offer, audience, ads, expectedCombos } = section
  const missing = Math.max(0, expectedCombos - ads.length)
  const totalPages = Math.max(1, Math.ceil(ads.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visible = ads.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>
            {offer.name} <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}>({offer.code})</span>
            {' × '}
            {audience.name} <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}>({audience.code})</span>
          </div>
          <div className="card-meta">
            {ads.length} ad{ads.length === 1 ? '' : 's'} · {expectedCombos} possible combo{expectedCombos === 1 ? '' : 's'}
            {missing > 0 ? ` · ${missing} missing` : expectedCombos > 0 ? ' · all generated' : ''}
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={generating !== null || missing === 0}
              onClick={onGenerate}
              title={missing === 0 ? expectedCombos === 0 ? 'No valid combos: needs BH tagged for this audience, ≥1 body component, ≥1 CTA' : 'All combos generated' : `Generate ${missing} missing combo${missing === 1 ? '' : 's'}`}
            >
              {generating === section.key ? 'Generating…' : missing > 0 ? `Generate ${missing}` : 'Up to date'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              disabled={ads.length === 0 || generating !== null}
              onClick={onDeleteSection}
            >
              Delete all
            </button>
          </div>
        )}
      </div>

      {ads.length === 0 ? (
        <div className="card-body" style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
          No ads yet for this pair. {canEdit && missing > 0 && `Click "Generate ${missing}" to create them.`}
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="bulk-ads-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                {visible.map(ad => (
                  <BulkAdRow
                    key={ad.id}
                    ad={ad}
                    section={section}
                    assets={assets[ad.id] ?? []}
                    loadingAssets={loadingAssets}
                    uploading={uploadingAds.has(ad.id)}
                    canEdit={canEdit}
                    onDeleteAd={() => onDeleteAd(ad)}
                    onUploadFiles={(files) => onUploadFiles(ad, files)}
                    onDeleteAsset={onDeleteAsset}
                    onLightbox={onLightbox}
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
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, ads.length)} of {ads.length}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single row in the bulk table
// ---------------------------------------------------------------------------
function BulkAdRow({
  ad,
  section,
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
  section: Section
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

  const bh   = useMemo(() => section.bhs.find(c => c.id === ad.bh_component_id), [section.bhs, ad.bh_component_id])
  const body = useMemo(() => section.bodies.find(c => c.id === ad.body_component_id), [section.bodies, ad.body_component_id])
  const cta  = useMemo(() => section.ctas.find(c => c.id === ad.cta_component_id), [section.ctas, ad.cta_component_id])

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
        <div style={{ fontWeight: 600 }}>{bh?.content ?? '—'}</div>
        {bh && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>BH{bh.per_client_seq} · v{ad.bh_component_version}</div>}
      </td>
      <td style={{ padding: '8px 6px' }}>
        <div>{body?.content ?? '—'}</div>
        {body && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{body.type}{body.per_client_seq} · v{ad.body_component_version}</div>}
      </td>
      <td style={{ padding: '8px 6px', color: 'var(--accent)' }}>
        <div>{cta?.content ?? '—'}</div>
        {cta && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>CTA{cta.per_client_seq} · v{ad.cta_component_version}</div>}
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
