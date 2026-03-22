'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { generateFunnel, generateMore, recommendAngles } from '@/lib/api'
import { showToast } from '@/lib/demo-toast'
import { ANGLES, getAngleLabel } from '@/types/database'
import type { CopyComponent, CopyComponentType } from '@/types/database'
import { supabase } from '@/lib/supabase'

const SECTION_LABELS: Record<string, string> = {
  headline: 'Headlines',
  subheadline: 'Subheadlines',
  primary_text: 'Primary Text (Meta)',
  google_headline: 'Google Headlines',
  google_description: 'Google Descriptions',
  benefit: 'Key Benefits',
  proof: 'Social Proof',
  urgency: 'Urgency Elements',
  fear_point: 'Fear Points',
  value_point: 'Value Points',
  cta: 'Calls to Action',
  video_hook: 'Video Hooks',
  video_script: 'Video Scripts',
  objection_handler: 'Objection Handlers',
  description: 'Descriptions',
}

function FunnelSection({
  title,
  items,
  showPlatform,
  onDeny,
  onGenerateMore,
  generating,
}: {
  title: string
  items: CopyComponent[]
  showPlatform?: boolean
  onDeny: (id: string) => void
  onGenerateMore: () => void
  generating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const displayItems = expanded ? items : items.slice(0, 3)

  return (
    <div className="section-card">
      <div className="section-header">
        <span className="section-title">{title}</span>
        <span className="section-count">{items.length} items</span>
      </div>
      <div className="section-body">
        {displayItems.map((item) => (
          <div key={item.id} className="copy-item">
            <div className="copy-text">{item.text}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {showPlatform && item.platform && (
                <span className="tag" style={{ fontSize: 11 }}>{item.platform}</span>
              )}
              <span className="char-count">{item.character_count} chars</span>
            </div>
            <div className="copy-item-actions">
              <button
                className="btn btn-danger btn-sm btn-icon"
                title="Deny"
                onClick={() => onDeny(item.id)}
              >
                &#10005;
              </button>
            </div>
          </div>
        ))}
        {items.length > 3 && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : `View All (${items.length})`}
          </button>
        )}
      </div>
      <div className="section-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={onGenerateMore}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate More'}
        </button>
      </div>
    </div>
  )
}

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
  } = useAppStore()

  const [avatarId, setAvatarId] = useState('')
  const [offerId, setOfferId] = useState('')
  const [angle, setAngle] = useState('')
  const [recommendedSlugs, setRecommendedSlugs] = useState<string[]>([])
  const [generatingSection, setGeneratingSection] = useState<string | null>(null)

  const approvedAvatars = avatars.filter((a) => a.status === 'approved')
  const approvedOffers = offers.filter((o) => o.status === 'approved')

  // Set defaults when avatars/offers load
  useEffect(() => {
    if (approvedAvatars.length > 0 && !avatarId) {
      setAvatarId(approvedAvatars[0].id)
    }
  }, [approvedAvatars, avatarId])

  useEffect(() => {
    if (approvedOffers.length > 0 && !offerId) {
      setOfferId(approvedOffers[0].id)
    }
  }, [approvedOffers, offerId])

  useEffect(() => {
    if (ANGLES.length > 0 && !angle) {
      setAngle(ANGLES[0].slug)
    }
  }, [angle])

  // Fetch recommended angles when avatar+offer change
  const fetchRecommendations = useCallback(async () => {
    if (!avatarId || !offerId) return
    try {
      const result = await recommendAngles(avatarId, offerId)
      if (result?.recommended_angles && Array.isArray(result.recommended_angles)) {
        setRecommendedSlugs(result.recommended_angles)
      }
    } catch {
      // Silently fail — just show all angles without recommendations
    }
  }, [avatarId, offerId])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  // Find matching funnel instance
  const currentInstance = funnelInstances.find(
    (fi) =>
      fi.avatar_id === avatarId &&
      fi.offer_id === offerId &&
      fi.primary_angle === angle &&
      fi.status === 'active'
  )

  // Filter copy components for current funnel instance, excluding denied
  const instanceComponents = currentInstance
    ? copyComponents.filter(
        (cc) => cc.funnel_instance_id === currentInstance.id && cc.status !== 'denied'
      )
    : []

  // Group by type
  const groupedComponents: Record<string, CopyComponent[]> = {}
  for (const comp of instanceComponents) {
    if (!groupedComponents[comp.type]) {
      groupedComponents[comp.type] = []
    }
    groupedComponents[comp.type].push(comp)
  }

  // No client or prerequisite data
  if (!client || approvedAvatars.length === 0 || approvedOffers.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Funnel</h1>
            <p className="page-subtitle">Complete campaign system for Avatar + Offer + Angle</p>
          </div>
        </div>
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">&#9889;</div>
          <div className="empty-state-text">
            You need avatars and offers first. Start by analyzing your business in Business Overview.
          </div>
        </div>
      </div>
    )
  }

  async function handleGenerateCampaign() {
    if (!client) return
    setLoading(true)
    showToast('AI is generating your complete campaign...')
    try {
      await generateFunnel(avatarId, offerId, angle, [])
      await Promise.all([
        refreshFunnelInstances(client.id),
        refreshCopyComponents(client.id),
      ])
      showToast('Campaign generated successfully!')
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateMore(sectionType: string) {
    if (!currentInstance || !client) return
    setGeneratingSection(sectionType)
    try {
      await generateMore(currentInstance.id, sectionType)
      await refreshCopyComponents(client.id)
      showToast(`More ${SECTION_LABELS[sectionType] || sectionType} generated!`)
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setGeneratingSection(null)
    }
  }

  async function handleDeny(componentId: string) {
    if (!client) return
    const { error } = await supabase
      .from('copy_components')
      .update({ status: 'denied' })
      .eq('id', componentId)
    if (error) {
      showToast(`Error denying item: ${error.message}`)
      return
    }
    await refreshCopyComponents(client.id)
    showToast('Item denied')
  }

  const sectionOrder: CopyComponentType[] = [
    'headline',
    'subheadline',
    'primary_text',
    'google_headline',
    'google_description',
    'benefit',
    'proof',
    'urgency',
    'fear_point',
    'value_point',
    'cta',
    'video_hook',
    'video_script',
    'objection_handler',
    'description',
  ]

  const nonRecommendedAngles = ANGLES.filter(
    (a) => !recommendedSlugs.includes(a.slug)
  )
  const recommendedAngleItems = ANGLES.filter((a) =>
    recommendedSlugs.includes(a.slug)
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Funnel</h1>
          <p className="page-subtitle">Complete campaign system for Avatar + Offer + Angle</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="selectors-row">
        <div className="selector-group">
          <label className="form-label">Avatar</label>
          <select
            className="form-input"
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
          >
            {approvedAvatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
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
        <div className="selector-group">
          <label className="form-label">Angle</label>
          <select
            className="form-input"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
          >
            {recommendedAngleItems.length > 0 && (
              <optgroup label="Recommended">
                {recommendedAngleItems.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.label}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={recommendedAngleItems.length > 0 ? 'All Angles' : 'Angles'}>
              {nonRecommendedAngles.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {currentInstance ? (
        <>
          {sectionOrder.map((type) => {
            const items = groupedComponents[type]
            if (!items || items.length === 0) return null
            return (
              <FunnelSection
                key={type}
                title={SECTION_LABELS[type] || getAngleLabel(type)}
                items={items}
                showPlatform={['headline', 'primary_text', 'google_headline', 'google_description'].includes(type)}
                onDeny={handleDeny}
                onGenerateMore={() => handleGenerateMore(type)}
                generating={generatingSection === type}
              />
            )
          })}

          {/* Show sections that exist in data but aren't in sectionOrder */}
          {Object.keys(groupedComponents)
            .filter((type) => !sectionOrder.includes(type as CopyComponentType))
            .map((type) => {
              const items = groupedComponents[type]
              if (!items || items.length === 0) return null
              return (
                <FunnelSection
                  key={type}
                  title={SECTION_LABELS[type] || type}
                  items={items}
                  showPlatform
                  onDeny={handleDeny}
                  onGenerateMore={() => handleGenerateMore(type)}
                  generating={generatingSection === type}
                />
              )
            })}

          {instanceComponents.length === 0 && (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-text">
                Campaign generated but no copy components found. Try generating more content.
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">&#9889;</div>
          <div className="empty-state-text">No campaign generated for this combination</div>
          <div className="empty-state-sub">Click below to generate the full campaign asset set</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={handleGenerateCampaign}
            disabled={loading}
          >
            {loading ? 'AI is generating your complete campaign...' : 'Generate Campaign'}
          </button>
        </div>
      )}
    </div>
  )
}
