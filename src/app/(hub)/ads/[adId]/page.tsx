'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import type { Ad, BannerAsset } from '@/types/database'
import { adBodyGroupCode, bhSeqFor } from '@/types/database'

const BANNER_BUCKET = 'client-assets'

export default function AdDetailPage() {
  const params = useParams<{ adId: string }>()
  const adId = params?.adId
  const router = useRouter()
  const { client, ads, copyComponents, offers, avatars, refreshAds, canEdit } = useAppStore()
  const [bannerAssets, setBannerAssets] = useState<BannerAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ad = useMemo<Ad | undefined>(() => ads.find(a => a.id === adId), [ads, adId])
  const bh   = copyComponents.find(c => c.id === ad?.bh_component_id)
  const body = copyComponents.find(c => c.id === ad?.body_component_id)
  const cta  = copyComponents.find(c => c.id === ad?.cta_component_id)
  const offer    = offers.find(o => o.id === ad?.offer_id)
  const audience = avatars.find(a => a.id === ad?.audience_id)
  const bodyCode = body ? adBodyGroupCode(body.type) : null
  const bhSeq    = bh ? bhSeqFor(bh, copyComponents) : null

  useEffect(() => {
    if (!adId) return
    let cancelled = false
    setLoadingAssets(true)
    supabase
      .from('banner_assets')
      .select('*')
      .eq('ad_id', adId)
      .order('variation', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setBannerAssets(data || [])
        setLoadingAssets(false)
      })
    return () => { cancelled = true }
  }, [adId])

  function publicUrl(path: string): string {
    return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !ad || !client) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const nextVariation = (bannerAssets.reduce((m, a) => Math.max(m, a.variation), 0) || 0) + 1
      const path = `banners/${client.id}/${ad.name}_V${nextVariation}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from(BANNER_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr

      // Try to read intrinsic dimensions before saving the row
      const dims = await readImageDims(file)
      const { data, error } = await supabase.from('banner_assets').insert({
        ad_id: ad.id,
        variation: nextVariation,
        source: 'designer',
        storage_path: path,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      }).select('*').single()
      if (error) throw error
      setBannerAssets(prev => [...prev, data].sort((a, b) => a.variation - b.variation))
      showToast(`Uploaded V${nextVariation}`)
    } catch (err) {
      showToast('Upload failed: ' + (err as Error).message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteAsset(asset: BannerAsset) {
    if (!confirm(`Delete V${asset.variation}? This removes both the file and the record.`)) return
    try {
      await supabase.storage.from(BANNER_BUCKET).remove([asset.storage_path])
      const { error } = await supabase.from('banner_assets').delete().eq('id', asset.id)
      if (error) throw error
      setBannerAssets(prev => prev.filter(a => a.id !== asset.id))
      showToast(`V${asset.variation} deleted`)
    } catch (err) {
      showToast('Delete failed: ' + (err as Error).message)
    }
  }

  async function handleDuplicate() {
    if (!ad || !client) return
    if (!confirm('Duplicate this ad? You can change components on the new copy. Banner assets are not copied.')) return
    try {
      // Re-insert with same component refs. Same combo = same generated name +
      // unique-constraint conflict, which is by design — banner variations live
      // in banner_assets, not as duplicate ads.
      const { data, error } = await supabase.from('ads').insert({
        client_id:         ad.client_id,
        offer_id:          ad.offer_id,
        audience_id:       ad.audience_id,
        bh_component_id:   ad.bh_component_id,
        body_component_id: ad.body_component_id,
        cta_component_id:  ad.cta_component_id,
        status: 'approved',
      }).select('*').single()
      if (error) throw error
      await refreshAds(client.id)
      showToast('Ad duplicated')
      router.push(`/ads/${data.id}/`)
    } catch (err) {
      showToast('Duplicate failed: ' + (err as Error).message)
    }
  }

  async function handleDeleteAd() {
    if (!ad || !client) return
    if (!confirm('Delete this ad? This cannot be undone.')) return
    try {
      // Remove banner files before the cascade delete drops the rows.
      const paths = bannerAssets.map(a => a.storage_path)
      if (paths.length > 0) await supabase.storage.from(BANNER_BUCKET).remove(paths)
      const { error } = await supabase.from('ads').delete().eq('id', ad.id)
      if (error) throw error
      await refreshAds(client.id)
      router.push('/ads/')
    } catch (err) {
      showToast('Delete failed: ' + (err as Error).message)
    }
  }

  if (!client) {
    return <div className="empty-state">Select a client first.</div>
  }

  if (!ad) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Ad not found</h1>
          </div>
          <Link className="btn btn-secondary" href="/ads/">← Back to ads</Link>
        </div>
        <div className="empty-state">This ad doesn&apos;t exist or you don&apos;t have access.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 20, wordBreak: 'break-all' }}>{ad.name}</h1>
          <p className="page-subtitle">{offer?.name ?? '—'} &bull; {audience?.name ?? '—'}</p>
        </div>
        <Link className="btn btn-secondary" href="/ads/">← Back to ads</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Component breakdown</div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Banner Headline (BH{bhSeq ?? '?'})</span>
              <span className="detail-value">{bh?.text ?? '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Body ({bodyCode ?? '?'} · {body?.type ?? '?'})</span>
              <span className="detail-value">{body?.text ?? '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">CTA ({cta?.type ?? '?'})</span>
              <span className="detail-value" style={{ color: 'var(--accent)' }}>{cta?.text ?? '—'}</span>
            </div>
          </div>
          <hr style={{ margin: '12px 0', borderColor: 'var(--border, #333)' }} />
          {/* Stylized preview */}
          <div style={{ background: 'var(--bg-secondary, #1a1a1a)', padding: 24, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border, #333)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{bh?.text ?? '—'}</div>
            <div style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>{body?.text ?? '—'}</div>
            <button className="btn btn-primary" type="button" disabled>{cta?.text ?? '—'}</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Banner assets ({bannerAssets.length})</div>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                title="AI banner generation isn't wired up yet — coming in a follow-up."
                disabled
              >
                Generate AI banner (soon)
              </button>
              <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : '+ Upload variation'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          )}
        </div>
        <div className="card-body">
          {loadingAssets ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
          ) : bannerAssets.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)' }}>No banner variations yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {bannerAssets.map(asset => {
                const url = publicUrl(asset.storage_path)
                return (
                  <div key={asset.id} className="card" style={{ padding: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`V${asset.variation}`} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 4, background: '#000' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 13 }}>V{asset.variation} · {asset.source}</span>
                      {canEdit && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAsset(asset)}>Delete</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {canEdit && (
          <>
            <button className="btn btn-secondary" onClick={handleDuplicate}>Duplicate ad</button>
            <button className="btn btn-danger" onClick={handleDeleteAd}>Delete ad</button>
          </>
        )}
      </div>
    </div>
  )
}

function readImageDims(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}
