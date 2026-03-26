'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { generateFunnel, generateMore } from '@/lib/api'
import { showToast } from '@/lib/demo-toast'
import { ANGLES, getAngleLabel, ANGLE_COLORS } from '@/types/database'
import type { CopyComponent, CopyComponentType, BrandKit } from '@/types/database'
import { supabase } from '@/lib/supabase'

// ── Tab definitions (maps to copy component types) ──────────────────────
const TABS: { key: string; label: string; types: CopyComponentType[] }[] = [
  { key: 'google_headlines', label: 'Google Headlines', types: ['google_headline'] },
  { key: 'micro_hooks', label: 'Micro Hooks', types: ['video_hook'] },
  { key: 'meta_headlines', label: 'Meta Headlines', types: ['headline'] },
  { key: 'primary_text', label: 'Primary Text', types: ['primary_text'] },
  { key: 'descriptions', label: 'Descriptions', types: ['google_description', 'description'] },
  { key: 'benefits', label: 'Benefits', types: ['benefit', 'value_point'] },
  { key: 'proof', label: 'Proof', types: ['proof'] },
  { key: 'urgency', label: 'Urgency', types: ['urgency', 'fear_point', 'urgency_bar'] },
  { key: 'subheadlines', label: 'Subheadlines', types: ['subheadline', 'hero_subheadline'] },
  { key: 'ctas', label: 'CTAs', types: ['cta', 'hero_cta'] },
  { key: 'hero', label: 'Hero Copy', types: ['hero_headline', 'hero_subheadline', 'hero_cta'] },
  { key: 'objections', label: 'Objection Handlers', types: ['objection_handler'] },
]

// All section types that can be generated via Generate More
const ALL_SECTION_TYPES: { value: string; label: string }[] = [
  { value: 'google_headline', label: 'Google Headlines' },
  { value: 'headline', label: 'Meta Headlines' },
  { value: 'primary_text', label: 'Primary Text' },
  { value: 'google_description', label: 'Google Descriptions' },
  { value: 'description', label: 'Descriptions' },
  { value: 'subheadline', label: 'Subheadlines' },
  { value: 'benefit', label: 'Benefits' },
  { value: 'value_point', label: 'Value Points' },
  { value: 'proof', label: 'Proof' },
  { value: 'urgency', label: 'Urgency' },
  { value: 'fear_point', label: 'Fear Points' },
  { value: 'cta', label: 'CTAs' },
  { value: 'video_hook', label: 'Video Hooks' },
  { value: 'short_script', label: 'Short Video Scripts (~30s)' },
  { value: 'long_script', label: 'Long Video Scripts (~60s)' },
  { value: 'video_script', label: 'Full Video Scripts' },
  { value: 'objection_handler', label: 'Objection Handlers' },
  { value: 'hero_headline', label: 'Hero Headlines' },
  { value: 'hero_subheadline', label: 'Hero Subheadlines' },
  { value: 'hero_cta', label: 'Hero CTAs' },
  { value: 'urgency_bar', label: 'Urgency Bars' },
]

// ── Copy to clipboard helper ────────────────────────────────────────────
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  }
}

// ── Angle badge component ───────────────────────────────────────────────
function AngleBadge({ slug }: { slug: string }) {
  const color = ANGLE_COLORS[slug] || '#6b7280'
  return (
    <span
      className="angle-badge"
      style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}
    >
      {getAngleLabel(slug)}
    </span>
  )
}

