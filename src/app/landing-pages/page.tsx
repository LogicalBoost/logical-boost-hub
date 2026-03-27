'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import {
  generateHeroImage,
} from '@/lib/api'
import { TEMPLATE_SLOTS, mapComponentsToSlots, type CopySlotDef } from '@/lib/template-slots'
import { TEMPLATE_INFO, type TemplateId, type LandingPage, type MediaAsset } from '@/types/database'
import { showToast } from '@/lib/demo-toast'
import { supabase } from '@/lib/supabase'

// ============================================================
// Copy picker for slot options
// ============================================================
function SlotCopyPicker({
  options,
  currentValue,
  onSelect,
}: {
  options: Array<{ id?: string; text: string }>
  currentValue: string
  onSelect: (text: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (options.length === 0) return null

  // Filter out the currently selected value
  const otherOptions = options.filter(o => o.text !== currentValue)
  if (otherOptions.length === 0) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 12,
          cursor: 'pointer',
          padding: '2px 0',
        }}
      >
        <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
        {otherOptions.length} other option{otherOptions.length !== 1 ? 's' : ''} available
      </button>
      {expanded && (
        <div style={{
          marginTop: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 200,
          overflowY: 'auto',
          padding: 4,
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          {otherOptions.map((opt, i) => (
            <button
              key={opt.id || i}
              onClick={() => {
                onSelect(opt.text)
                setExpanded(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                lineHeight: 1.5,
                cursor: 'pointer',
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseOver={e => {
                (e.target as HTMLElement).style.borderColor = 'var(--accent)'
                ;(e.target as HTMLElement).style.background = 'var(--bg-input)'
              }}
              onMouseOut={e => {
                (e.target as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.target as HTMLElement).style.background = 'var(--bg-card)'
              }}
            >
              {opt.text.length > 200 ? opt.text.substring(0, 200) + '...' : opt.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Step tracker
// ============================================================
const STEPS = [
  { num: 1, label: 'Select Avatar + Offer' },
  { num: 2, label: 'Choose Template' },
  { num: 3, label: 'Review Copy Slots' },
  { num: 4, label: 'Build Page' },
]

// ============================================================
// Shared inline style helpers
// ============================================================
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: 20,
  ...extra,
})

const btn = (variant: 'primary' | 'ghost' | 'danger' = 'primary', disabled = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  borderRadius: 'var(--radius-sm)',
  border: variant === 'ghost' ? '1px solid var(--border)' : 'none',
  background:
    disabled ? 'var(--bg-input)' :
    variant === 'primary' ? 'var(--accent)' :
    variant === 'danger' ? 'var(--danger)' :
    'transparent',
  color: disabled ? 'var(--text-muted)' :
    variant === 'ghost' ? 'var(--text-secondary)' : '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.15s',
  opacity: disabled ? 0.5 : 1,
})

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

// ============================================================
// Main Page Component
// ============================================================
export default function LandingPagesPage() {
  const store = useAppStore()
  const { client, avatars, offers, copyComponents, landingPages, mediaAssets, canEdit, refreshLandingPages, refreshMediaAssets } = store

  // Pipeline state
  const [step, setStep] = useState(1)
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null)
  const [copySlots, setCopySlots] = useState<Record<string, string>>({})
  const [missingSlotIds, setMissingSlotIds] = useState<string[]>([])
  const [slotOptions, setSlotOptions] = useState<Record<string, Array<{ id?: string; text: string }>>>({})

  // Active page (for resuming existing pages)
  const [activePage, setActivePage] = useState<LandingPage | null>(null)

  // Hero image generation state
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageStyle, setImageStyle] = useState<'hero' | 'family' | 'trust' | 'lifestyle'>('hero')
  const [customImagePrompt, setCustomImagePrompt] = useState('')
  const [imageError, setImageError] = useState<string | null>(null)

  // Parallax background image state
  const [parallaxImageUrl, setParallaxImageUrl] = useState<string | null>(null)
  const [uploadingParallax, setUploadingParallax] = useState(false)

  // Lightbox state for full image preview
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Derived data
  const approvedAvatars = useMemo(
    () => [...avatars].filter(a => a.status === 'approved').sort((a, b) => a.priority - b.priority),
    [avatars]
  )
  const approvedOffers = useMemo(
    () => offers.filter(o => o.status === 'approved'),
    [offers]
  )

  // Existing pages for current avatar+offer combo
  const existingPagesForCombo = useMemo(() => {
    if (!selectedAvatarId || !selectedOfferId) return []
    return landingPages.filter(
      p => p.avatar_id === selectedAvatarId && p.offer_id === selectedOfferId
    )
  }, [landingPages, selectedAvatarId, selectedOfferId])

  // All existing pages for this client
  const allExistingPages = useMemo(() => landingPages, [landingPages])

  // Template slots for selected template
  const templateSlots: CopySlotDef[] = useMemo(() => {
    if (!selectedTemplate) return []
    return TEMPLATE_SLOTS[selectedTemplate] || []
  }, [selectedTemplate])

  // ============================================================
  // Handlers
  // ============================================================

  const handleAvatarOfferSelect = useCallback(() => {
    if (!selectedAvatarId || !selectedOfferId) return
    // Reset downstream state
    setSelectedTemplate(null)
    setCopySlots({})
    setMissingSlotIds([])
    setActivePage(null)
    setStep(2)
  }, [selectedAvatarId, selectedOfferId])

  const handleTemplateSelect = useCallback((tid: TemplateId) => {
    setSelectedTemplate(tid)
    // Auto-map copy components to slots — filter to matching avatar+offer
    const approvedCopy = copyComponents.filter(
      c =>
        c.status === 'approved' &&
        (c.avatar_ids?.includes(selectedAvatarId!) || (c.avatar_ids || []).length === 0) &&
        (c.offer_ids?.includes(selectedOfferId!) || (c.offer_ids || []).length === 0)
    )
    const { filled, missing, options } = mapComponentsToSlots(
      tid,
      approvedCopy.map(c => ({ id: c.id, type: c.type, text: c.text }))
    )
    setCopySlots(filled)
    setMissingSlotIds(missing) // Only copy slots — business/media excluded
    setSlotOptions(options)
    setStep(3)
  }, [copyComponents, selectedAvatarId, selectedOfferId])

  const handleSlotChange = useCallback((slotId: string, value: string) => {
    setCopySlots(prev => ({ ...prev, [slotId]: value }))
    setMissingSlotIds(prev => value.trim() ? prev.filter(id => id !== slotId) : [...prev, slotId])
  }, [])


  const handleGenerateHeroImage = useCallback(async () => {
    if (!client || !selectedAvatarId) return
    setGeneratingImage(true)
    setImageError(null)
    try {
      const result = await generateHeroImage(
        client.id,
        selectedAvatarId,
        imageStyle,
        customImagePrompt.trim() || undefined,
        selectedOfferId || undefined
      )
      if (result.image_url) {
        setHeroImageUrl(result.image_url)
        setCopySlots(prev => ({ ...prev, hero_image: result.image_url }))
        showToast('Hero image generated successfully')
        if (client) refreshMediaAssets(client.id)
      } else {
        setImageError('No image was returned. Try again or upload your own.')
      }
    } catch (err) {
      const msg = (err as Error).message
      setImageError(msg)
      showToast(`Image generation error: ${msg}`)
    } finally {
      setGeneratingImage(false)
    }
  }, [client, selectedAvatarId, imageStyle, customImagePrompt])

  // Upload an image file to Supabase storage (for hero or parallax)
  const handleImageUpload = useCallback(async (
    file: File,
    type: 'hero' | 'parallax'
  ) => {
    if (!client) return
    const setter = type === 'hero' ? setHeroImageUrl : setParallaxImageUrl
    const loadingSetter = type === 'hero' ? setGeneratingImage : setUploadingParallax

    loadingSetter(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const filename = `${type}-upload-${Date.now()}.${ext}`
      const storagePath = `${client.id}/${filename}`

      const { error: uploadError } = await supabase
        .storage
        .from('client-assets')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase
        .storage
        .from('client-assets')
        .getPublicUrl(storagePath)

      setter(urlData.publicUrl)

      if (type === 'hero') {
        setCopySlots(prev => ({ ...prev, hero_image: urlData.publicUrl }))
      } else {
        setCopySlots(prev => ({ ...prev, parallax_image: urlData.publicUrl }))
      }

      // Save to media_assets table
      await supabase.from('media_assets').insert({
        client_id: client.id,
        role: type === 'hero' ? 'hero_image' : 'parallax',
        file_url: urlData.publicUrl,
        file_type: 'image',
        storage_path: storagePath,
        filename: file.name,
        display_name: file.name,
        metadata: { source: 'uploaded' },
      })
      refreshMediaAssets(client.id)

      showToast(`${type === 'hero' ? 'Hero' : 'Parallax'} image uploaded`)
    } catch (err) {
      showToast(`Upload error: ${(err as Error).message}`)
    } finally {
      loadingSetter(false)
    }
  }, [client])

  // Handle drag & drop / file input for images
  const handleImageDrop = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    type: 'hero' | 'parallax'
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file, type)
    } else {
      showToast('Please drop an image file (PNG, JPG, WebP)')
    }
  }, [handleImageUpload])

  const handleImageFileSelect = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'hero' | 'parallax'
  ) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file, type)
  }, [handleImageUpload])

  // Only required copy slots need to be filled to proceed
  const copyOnlySlots = useMemo(
    () => templateSlots.filter(s => s.source === 'copy'),
    [templateSlots]
  )
  const requiredCopySlots = useMemo(
    () => copyOnlySlots.filter(s => !s.optional),
    [copyOnlySlots]
  )
  const allSlotsFilled = useMemo(() => {
    if (requiredCopySlots.length === 0) return false
    return requiredCopySlots.every(slot => copySlots[slot.id]?.trim())
  }, [requiredCopySlots, copySlots])

  // Resume an existing page into the pipeline
  const handleResumePage = useCallback((page: LandingPage) => {
    setActivePage(page)
    setSelectedAvatarId(page.avatar_id)
    setSelectedOfferId(page.offer_id)
    if (page.template_id) setSelectedTemplate(page.template_id)
    if (page.copy_slots) setCopySlots(page.copy_slots)
    setStep(3)
  }, [])

  // Delete a landing page (with confirmation handled in the component)
  const handleDeletePage = useCallback(async (page: LandingPage) => {
    if (!client) return
    try {
      const { error } = await supabase
        .from('landing_pages')
        .delete()
        .eq('id', page.id)
      if (error) throw error
      showToast('Landing page deleted')
      refreshLandingPages(client.id)
      // If this was the active page, clear it
      if (activePage?.id === page.id) {
        setActivePage(null)
        setStep(1)
      }
    } catch (err) {
      showToast('Delete failed: ' + (err as Error).message)
    }
  }, [client, activePage, refreshLandingPages])

  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => showToast('URL copied to clipboard'))
  }, [])

  // ============================================================
  // No client guard
  // ============================================================
  if (!client) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2 style={{ fontSize: 22, marginBottom: 8, color: 'var(--text-primary)' }}>Landing Pages</h2>
        <p>Select a client from the header to get started.</p>
      </div>
    )
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Landing Page Builder</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Build, preview, and deploy high-converting landing pages
        </p>
      </div>

      {/* Step indicator */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 28,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        {STEPS.map(s => {
          const isActive = s.num === step
          const isCompleted = s.num < step
          return (
            <button
              key={s.num}
              onClick={() => {
                // Only allow going back to completed steps
                if (s.num < step) setStep(s.num)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 20,
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: isActive ? 'var(--accent-muted)' : isCompleted ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--accent)' : isCompleted ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                cursor: s.num < step ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: isCompleted ? 'var(--accent)' : isActive ? 'var(--accent-muted)' : 'var(--bg-input)',
                color: isCompleted ? '#fff' : isActive ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {isCompleted ? '\u2713' : s.num}
              </span>
              {s.label}
            </button>
          )
        })}
      </div>

      {/* ============================================================ */}
      {/* STEP 1: Select Avatar + Offer */}
      {/* ============================================================ */}
      {step === 1 && (
        <div style={card({ maxWidth: 640 })}>
          <h3 style={{ fontSize: 18, marginBottom: 16 }}>Select Avatar + Offer</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Avatar</label>
              <select
                style={selectStyle}
                value={selectedAvatarId || ''}
                onChange={e => setSelectedAvatarId(e.target.value || null)}
              >
                <option value="">Choose an avatar...</option>
                {approvedAvatars.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.priority === 1 ? '(Primary)' : `(#${a.priority})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Offer</label>
              <select
                style={selectStyle}
                value={selectedOfferId || ''}
                onChange={e => setSelectedOfferId(e.target.value || null)}
              >
                <option value="">Choose an offer...</option>
                {approvedOffers.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            style={btn('primary', !selectedAvatarId || !selectedOfferId)}
            disabled={!selectedAvatarId || !selectedOfferId}
            onClick={handleAvatarOfferSelect}
          >
            Continue
          </button>

          {/* Show existing pages for this combo */}
          {existingPagesForCombo.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Existing pages for this combination:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {existingPagesForCombo.map(p => (
                  <ExistingPageMini key={p.id} page={p} onResume={handleResumePage} onDelete={handleDeletePage} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: Select Template */}
      {/* ============================================================ */}
      {step === 2 && (
        <div>
          <h3 style={{ fontSize: 18, marginBottom: 16 }}>Choose a Template</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {(Object.entries(TEMPLATE_INFO) as [TemplateId, { name: string; bestFor: string }][]).map(
              ([tid, info]) => {
                const isSelected = selectedTemplate === tid
                return (
                  <button
                    key={tid}
                    onClick={() => handleTemplateSelect(tid)}
                    style={{
                      ...card(),
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: isSelected
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                    }}
                  >
                    {isSelected && (
                      <span style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        background: 'var(--accent)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                      }}>{'\u2713'}</span>
                    )}
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                    }}>
                      {tid.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                      {info.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {info.bestFor}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      {TEMPLATE_SLOTS[tid]?.length || 0} copy slots
                    </div>
                  </button>
                )
              }
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: Review Copy Slots */}
      {/* ============================================================ */}
      {step === 3 && selectedTemplate && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 18, marginBottom: 4 }}>Review Copy Slots</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {requiredCopySlots.filter(s => copySlots[s.id]?.trim()).length} of {requiredCopySlots.length} required slots filled
                {missingSlotIds.length > 0 && (
                  <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                    ({missingSlotIds.length} missing)
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                style={btn('primary', !allSlotsFilled)}
                disabled={!allSlotsFilled}
                onClick={() => setStep(4)}
              >
                Proceed to Build
              </button>
              {!allSlotsFilled && requiredCopySlots.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--warning, #f59e0b)', margin: '6px 0 0', width: '100%' }}>
                  &#9888; {requiredCopySlots.filter(s => !copySlots[s.id]?.trim()).length} required slot{requiredCopySlots.filter(s => !copySlots[s.id]?.trim()).length !== 1 ? 's' : ''} still empty:{' '}
                  {requiredCopySlots.filter(s => !copySlots[s.id]?.trim()).map(s => s.label).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Required Copy Slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {templateSlots.filter(s => s.source === 'copy' && !s.optional).map(slot => {
              const value = copySlots[slot.id] || ''
              const isFilled = value.trim().length > 0
              return (
                <div key={slot.id} style={card({ padding: 16 })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      background: isFilled ? 'var(--success-muted)' : 'var(--warning-muted)',
                      color: isFilled ? 'var(--success)' : 'var(--warning)',
                      flexShrink: 0,
                    }}>
                      {isFilled ? '\u2713' : '!'}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {slot.label}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      background: 'var(--bg-input)',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}>
                      {slot.contentType}
                    </span>
                    {slot.isArray && (
                      <span style={{
                        fontSize: 11,
                        color: 'var(--accent)',
                        background: 'var(--accent-muted)',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}>
                        array
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{slot.notes}</p>
                  <textarea
                    value={value}
                    onChange={e => handleSlotChange(slot.id, e.target.value)}
                    placeholder={`Enter ${slot.label.toLowerCase()}...`}
                    rows={slot.isArray ? 4 : 2}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      resize: 'vertical',
                      lineHeight: 1.5,
                    }}
                  />
                  {/* Copy options picker */}
                  <SlotCopyPicker
                    options={slotOptions[slot.id] || []}
                    currentValue={value}
                    onSelect={(text) => handleSlotChange(slot.id, text)}
                  />
                </div>
              )
            })}
          </div>

          {/* Optional Copy Slots */}
          {templateSlots.some(s => s.source === 'copy' && s.optional) && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Optional
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  Skip these — add via iteration after you get the initial design back
                </span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {templateSlots.filter(s => s.source === 'copy' && s.optional).map(slot => {
                  const value = copySlots[slot.id] || ''
                  return (
                    <div key={slot.id} style={card({ padding: 16, opacity: 0.6 })}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-input)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}>
                          Optional
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {slot.label}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{slot.notes}</p>
                      <textarea
                        value={value}
                        onChange={e => handleSlotChange(slot.id, e.target.value)}
                        placeholder={`Optional — ${slot.label.toLowerCase()}...`}
                        rows={slot.isArray ? 3 : 1}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          resize: 'vertical',
                          lineHeight: 1.5,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Business Asset Slots */}
          {templateSlots.some(s => s.source === 'business' || s.source === 'media') && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Business Assets &amp; Media
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  These are entered manually — not AI-generated copy
                </span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {templateSlots.filter(s => s.source === 'business' || s.source === 'media').map(slot => {
                  const value = copySlots[slot.id] || ''
                  const sourceLabel = slot.source === 'media' ? 'Media' : 'Business Asset'
                  const sourceColor = slot.source === 'media' ? '#8b5cf6' : '#6b7280'
                  return (
                    <div key={slot.id} style={card({ padding: 16, opacity: 0.85 })}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11,
                          color: sourceColor,
                          background: `${sourceColor}18`,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}>
                          {sourceLabel}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {slot.label}
                        </span>
                        {slot.isArray && (
                          <span style={{
                            fontSize: 11,
                            color: 'var(--accent)',
                            background: 'var(--accent-muted)',
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}>
                            array
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{slot.notes}</p>
                      <textarea
                        value={value}
                        onChange={e => handleSlotChange(slot.id, e.target.value)}
                        placeholder={
                          slot.source === 'media'
                            ? `Paste ${slot.label.toLowerCase()} URL...`
                            : `Enter from Business Overview — ${slot.label.toLowerCase()}...`
                        }
                        rows={slot.isArray ? 3 : 1}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          resize: 'vertical',
                          lineHeight: 1.5,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Hero Image — Generate or Upload */}
          {/* ============================================================ */}
          <div style={{ marginTop: 24 }}>
            <div style={{
              ...card(),
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(139, 92, 246, 0.04) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>&#128247;</span>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Hero Image
                  </h4>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Generate an AI hero shot or upload your own image
                  </p>
                </div>
              </div>

              {/* Saved Images Gallery — always visible when assets exist */}
              {mediaAssets.filter(a => a.role === 'hero_image').length > 0 && (
                <div style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                  background: 'rgba(139, 92, 246, 0.04)',
                }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', display: 'block', marginBottom: 8 }}>
                    Your Saved Images <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— click to use</span>
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {mediaAssets.filter(a => a.role === 'hero_image').map(asset => (
                      <div
                        key={asset.id}
                        onClick={() => {
                          setHeroImageUrl(asset.file_url)
                          setCopySlots(prev => ({ ...prev, hero_image: asset.file_url }))
                          showToast('Hero image selected')
                        }}
                        style={{
                          width: 100,
                          height: 72,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: heroImageUrl === asset.file_url ? '2px solid #8b5cf6' : '1px solid var(--border)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                          boxShadow: heroImageUrl === asset.file_url ? '0 0 12px rgba(139,92,246,0.3)' : 'none',
                        }}
                        title={asset.style ? `${asset.style} style` : 'Uploaded image'}
                      >
                        <img
                          src={asset.file_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {heroImageUrl === asset.file_url && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'rgba(139,92,246,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 18, fontWeight: 700,
                          }}>&#10003;</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image preview — shown at top when we have one */}
              {heroImageUrl && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                    onClick={() => setLightboxUrl(heroImageUrl)}
                    title="Click to view full size"
                  >
                    <img
                      src={heroImageUrl}
                      alt="Hero image"
                      style={{
                        width: '100%',
                        maxHeight: 300,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    {/* Expand icon */}
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 14,
                      pointerEvents: 'none',
                    }}>
                      &#x26F6;
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '8px 12px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                        Click to preview full size
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setHeroImageUrl(null); setCopySlots(prev => { const n = { ...prev }; delete n.hero_image; return n }) }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          background: 'rgba(0,0,0,0.4)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Two columns: Upload | Generate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Upload / Drop zone */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Upload Image
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#8b5cf6' }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    onDrop={e => { e.currentTarget.style.borderColor = 'var(--border)'; handleImageDrop(e, 'hero') }}
                    onClick={() => document.getElementById('hero-image-input')?.click()}
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '28px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                      background: 'rgba(139, 92, 246, 0.02)',
                    }}
                  >
                    {generatingImage ? (
                      <div>
                        <div style={{
                          width: 32, height: 32,
                          border: '3px solid var(--border)', borderTopColor: '#8b5cf6',
                          borderRadius: '50%', margin: '0 auto 8px',
                          animation: 'spin 1s linear infinite',
                        }} />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.5 }}>&#128193;</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                          Drop an image here
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                          or click to browse (PNG, JPG, WebP)
                        </p>
                      </>
                    )}
                    <input
                      id="hero-image-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => handleImageFileSelect(e, 'hero')}
                    />
                  </div>
                </div>

                {/* AI Generate */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    AI Generate
                  </label>

                  {/* Style pills */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {([
                      { id: 'hero' as const, label: 'Hero' },
                      { id: 'family' as const, label: 'Family' },
                      { id: 'trust' as const, label: 'Portrait' },
                      { id: 'lifestyle' as const, label: 'Lifestyle' },
                    ]).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setImageStyle(s.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 12,
                          border: imageStyle === s.id ? '1px solid rgba(139, 92, 246, 0.6)' : '1px solid var(--border)',
                          background: imageStyle === s.id ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                          color: imageStyle === s.id ? '#a78bfa' : 'var(--text-muted)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom prompt */}
                  <textarea
                    value={customImagePrompt}
                    onChange={e => setCustomImagePrompt(e.target.value)}
                    placeholder="Optional: describe the person you want..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      resize: 'vertical',
                      lineHeight: 1.5,
                      marginBottom: 8,
                    }}
                  />

                  <button
                    style={{
                      ...btn('primary', generatingImage),
                      background: generatingImage ? 'var(--bg-input)' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                    disabled={generatingImage || !selectedAvatarId}
                    onClick={handleGenerateHeroImage}
                  >
                    {generatingImage ? (
                      <>
                        <span style={{
                          width: 14, height: 14,
                          border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                          borderRadius: '50%', display: 'inline-block',
                          animation: 'spin 1s linear infinite',
                        }} />
                        Generating...
                      </>
                    ) : 'Generate with AI'}
                  </button>

                  {imageError && (
                    <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>
                      {imageError}
                    </p>
                  )}
                </div>
              </div>

              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
                The hero image will be placed prominently in the hero section of your landing page.
              </p>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Parallax Background Image */}
          {/* ============================================================ */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              ...card(),
              border: '1px solid rgba(59, 130, 246, 0.25)',
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(59, 130, 246, 0.03) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>&#127748;</span>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Parallax Background Image
                  </h4>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    A full-width background that scrolls at a different speed for depth effect
                  </p>
                </div>
              </div>

              {/* Saved Parallax Gallery — always visible when assets exist */}
              {mediaAssets.filter(a => a.role === 'parallax').length > 0 && (
                <div style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  background: 'rgba(59, 130, 246, 0.04)',
                }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', display: 'block', marginBottom: 8 }}>
                    Saved Backgrounds <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— click to use</span>
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {mediaAssets.filter(a => a.role === 'parallax').map(asset => (
                      <div
                        key={asset.id}
                        onClick={() => {
                          setParallaxImageUrl(asset.file_url)
                          setCopySlots(prev => ({ ...prev, parallax_image: asset.file_url }))
                          showToast('Parallax background selected')
                        }}
                        style={{
                          width: 120,
                          height: 56,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: parallaxImageUrl === asset.file_url ? '2px solid #3b82f6' : '1px solid var(--border)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                          boxShadow: parallaxImageUrl === asset.file_url ? '0 0 12px rgba(59,130,246,0.3)' : 'none',
                        }}
                      >
                        <img
                          src={asset.file_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {parallaxImageUrl === asset.file_url && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'rgba(59,130,246,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 18, fontWeight: 700,
                          }}>&#10003;</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parallax preview */}
              {parallaxImageUrl && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      position: 'relative',
                      height: 140,
                      cursor: 'pointer',
                    }}
                    onClick={() => setLightboxUrl(parallaxImageUrl)}
                    title="Click to view full size"
                  >
                    <img
                      src={parallaxImageUrl}
                      alt="Parallax background"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                      <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>Parallax Background Set — click to preview</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setParallaxImageUrl(null); setCopySlots(prev => { const n = { ...prev }; delete n.parallax_image; return n }) }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          background: 'rgba(0,0,0,0.4)',
                          color: '#fff',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload zone */}
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6' }}
                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                onDrop={e => { e.currentTarget.style.borderColor = 'var(--border)'; handleImageDrop(e, 'parallax') }}
                onClick={() => document.getElementById('parallax-image-input')?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '20px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  background: 'rgba(59, 130, 246, 0.02)',
                }}
              >
                {uploadingParallax ? (
                  <div>
                    <div style={{
                      width: 28, height: 28,
                      border: '3px solid var(--border)', borderTopColor: '#3b82f6',
                      borderRadius: '50%', margin: '0 auto 6px',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Uploading...</p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                      {parallaxImageUrl ? 'Drop a new image to replace' : 'Drop an image here or click to browse'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                      Best: wide landscape photos, cityscapes, textures, nature scenes (1920px+ width)
                    </p>
                  </>
                )}
                <input
                  id="parallax-image-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => handleImageFileSelect(e, 'parallax')}
                />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: Build Landing Page (placeholder for new template-based flow) */}
      {/* ============================================================ */}
      {step === 4 && (
        <div style={{ ...card({ maxWidth: 600, textAlign: 'center' as const, margin: '0 auto' }) }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Build Landing Page</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            The build pipeline is being upgraded. A new template-based rendering system will be available soon.
          </p>
          <div style={{
            padding: 16,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Your selections are saved:
              {selectedTemplate && <><br />Template: <strong>{TEMPLATE_INFO[selectedTemplate]?.name}</strong></>}
              <br />Copy slots: <strong>{Object.keys(copySlots).length} filled</strong>
              {heroImageUrl && <><br />Hero image: set</>}
              {parallaxImageUrl && <><br />Parallax image: set</>}
            </p>
          </div>
          <button style={btn('ghost')} onClick={() => setStep(3)}>
            Back to Copy Slots
          </button>
        </div>
      )}


      {/* ============================================================ */}
      {/* Existing Landing Pages for this client */}
      {/* ============================================================ */}
      {allExistingPages.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <h3 style={{ fontSize: 18, marginBottom: 16 }}>Existing Landing Pages</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {allExistingPages.map(page => (
              <ExistingPageCard
                key={page.id}
                page={page}
                avatars={avatars}
                offers={offers}
                onResume={handleResumePage}
                onCopyUrl={handleCopyUrl}
                onDelete={handleDeletePage}
              />
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Lightbox / Full Image Preview Modal */}
      {/* ============================================================ */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            padding: 24,
          }}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              fontSize: 22,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            &times;
          </button>
          <img
            src={lightboxUrl}
            alt="Full size preview"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 8,
              cursor: 'default',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================
// Existing Page Card (full card in bottom section)
// ============================================================
function ExistingPageCard({
  page,
  avatars,
  offers,
  onResume,
  onCopyUrl,
  onDelete,
}: {
  page: LandingPage
  avatars: { id: string; name: string }[]
  offers: { id: string; name: string }[]
  onResume: (p: LandingPage) => void
  onCopyUrl: (url: string) => void
  onDelete: (p: LandingPage) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const avatarName = avatars.find(a => a.id === page.avatar_id)?.name || 'Unknown'
  const offerName = offers.find(o => o.id === page.offer_id)?.name || 'Unknown'
  const templateName = page.template_id ? TEMPLATE_INFO[page.template_id]?.name || page.template_id : 'No template'

  const statusColors: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'var(--bg-input)', color: 'var(--text-muted)' },
    pending_approval: { bg: 'var(--warning-muted)', color: 'var(--warning)' },
    approved: { bg: 'var(--success-muted)', color: 'var(--success)' },
    converting: { bg: 'var(--warning-muted)', color: 'var(--warning)' },
    deployed: { bg: 'var(--success-muted)', color: 'var(--success)' },
    failed: { bg: 'var(--danger-muted)', color: 'var(--danger)' },
  }
  const sc = statusColors[page.deploy_status] || statusColors.draft

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {page.headline || 'Untitled Page'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date(page.created_at).toLocaleDateString()}
          </div>
        </div>
        <span style={{
          padding: '3px 10px',
          borderRadius: 12,
          background: sc.bg,
          color: sc.color,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          flexShrink: 0,
          marginLeft: 8,
        }}>
          {page.deploy_status}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: 'var(--accent-muted)',
          color: 'var(--accent)',
          fontSize: 11,
          fontWeight: 500,
        }}>
          {templateName}
        </span>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        <span style={{ fontWeight: 500 }}>Avatar:</span> {avatarName}
        <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
        <span style={{ fontWeight: 500 }}>Offer:</span> {offerName}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.15s',
            flex: 1,
            justifyContent: 'center',
          }}
          onClick={() => onResume(page)}
        >
          {page.deploy_status === 'deployed' ? 'View' : 'Resume'}
        </button>
        {page.deploy_status === 'deployed' && page.deploy_url && (
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onClick={() => onCopyUrl(page.deploy_url!)}
          >
            Copy URL
          </button>
        )}
        {confirmDelete ? (
          <>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--danger)',
                background: 'var(--danger)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
              onClick={() => { onDelete(page); setConfirmDelete(false) }}
            >
              Confirm Delete
            </button>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 14,
              cursor: 'pointer',
            }}
            title="Delete this page"
            onClick={() => setConfirmDelete(true)}
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Mini existing page row (shown in Step 1)
// ============================================================
function ExistingPageMini({
  page,
  onResume,
  onDelete,
}: {
  page: LandingPage
  onResume: (p: LandingPage) => void
  onDelete: (p: LandingPage) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const templateName = page.template_id ? TEMPLATE_INFO[page.template_id]?.name || page.template_id : '--'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {page.headline || 'Untitled'}
        </span>
        <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>&middot;</span>
        <span style={{ fontSize: 12 }}>{templateName}</span>
        <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>&middot;</span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: page.deploy_status === 'deployed' ? 'var(--success)' : 'var(--text-muted)',
        }}>
          {page.deploy_status}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
        {confirmDelete ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--danger)', alignSelf: 'center', marginRight: 4 }}>Delete?</span>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--danger)',
                background: 'var(--danger)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
              onClick={() => { onDelete(page); setConfirmDelete(false) }}
            >
              Yes, Delete
            </button>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
              onClick={() => onResume(page)}
            >
              Resume
            </button>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 14,
                cursor: 'pointer',
                lineHeight: 1,
              }}
              title="Delete this page"
              onClick={() => setConfirmDelete(true)}
            >
              &times;
            </button>
          </>
        )}
      </div>
    </div>
  )
}