// ── Single copy item row ────────────────────────────────────────────────
function CopyRow({
  item,
  onDeny,
  selected,
  onToggleSelect,
  selectionMode,
}: {
  item: CopyComponent
  onDeny: (id: string) => void
  selected?: boolean
  onToggleSelect?: (id: string) => void
  selectionMode?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(item.id)
      return
    }
    await copyToClipboard(item.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={`copy-row ${copied ? 'copy-row-copied' : ''} ${selected ? 'copy-row-selected' : ''}`} onClick={handleCopy}>
      {selectionMode && (
        <input
          type="checkbox"
          className="copy-row-checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(item.id)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="copy-row-text">{item.text}</div>
      <div className="copy-row-meta">
        {(item.angle_ids || []).map((slug) => (
          <AngleBadge key={slug} slug={slug} />
        ))}
        <span className="copy-row-chars">({item.character_count || item.text.length})</span>
        <button
          className="copy-row-deny"
          title="Deny this item"
          onClick={(e) => {
            e.stopPropagation()
            onDeny(item.id)
          }}
        >
          &times;
        </button>
      </div>
      {copied && <span className="copy-feedback">Copied!</span>}
    </div>
  )
}

// ── Single banner renderer (used at both thumb and full size) ────────────
function BannerContent({
  config,
  headline,
  cta,
  description,
  benefit,
  logoUrl,
  primaryColor,
  bgColor,
  textColor,
  accentColor,
  idx,
}: {
  config: { width: number; height: number; layout: 'horizontal' | 'vertical' | 'tall' }
  headline: string
  cta: string
  description: string | null
  benefit: string | null
  logoUrl: string | null
  primaryColor: string
  bgColor: string
  textColor: string
  accentColor: string
  idx: number
}) {
  return (
    <div
      style={{
        width: config.width,
        height: config.height,
        background: idx % 2 === 0
          ? `linear-gradient(135deg, ${bgColor} 0%, ${primaryColor}33 100%)`
          : `linear-gradient(135deg, ${primaryColor}22 0%, ${bgColor} 100%)`,
        border: `1px solid ${primaryColor}44`,
        borderRadius: 4,
        padding: config.layout === 'horizontal' ? '8px 16px' : '16px',
        display: 'flex',
        flexDirection: config.layout === 'horizontal' ? 'row' : 'column',
        alignItems: config.layout === 'horizontal' ? 'center' : 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        overflow: 'hidden',
        color: textColor,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}
    >
      {logoUrl && config.layout !== 'horizontal' && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={logoUrl} alt="" style={{ height: config.layout === 'tall' ? 24 : 28, objectFit: 'contain', opacity: 0.9 }} />
      )}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: config.layout === 'horizontal' ? 2 : 6, minWidth: 0,
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: config.layout === 'horizontal' ? 13 : config.layout === 'tall' ? 14 : 16,
          lineHeight: 1.2, overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: config.layout === 'horizontal' ? 1 : 3, WebkitBoxOrient: 'vertical',
        }}>
          {headline}
        </div>
        {config.layout !== 'horizontal' && description && (
          <div style={{
            fontSize: config.layout === 'tall' ? 11 : 12, opacity: 0.8, lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {description}
          </div>
        )}
        {config.layout === 'tall' && benefit && (
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {benefit}
          </div>
        )}
      </div>
      <div style={{
        backgroundColor: accentColor, color: '#fff',
        padding: config.layout === 'horizontal' ? '6px 14px' : '8px 16px',
        borderRadius: 4, fontWeight: 600,
        fontSize: config.layout === 'horizontal' ? 12 : 13,
        whiteSpace: 'nowrap', textAlign: 'center', flexShrink: 0,
      }}>
        {cta}
      </div>
    </div>
  )
}

// ── Banner Ad Mockups section ────────────────────────────────────────────
function BannerAdMockups({
  components,
  brandKit,
  clientName,
  logoUrl,
}: {
  components: CopyComponent[]
  brandKit: BrandKit | null
  clientName: string
  logoUrl: string | null
}) {
  const [shuffleKey, setShuffleKey] = useState(0)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const primaryColor = brandKit?.colors?.primary_color || '#10b981'
  const bgColor = brandKit?.colors?.background_color || '#0f1a17'
  const textColor = brandKit?.colors?.text_color || '#ffffff'
  const accentColor = brandKit?.colors?.accent_color || primaryColor

  const headlines = components.filter(c => ['headline', 'google_headline', 'hero_headline'].includes(c.type))
  const ctas = components.filter(c => ['cta', 'hero_cta'].includes(c.type))
  const benefits = components.filter(c => ['benefit', 'value_point'].includes(c.type))
  const descriptions = components.filter(c => ['description', 'google_description', 'subheadline'].includes(c.type))

  const pick = <T,>(arr: T[]) => arr.length > 0 ? arr[(shuffleKey + Math.floor(Math.random() * arr.length)) % arr.length] : null

  const bannerConfigs = [
    { label: 'Leaderboard (728x90)', width: 728, height: 90, layout: 'horizontal' as const },
    { label: 'Med Rect (300x250)', width: 300, height: 250, layout: 'vertical' as const },
    { label: 'Lg Rect (336x280)', width: 336, height: 280, layout: 'vertical' as const },
    { label: 'Skyscraper (160x600)', width: 160, height: 600, layout: 'tall' as const },
    { label: 'Half Page (300x600)', width: 300, height: 600, layout: 'tall' as const },
  ]

  // Pre-pick copy for each banner so thumb and expanded use the same text
  const bannerData = bannerConfigs.map(() => ({
    headline: pick(headlines)?.text || 'Your Headline Here',
    cta: pick(ctas)?.text || 'Learn More',
    description: pick(descriptions)?.text || null,
    benefit: pick(benefits)?.text || null,
  }))

  return (
    <div className="funnel-section-card">
      <div className="funnel-section-header">
        <h3>Banner Ad Mockups</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => { setShuffleKey(prev => prev + 1); setExpandedIdx(null) }}>
          &#8635; Shuffle Copy
        </button>
      </div>
      {headlines.length === 0 ? (
        <div className="funnel-tab-empty" style={{ padding: 40 }}>
          No copy components generated yet. Generate a campaign first, then banner mockups will appear here using your copy.
        </div>
      ) : (
        <>
          {/* Thumbnail grid */}
          <div className="banner-thumb-grid">
            {bannerConfigs.map((config, idx) => {
              const thumbMaxW = 160
              const thumbMaxH = 140
              const scaleW = thumbMaxW / config.width
              const scaleH = thumbMaxH / config.height
              const scale = Math.min(scaleW, scaleH)
              const thumbW = config.width * scale
              const thumbH = config.height * scale

              return (
                <div
                  key={`${config.label}-${shuffleKey}`}
                  className={`banner-thumb ${expandedIdx === idx ? 'banner-thumb-active' : ''}`}
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  title="Click to preview full size"
                >
                  <div style={{ width: thumbW, height: thumbH, overflow: 'hidden', borderRadius: 3 }}>
                    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: config.width, height: config.height }}>
                      <BannerContent
                        config={config} idx={idx} logoUrl={logoUrl}
                        headline={bannerData[idx].headline} cta={bannerData[idx].cta}
                        description={bannerData[idx].description} benefit={bannerData[idx].benefit}
                        primaryColor={primaryColor} bgColor={bgColor} textColor={textColor} accentColor={accentColor}
                      />
                    </div>
                  </div>
                  <div className="banner-thumb-label">{config.label}</div>
                </div>
              )
            })}
          </div>

          {/* Expanded full-size preview */}
          {expandedIdx !== null && (
            <div className="banner-expanded">
              <div className="banner-expanded-header">
                <span style={{ fontSize: 13, fontWeight: 600 }}>{bannerConfigs[expandedIdx].label} — Full Size</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setExpandedIdx(null)}>&times; Close</button>
              </div>
              <div className="banner-expanded-body">
                <BannerContent
                  config={bannerConfigs[expandedIdx]} idx={expandedIdx} logoUrl={logoUrl}
                  headline={bannerData[expandedIdx].headline} cta={bannerData[expandedIdx].cta}
                  description={bannerData[expandedIdx].description} benefit={bannerData[expandedIdx].benefit}
                  primaryColor={primaryColor} bgColor={bgColor} textColor={textColor} accentColor={accentColor}
                />
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ padding: '8px 24px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
        Click a thumbnail to see full size. Shuffle to see different copy combinations.
      </div>
    </div>
  )
}

// ── Video Ad Generator section ──────────────────────────────────────────
function VideoAdGenerator({
  hooks,
  shortScripts,
  longScripts,
  ctas,
  onDeny,
  onGenerateMore,
  onGenerateVideos,
  generatingSection,
  canEdit,
}: {
  hooks: CopyComponent[]
  shortScripts: CopyComponent[]
  longScripts: CopyComponent[]
  ctas: CopyComponent[]
  onDeny: (id: string) => void
  onGenerateMore: (sectionType: string) => void
  onGenerateVideos: () => void
  generatingSection: string | null
  canEdit: boolean
}) {
  const [shuffled, setShuffled] = useState<{
    hook: CopyComponent | null
    script: CopyComponent | null
    cta: CopyComponent | null
  }>({ hook: null, script: null, cta: null })

  const allScripts = [...shortScripts, ...longScripts]
  const combos = hooks.length * Math.max(allScripts.length, 1) * Math.max(ctas.length, 1)

  const shuffle = () => {
    setShuffled({
      hook: hooks.length ? hooks[Math.floor(Math.random() * hooks.length)] : null,
      script: allScripts.length ? allScripts[Math.floor(Math.random() * allScripts.length)] : null,
      cta: ctas.length ? ctas[Math.floor(Math.random() * ctas.length)] : null,
    })
  }

  const isEmpty = hooks.length === 0 && shortScripts.length === 0 && longScripts.length === 0

  return (
    <div className="funnel-section-card">
      <div className="funnel-section-header">
        <h3>Video Ad Generator</h3>
        {canEdit && isEmpty && (
          <button
            className="btn btn-primary"
            onClick={onGenerateVideos}
            disabled={generatingSection === 'video'}
            style={{ background: '#7c3aed' }}
          >
            {generatingSection === 'video' ? 'Generating...' : '\u{1F3AC} Generate Video Ads'}
          </button>
        )}
      </div>
      {isEmpty && canEdit && (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          background: 'rgba(124, 58, 237, 0.05)', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
            No video content generated yet. Click the button above to generate hooks, short scripts, and long scripts in one batch.
          </div>
        </div>
      )}
      <div className="video-generator">
        <div className="video-column">
          <div className="video-column-header">Hooks</div>
          <div className="video-column-list">
            {hooks.slice(0, 15).map((h, i) => (
              <CopyRow key={h.id} item={{ ...h, text: `${i + 1}. ${h.text}` }} onDeny={onDeny} />
            ))}
            {hooks.length === 0 && <div className="video-empty">No hooks yet</div>}
          </div>
        </div>
        <div className="video-column">
          <div className="video-column-header">Short Script (~30s)</div>
          <div className="video-column-list">
            {shortScripts.map((s, i) => (
              <div key={s.id} className="video-script-card">
                <div className="video-script-num">{i + 1}</div>
                <CopyRow item={s} onDeny={onDeny} />
              </div>
            ))}
            {shortScripts.length === 0 && <div className="video-empty">No short scripts yet</div>}
          </div>
        </div>
        <div className="video-column">
          <div className="video-column-header">Long Script (~60s)</div>
          <div className="video-column-list">
            {longScripts.map((s, i) => (
              <div key={s.id} className="video-script-card">
                <div className="video-script-num">{i + 1}</div>
                <CopyRow item={s} onDeny={onDeny} />
              </div>
            ))}
            {longScripts.length === 0 && <div className="video-empty">No long scripts yet</div>}
          </div>
        </div>
        <div className="video-column">
          <div className="video-column-header">CTAs</div>
          <div className="video-column-list">
            {ctas.slice(0, 10).map((c) => (
              <CopyRow key={c.id} item={c} onDeny={onDeny} />
            ))}
            {ctas.length === 0 && <div className="video-empty">No CTAs yet</div>}
          </div>
        </div>
      </div>
      <div className="video-controls">
        <button className="btn btn-secondary btn-sm" onClick={shuffle}>
          &#8635; Shuffle Variations
        </button>
        <span className="combinations-counter">{combos.toLocaleString()} Combinations Ready</span>
        {canEdit && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onGenerateMore('video_hook')}
              disabled={!!generatingSection}
            >
              {generatingSection === 'video_hook' ? 'Generating...' : '+ Hooks'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onGenerateMore('short_script')}
              disabled={!!generatingSection}
            >
              {generatingSection === 'short_script' ? 'Generating...' : '+ Short Scripts'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onGenerateMore('long_script')}
              disabled={!!generatingSection}
            >
              {generatingSection === 'long_script' ? 'Generating...' : '+ Long Scripts'}
            </button>
          </div>
        )}
      </div>
      {shuffled.hook && (
        <div className="shuffle-result">
          <div className="shuffle-label">Shuffled Combo:</div>
          <div className="shuffle-item"><strong>Hook:</strong> {shuffled.hook.text}</div>
          {shuffled.script && <div className="shuffle-item"><strong>Script:</strong> {shuffled.script.text.slice(0, 200)}...</div>}
          {shuffled.cta && <div className="shuffle-item"><strong>CTA:</strong> {shuffled.cta.text}</div>}
        </div>
      )}
    </div>
  )
}

// ── Main Funnel Page ────────────────────────────────────────────────────
export default function FunnelPage() {
  const {
    client,
    avatars,
    offers,
    funnelInstances,
    copyComponents,
    refreshCopyComponents,
    refreshFunnelInstances,
    setLoading,
    loading,
    canEdit,
  } = useAppStore()

  const [avatarId, setAvatarId] = useState('')
  const [offerId, setOfferId] = useState('')
  const [activeTab, setActiveTab] = useState('google_headlines')
  const [angleFilter, setAngleFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [generating, setGenerating] = useState(false)
  const [generatingSection, setGeneratingSection] = useState<string | null>(null)
  const [showPrompter, setShowPrompter] = useState(false)
  const [prompterSection, setPrompterSection] = useState('')
  const [promptText, setPromptText] = useState('')
  const [promptQuantity, setPromptQuantity] = useState(5)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const approvedAvatars = avatars.filter((a) => a.status === 'approved')
  const approvedOffers = offers.filter((o) => o.status === 'approved')

  // Set defaults
  useEffect(() => {
    if (approvedAvatars.length > 0 && !avatarId) setAvatarId(approvedAvatars[0].id)
  }, [approvedAvatars, avatarId])

  useEffect(() => {
    if (approvedOffers.length > 0 && !offerId) setOfferId(approvedOffers[0].id)
  }, [approvedOffers, offerId])

  // Find the single funnel instance for this Avatar+Offer
  const currentInstance = useMemo(
    () => funnelInstances.find(
      (fi) => fi.avatar_id === avatarId && fi.offer_id === offerId && fi.status === 'active'
    ) || null,
    [funnelInstances, avatarId, offerId]
  )

  // All approved components for this instance
  const instanceComponents = useMemo(
    () => currentInstance
      ? copyComponents.filter(
          (cc) => cc.funnel_instance_id === currentInstance.id && cc.status !== 'denied'
        )
      : [],
    [copyComponents, currentInstance]
  )

  // Filtered components (angle + platform)
  const filteredComponents = useMemo(() => {
    let items = instanceComponents
    if (angleFilter !== 'all') {
      items = items.filter((c) => (c.angle_ids || []).includes(angleFilter))
    }
    if (platformFilter !== 'all') {
      items = items.filter((c) => c.platform === platformFilter || c.platform === 'all')
    }
    return items
  }, [instanceComponents, angleFilter, platformFilter])

  // Get unique angles used across all components
  const usedAngles = useMemo(() => {
    const set = new Set<string>()
    instanceComponents.forEach((c) => (c.angle_ids || []).forEach((a) => set.add(a)))
    return Array.from(set)
  }, [instanceComponents])

  // Components for active tab
  const activeTabDef = TABS.find((t) => t.key === activeTab) || TABS[0]
  const tabComponents = useMemo(() => {
    let items = filteredComponents.filter((c) => activeTabDef.types.includes(c.type))
    if (sortBy === 'newest') items.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (sortBy === 'oldest') items.sort((a, b) => a.created_at.localeCompare(b.created_at))
    else if (sortBy === 'shortest') items.sort((a, b) => a.text.length - b.text.length)
    else if (sortBy === 'longest') items.sort((a, b) => b.text.length - a.text.length)
    return items
  }, [filteredComponents, activeTabDef, sortBy])

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tab of TABS) {
      counts[tab.key] = filteredComponents.filter((c) => tab.types.includes(c.type)).length
    }
    return counts
  }, [filteredComponents])

  // Stats
  const stats = useMemo(() => ({
    headlines: instanceComponents.filter((c) =>
      ['headline', 'google_headline', 'hero_headline'].includes(c.type)
    ).length,
    bannerAds: 0, // From creatives table — placeholder for now
    videoScripts: instanceComponents.filter((c) =>
      ['video_hook', 'short_script', 'long_script', 'video_script'].includes(c.type)
    ).length,
    landingPages: 0, // From landing_pages table — placeholder
  }), [instanceComponents])

  // Video components
  const videoHooks = useMemo(
    () => filteredComponents.filter((c) => c.type === 'video_hook'),
    [filteredComponents]
  )
  const shortScripts = useMemo(
    () => filteredComponents.filter((c) => c.type === 'short_script'),
    [filteredComponents]
  )
  const longScripts = useMemo(
    () => filteredComponents.filter((c) => ['long_script', 'video_script'].includes(c.type)),
    [filteredComponents]
  )
  const ctaComponents = useMemo(
    () => filteredComponents.filter((c) => ['cta', 'hero_cta'].includes(c.type)),
    [filteredComponents]
  )

  // Check what's missing — used to show "Generate All" / "Generate Video" buttons
  const hasAdCopy = useMemo(() => {
    return instanceComponents.some(c => ['headline', 'google_headline', 'google_description', 'primary_text'].includes(c.type))
  }, [instanceComponents])

  const hasPersuasion = useMemo(() => {
    return instanceComponents.some(c => ['benefit', 'proof', 'cta', 'hero_headline', 'objection_handler'].includes(c.type))
  }, [instanceComponents])

  const hasVideoContent = useMemo(() => {
    return instanceComponents.some(c => ['video_hook', 'short_script', 'long_script', 'video_script'].includes(c.type))
  }, [instanceComponents])

  // True if substantial copy is missing (instance exists but incomplete generation)
  const isMissingCopy = currentInstance && instanceComponents.length > 0 && (!hasAdCopy || !hasPersuasion || instanceComponents.length < 40)

  // Avatar component count for selector label
  const avatarComponentCount = useCallback(
    (avId: string) => {
      const fi = funnelInstances.find(
        (f) => f.avatar_id === avId && f.status === 'active'
      )
      if (!fi) return 0
      return copyComponents.filter(
        (c) => c.funnel_instance_id === fi.id && c.status !== 'denied'
      ).length
    },
    [funnelInstances, copyComponents]
  )

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!client) return
    setGenerating(true)
    setLoading(true)
    try {
      const result = await generateFunnel(avatarId, offerId, 'full')
      await Promise.all([
        refreshFunnelInstances(client.id),
        refreshCopyComponents(client.id),
      ])
      if (result.components_created > 0) {
        showToast(`Campaign generated! ${result.components_created} copy components created across ${result.batch_summary?.length || 3} batches.`)
      } else {
        showToast('Campaign instance created but no copy components were generated. Try again or check the AI configuration.')
      }
    } catch (err) {
      showToast(`Generation failed: ${(err as Error).message}`)
      console.error('Funnel generation error:', err)
    } finally {
      setGenerating(false)
      setLoading(false)
    }
  }

  // Generate ALL missing copy for an existing instance (3 parallel batches)
  async function handleGenerateAllCopy() {
    if (!client || !currentInstance) return
    setGenerating(true)
    setLoading(true)
    try {
      const result = await generateFunnel(avatarId, offerId, 'fill_all')
      await refreshCopyComponents(client.id)
      showToast(`Generated ${result.components_created} new copy components!`)
    } catch (err) {
      showToast(`Generation failed: ${(err as Error).message}`)
      console.error('Generate all copy error:', err)
    } finally {
      setGenerating(false)
      setLoading(false)
    }
  }

  // Generate only video content for an existing instance
  async function handleGenerateVideos() {
    if (!client || !currentInstance) return
    setGeneratingSection('video')
    try {
      const result = await generateFunnel(avatarId, offerId, 'video_only')
      await refreshCopyComponents(client.id)
      showToast(`Generated ${result.components_created} video components!`)
    } catch (err) {
      showToast(`Generation failed: ${(err as Error).message}`)
      console.error('Generate video error:', err)
    } finally {
      setGeneratingSection(null)
    }
  }

  async function handleGenerateMore(sectionType: string) {
    if (!currentInstance || !client) return
    setGeneratingSection(sectionType)
    try {
      await generateMore(currentInstance.id, sectionType, {
        angleFilter: angleFilter !== 'all' ? angleFilter : undefined,
      })
      await refreshCopyComponents(client.id)
      showToast('New items generated!')
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setGeneratingSection(null)
    }
  }

  async function handlePrompterGenerate() {
    if (!currentInstance || !client) return
    setGeneratingSection(prompterSection)
    setShowPrompter(false)
    try {
      await generateMore(currentInstance.id, prompterSection, {
        userPrompt: promptText,
        quantity: promptQuantity,
        angleFilter: angleFilter !== 'all' ? angleFilter : undefined,
      })
      await refreshCopyComponents(client.id)
      showToast(`${promptQuantity} new items generated!`)
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setGeneratingSection(null)
      setPromptText('')
    }
  }

  async function handleDeny(componentId: string) {
    if (!client) return
    await supabase.from('copy_components').update({ status: 'denied' }).eq('id', componentId)
    selectedIds.delete(componentId)
    setSelectedIds(new Set(selectedIds))
    await refreshCopyComponents(client.id)
  }

  async function handleBulkDeny() {
    if (!client || selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    // Batch update in chunks of 50
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50)
      await supabase.from('copy_components').update({ status: 'denied' }).in('id', batch)
    }
    showToast(`Denied ${ids.length} items`)
    setSelectedIds(new Set())
    setSelectionMode(false)
    await refreshCopyComponents(client.id)
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function selectAllInTab() {
    const next = new Set(selectedIds)
    tabComponents.forEach(c => next.add(c.id))
    setSelectedIds(next)
  }

  function deselectAllInTab() {
    const next = new Set(selectedIds)
    tabComponents.forEach(c => next.delete(c.id))
    setSelectedIds(next)
  }

  const tabSelectedCount = tabComponents.filter(c => selectedIds.has(c.id)).length
  const allTabSelected = tabComponents.length > 0 && tabSelectedCount === tabComponents.length

  async function handleDeleteInstance() {
    if (!currentInstance || !client) return
    if (!confirm('Delete this funnel instance and all its components? This cannot be undone.')) return
    setLoading(true)
    await supabase.from('copy_components').delete().eq('funnel_instance_id', currentInstance.id)
    await supabase.from('funnel_instances').delete().eq('id', currentInstance.id)
    await Promise.all([
      refreshFunnelInstances(client.id),
      refreshCopyComponents(client.id),
    ])
    setLoading(false)
    showToast('Instance deleted.')
  }

  function openPrompter(sectionType: string) {
    setPrompterSection(sectionType)
    setPromptText('')
    setPromptQuantity(5)
    setShowPrompter(true)
  }

  // ── Render: No client / no prerequisites ─────────────────────────────
  if (!client || approvedAvatars.length === 0 || approvedOffers.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Funnel</h1>
            <p className="page-subtitle">Select Avatar + Offer, then generate your complete campaign asset library</p>
          </div>
        </div>
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">&#9889;</div>
          <div className="empty-state-text">
            {!client
              ? 'Select a client to get started'
              : 'You need approved avatars and offers first. Start in Business Overview.'}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Main page ────────────────────────────────────────────────
  return (
    <div className="funnel-page">
      {/* Top: 2 Selectors Only */}
      <div className="funnel-selectors">
        <div className="selector-group">
          <label className="form-label">Avatar</label>
          <select
            className="form-input"
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
          >
            {approvedAvatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({avatarComponentCount(a.id)})
              </option>
            ))}
          </select>
        </div>
        <div className="selector-group">
          <label className="form-label">Offer</label>
          <select
            className="form-input"
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
          >
            {approvedOffers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentInstance ? (
        <>
          {/* Stats Bar */}
          <div className="funnel-stats-bar">
            <div className="funnel-stat">
              <div className="funnel-stat-value">{stats.headlines}</div>
              <div className="funnel-stat-label">Headlines Generated</div>
            </div>
            <div className="funnel-stat">
              <div className="funnel-stat-value">{stats.bannerAds}</div>
              <div className="funnel-stat-label">Banner Ads</div>
            </div>
            <div className="funnel-stat">
              <div className="funnel-stat-value">{stats.videoScripts}</div>
              <div className="funnel-stat-label">Video Script Variations</div>
            </div>
            <div className="funnel-stat">
              <div className="funnel-stat-value">{stats.landingPages}</div>
              <div className="funnel-stat-label">Landing Pages</div>
            </div>
          </div>

          {/* ── Generate Actions Bar ──────────────────────────────── */}
          {canEdit && (isMissingCopy || !hasVideoContent) && (
            <div className="funnel-actions-bar">
              {generating ? (
                <div className="generating-inline">
                  <div className="generating-spinner" style={{ width: 20, height: 20 }} />
                  <span>Generating copy components across 3 parallel AI batches... This takes 30-60 seconds.</span>
                </div>
              ) : (
                <>
                  {isMissingCopy && (
                    <button
                      className="btn btn-primary"
                      onClick={handleGenerateAllCopy}
                      disabled={generating || !!generatingSection}
                    >
                      &#9889; Generate All Copy Components
                    </button>
                  )}
                  {!hasVideoContent && (
                    <button
                      className="btn btn-primary"
                      onClick={handleGenerateVideos}
                      disabled={generating || !!generatingSection}
                      style={{ background: '#7c3aed' }}
                    >
                      &#127909; Generate Video Ads
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {instanceComponents.length} components generated.
                    {isMissingCopy ? ' Missing ad copy, persuasion elements, or both.' : ''}
                    {!hasVideoContent ? ' No video scripts yet.' : ''}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Full generating overlay */}
          {generating && (
            <div className="generating-overlay" style={{ padding: 40 }}>
              <div className="generating-spinner" />
              <div className="generating-text">AI is generating your complete campaign library...</div>
              <div className="generating-sub">
                Running 3 parallel batches: Ad Copy, Persuasion Elements, and Video Scripts.
                Each batch generates ~20-80 components. This takes 30-60 seconds.
              </div>
            </div>
          )}

          {/* ── Copy Generator Section ─────────────────────────────── */}
          <div className="funnel-section-card">
            <div className="funnel-section-header">
              <h3>Copy Generator</h3>
            </div>

            {/* Filter Bar */}
            <div className="funnel-filter-bar">
              {canEdit && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => openPrompter(activeTabDef.types[0])}
                  disabled={!!generatingSection}
                >
                  + Generate More
                </button>
              )}
              <select
                className="form-input form-input-sm"
                value={angleFilter}
                onChange={(e) => setAngleFilter(e.target.value)}
              >
                <option value="all">Angle: All</option>
                {usedAngles.map((slug) => (
                  <option key={slug} value={slug}>
                    {getAngleLabel(slug)}
                  </option>
                ))}
              </select>
              <select
                className="form-input form-input-sm"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="all">Platform: All</option>
                <option value="google">Google</option>
                <option value="meta">Meta</option>
                <option value="youtube">YouTube</option>
                <option value="landing_page">Landing Page</option>
              </select>
              <select
                className="form-input form-input-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="shortest">Shortest</option>
                <option value="longest">Longest</option>
              </select>
            </div>

            {/* Tab Navigation */}
            <div className="funnel-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`funnel-tab ${activeTab === tab.key ? 'funnel-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {tabCounts[tab.key] > 0 && (
                    <span className="funnel-tab-count">{tabCounts[tab.key]}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Bulk selection bar */}
            {selectionMode && (
              <div className="bulk-action-bar">
                <label className="bulk-select-all" onClick={() => allTabSelected ? deselectAllInTab() : selectAllInTab()}>
                  <input type="checkbox" checked={allTabSelected} readOnly />
                  <span>{allTabSelected ? 'Deselect All' : 'Select All'} in this tab</span>
                </label>
                <span className="bulk-count">{selectedIds.size} selected</span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBulkDeny}
                  disabled={selectedIds.size === 0}
                >
                  Deny {selectedIds.size} Items
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Content List */}
            <div className="funnel-tab-content">
              {tabComponents.length > 0 ? (
                <>
                  {tabComponents.map((item) => (
                    <CopyRow
                      key={item.id}
                      item={item}
                      onDeny={handleDeny}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={toggleSelect}
                      selectionMode={selectionMode}
                    />
                  ))}
                </>
              ) : (
                <div className="funnel-tab-empty">
                  No items in this section{angleFilter !== 'all' ? ` for ${getAngleLabel(angleFilter)}` : ''}
                </div>
              )}
            </div>

            {/* Tab Footer (team only) */}
            {canEdit && (
              <div className="funnel-tab-footer">
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleGenerateMore(activeTabDef.types[0])}
                    disabled={!!generatingSection}
                  >
                    {generatingSection === activeTabDef.types[0] ? 'Generating...' : 'Generate More'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openPrompter(activeTabDef.types[0])}
                  >
                    Prompt AI
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!selectionMode ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectionMode(true)}
                      title="Select items to bulk deny"
                    >
                      Select &amp; Deny
                    </button>
                  ) : (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={handleBulkDeny}
                      disabled={selectedIds.size === 0}
                    >
                      Deny {selectedIds.size} Selected
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Banner Ad Mockups ──────────────────────────────────── */}
          <BannerAdMockups
            components={instanceComponents}
            brandKit={client?.brand_kit || null}
            clientName={client?.name || ''}
            logoUrl={client?.logo_url || null}
          />

          {/* ── Video Ad Generator ────────────────────────────────── */}
          <VideoAdGenerator
            hooks={videoHooks}
            shortScripts={shortScripts}
            longScripts={longScripts}
            ctas={ctaComponents}
            onDeny={handleDeny}
            onGenerateMore={handleGenerateMore}
            onGenerateVideos={handleGenerateVideos}
            generatingSection={generatingSection}
            canEdit={canEdit}
          />

          {/* Instance actions (delete for broken instances) */}
          {instanceComponents.length === 0 && (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-text">Instance exists but no copy was generated.</div>
              {canEdit && (
                <button className="btn btn-danger" style={{ marginTop: 16 }} onClick={handleDeleteInstance} disabled={loading}>
                  Delete Instance
                </button>
              )}
            </div>
          )}
        </>
      ) : generating ? (
        <div className="generating-overlay">
          <div className="generating-spinner" />
          <div className="generating-text">AI is generating your complete campaign library...</div>
          <div className="generating-sub">
            Generating ~130-180 copy components across multiple angles. Headlines, social copy, benefits,
            video scripts, CTAs, and more. This may take 30-60 seconds.
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">&#9889;</div>
          <div className="empty-state-text">No campaign generated for this Avatar + Offer</div>
          <div className="empty-state-sub">
            {canEdit
              ? 'AI will generate ~130-180 copy components across multiple angles in one shot'
              : 'No campaign has been generated for this combination yet.'}
          </div>
          {canEdit && (
            <button
              className="btn btn-primary btn-lg"
              style={{ marginTop: 20 }}
              onClick={handleGenerate}
              disabled={loading}
            >
              Generate Campaign
            </button>
          )}
        </div>
      )}

      {/* ── Generate More Prompter Modal ────────────────────────────── */}
      {showPrompter && (
        <div className="modal-overlay" onClick={() => setShowPrompter(false)}>
          <div className="modal prompter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Generate More Copy</h3>
              <button className="modal-close" onClick={() => setShowPrompter(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Section Type</label>
                <select
                  className="form-input"
                  value={prompterSection}
                  onChange={(e) => setPrompterSection(e.target.value)}
                >
                  {ALL_SECTION_TYPES.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
                {angleFilter !== 'all' && (
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    Filtered to: <AngleBadge slug={angleFilter} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">How many?</label>
                <select
                  className="form-input"
                  value={promptQuantity}
                  onChange={(e) => setPromptQuantity(Number(e.target.value))}
                >
                  <option value={5}>5 items</option>
                  <option value={10}>10 items</option>
                  <option value={15}>15 items</option>
                  <option value={20}>20 items</option>
                  <option value={30}>30 items</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Direction for AI (optional)</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="e.g., Focus on urgency and time-sensitivity. Write headlines that create FOMO around limited availability."
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPrompter(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handlePrompterGenerate}>
                Generate {promptQuantity} {ALL_SECTION_TYPES.find(s => s.value === prompterSection)?.label || 'Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
