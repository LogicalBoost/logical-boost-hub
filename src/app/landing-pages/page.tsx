'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import {
  buildLandingPage,
  iterateLandingPage,
  approveLandingPage,
  deployLandingPage,
  generateMissingCopySlots,
} from '@/lib/api'
import { TEMPLATE_SLOTS, mapComponentsToSlots, type CopySlotDef } from '@/lib/stitch'
import { TEMPLATE_INFO, type TemplateId, type LandingPage } from '@/types/database'
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
  { num: 5, label: 'Preview + Iterate' },
  { num: 6, label: 'Approve' },
  { num: 7, label: 'Deploy' },
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
// Progress messages for build step
// ============================================================
const BUILD_MESSAGES = [
  'Assembling copy slots into Stitch prompt...',
  'Sending wireframe + copy to Stitch API...',
  'Stitch is rendering your landing page...',
  'Applying brand styles and polish...',
  'Almost there, finalizing preview...',
]

// ============================================================
// Main Page Component
// ============================================================
export default function LandingPagesPage() {
  const store = useAppStore()
  const { client, avatars, offers, copyComponents, landingPages, canEdit, refreshLandingPages } = store

  // Pipeline state
  const [step, setStep] = useState(1)
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null)
  const [copySlots, setCopySlots] = useState<Record<string, string>>({})
  const [missingSlotIds, setMissingSlotIds] = useState<string[]>([])
  const [slotOptions, setSlotOptions] = useState<Record<string, Array<{ id?: string; text: string }>>>({})

  // Build state
  const [building, setBuilding] = useState(false)
  const [buildMsgIdx, setBuildMsgIdx] = useState(0)
  const [activePage, setActivePage] = useState<LandingPage | null>(null)

  // Iterate state
  const [iteratePrompt, setIteratePrompt] = useState('')
  const [iterating, setIterating] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')

  // Approve / Deploy state
  const [approving, setApproving] = useState(false)
  const [deploying, setDeploying] = useState(false)

  // Generate missing copy state
  const [generatingCopy, setGeneratingCopy] = useState(false)

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
    setMissingSlotIds(missing)
    setSlotOptions(options)
    setStep(3)
  }, [copyComponents, selectedAvatarId, selectedOfferId])

  const handleSlotChange = useCallback((slotId: string, value: string) => {
    setCopySlots(prev => ({ ...prev, [slotId]: value }))
    setMissingSlotIds(prev => value.trim() ? prev.filter(id => id !== slotId) : [...prev, slotId])
  }, [])

  const handleGenerateMissing = useCallback(async () => {
    if (!client || !selectedAvatarId || !selectedOfferId || !selectedTemplate) return
    setGeneratingCopy(true)
    try {
      const result = await generateMissingCopySlots(
        client.id,
        selectedAvatarId,
        selectedOfferId,
        selectedTemplate,
        missingSlotIds
      )
      if (result.generated_slots) {
        setCopySlots(prev => ({ ...prev, ...result.generated_slots }))
        setMissingSlotIds([])
        showToast('Missing copy slots generated successfully')
      }
    } catch (err) {
      showToast(`Error generating copy: ${(err as Error).message}`)
    } finally {
      setGeneratingCopy(false)
    }
  }, [client, selectedAvatarId, selectedOfferId, selectedTemplate, missingSlotIds])

  const allSlotsFilled = useMemo(() => {
    if (templateSlots.length === 0) return false
    return templateSlots.every(slot => copySlots[slot.id]?.trim())
  }, [templateSlots, copySlots])

  const handleBuild = useCallback(async () => {
    if (!client || !selectedAvatarId || !selectedOfferId || !selectedTemplate) return
    setBuilding(true)
    setBuildMsgIdx(0)

    // Cycle through progress messages
    const interval = setInterval(() => {
      setBuildMsgIdx(prev => Math.min(prev + 1, BUILD_MESSAGES.length - 1))
    }, 3000)

    try {
      const result = await buildLandingPage(
        client.id,
        selectedAvatarId,
        selectedOfferId,
        selectedTemplate,
        copySlots
      )
      clearInterval(interval)
      if (result.landing_page) {
        setActivePage(result.landing_page)
        showToast('Landing page built successfully')
        setStep(5)
        // Refresh store
        store.refreshLandingPages(client.id)
      }
    } catch (err) {
      clearInterval(interval)
      showToast(`Build error: ${(err as Error).message}`)
    } finally {
      setBuilding(false)
    }
  }, [client, selectedAvatarId, selectedOfferId, selectedTemplate, copySlots, store])

  const handleIterate = useCallback(async () => {
    if (!activePage || !iteratePrompt.trim()) return
    setIterating(true)
    try {
      const result = await iterateLandingPage(activePage.id, iteratePrompt.trim())
      if (result.landing_page) {
        setActivePage(result.landing_page)
        setIteratePrompt('')
        showToast('Page updated with your changes')
        if (client) store.refreshLandingPages(client.id)
      }
    } catch (err) {
      showToast(`Iterate error: ${(err as Error).message}`)
    } finally {
      setIterating(false)
    }
  }, [activePage, iteratePrompt, client, store])

  const handleApprove = useCallback(async () => {
    if (!activePage) return
    setApproving(true)
    try {
      const result = await approveLandingPage(activePage.id)
      if (result.landing_page) {
        setActivePage(result.landing_page)
        showToast('Design approved! Converting to production code...')
        setStep(7)
        if (client) store.refreshLandingPages(client.id)
      }
    } catch (err) {
      showToast(`Approve error: ${(err as Error).message}`)
    } finally {
      setApproving(false)
    }
  }, [activePage, client, store])

  const handleDeploy = useCallback(async () => {
    if (!activePage) return
    setDeploying(true)
    try {
      const result = await deployLandingPage(activePage.id)
      if (result.landing_page) {
        setActivePage(result.landing_page)
        showToast('Page deployed successfully!')
        if (client) store.refreshLandingPages(client.id)
      }
    } catch (err) {
      showToast(`Deploy error: ${(err as Error).message}`)
    } finally {
      setDeploying(false)
    }
  }, [activePage, client, store])

  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => showToast('URL copied to clipboard'))
  }, [])

  // Resume an existing page into the pipeline
  const handleResumePage = useCallback((page: LandingPage) => {
    setActivePage(page)
    setSelectedAvatarId(page.avatar_id)
    setSelectedOfferId(page.offer_id)
    if (page.template_id) setSelectedTemplate(page.template_id)
    if (page.copy_slots) setCopySlots(page.copy_slots)

    if (page.deploy_status === 'deployed') {
      setStep(7)
    } else if (page.deploy_status === 'approved' || page.deploy_status === 'converting') {
      setStep(7)
    } else if (page.stitch_preview_url || page.stitch_output_code) {
      setStep(5)
    } else {
      setStep(4)
    }
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
          Build, preview, and deploy high-converting landing pages with Stitch
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
                {templateSlots.length - missingSlotIds.length} of {templateSlots.length} slots filled
                {missingSlotIds.length > 0 && (
                  <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                    ({missingSlotIds.length} missing)
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {missingSlotIds.length > 0 && (
                <button
                  style={btn('ghost', generatingCopy)}
                  disabled={generatingCopy}
                  onClick={handleGenerateMissing}
                >
                  {generatingCopy ? 'Generating...' : 'Generate Missing Copy'}
                </button>
              )}
              <button
                style={btn('primary', !allSlotsFilled)}
                disabled={!allSlotsFilled}
                onClick={() => setStep(4)}
              >
                Proceed to Build
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {templateSlots.map(slot => {
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
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: Build with Stitch */}
      {/* ============================================================ */}
      {step === 4 && (
        <div style={{ ...card({ maxWidth: 540, textAlign: 'center' as const, margin: '0 auto' }) }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Build Landing Page</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Stitch will combine your template wireframe and copy slots into a pixel-perfect landing page.
          </p>

          {building ? (
            <div>
              <div style={{
                width: 48,
                height: 48,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite',
              }} />
              <p style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}>
                {BUILD_MESSAGES[buildMsgIdx]}
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <button
              style={btn('primary', !allSlotsFilled)}
              disabled={!allSlotsFilled || !canEdit}
              onClick={handleBuild}
            >
              Build Landing Page
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 5: Preview + Iterate */}
      {/* ============================================================ */}
      {step === 5 && activePage && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 18 }}>Preview + Iterate</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['desktop', 'mobile'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPreviewMode(mode)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: previewMode === mode ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: previewMode === mode ? 'var(--accent-muted)' : 'transparent',
                    color: previewMode === mode ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {mode === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
              <button
                style={btn('primary')}
                onClick={() => setStep(6)}
              >
                Ready to Approve
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
            {/* Preview iframe */}
            <div style={{
              ...card({ padding: 0, overflow: 'hidden' }),
              height: 700,
              display: 'flex',
              justifyContent: 'center',
              background: '#111',
            }}>
              <iframe
                srcDoc={activePage.stitch_output_code || '<html><body style="background:#111;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><p>Preview loading...</p></body></html>'}
                src={activePage.stitch_preview_url || undefined}
                style={{
                  width: previewMode === 'desktop' ? '100%' : 375,
                  height: '100%',
                  border: 'none',
                  transition: 'width 0.3s',
                }}
                title="Landing page preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>

            {/* Iteration panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Iterate input */}
              <div style={card()}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
                  Request Changes
                </h4>
                <textarea
                  value={iteratePrompt}
                  onChange={e => setIteratePrompt(e.target.value)}
                  placeholder="Describe what you want changed... e.g. 'Make the hero headline more urgent' or 'Change CTA color to red'"
                  rows={4}
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
                    marginBottom: 10,
                  }}
                />
                <button
                  style={btn('primary', !iteratePrompt.trim() || iterating)}
                  disabled={!iteratePrompt.trim() || iterating}
                  onClick={handleIterate}
                >
                  {iterating ? 'Applying changes...' : 'Apply Changes'}
                </button>
              </div>

              {/* Version history */}
              {activePage.iteration_history && activePage.iteration_history.length > 0 && (
                <div style={card()}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
                    Version History
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {activePage.iteration_history.map((entry, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                          v{idx + 1} &middot; {new Date(entry.timestamp).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {entry.prompt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 6: Approve + Convert */}
      {/* ============================================================ */}
      {step === 6 && activePage && (
        <div style={{ ...card({ maxWidth: 540, textAlign: 'center' as const, margin: '0 auto' }) }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Approve Design</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Approving will lock the design and convert it to production-ready code for deployment.
          </p>

          {approving || activePage.deploy_status === 'converting' ? (
            <div>
              <div style={{
                width: 48,
                height: 48,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite',
              }} />
              <p style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}>
                Converting to production code...
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={btn('ghost')} onClick={() => setStep(5)}>
                Back to Preview
              </button>
              <button
                style={btn('primary')}
                disabled={!canEdit}
                onClick={handleApprove}
              >
                Approve Design
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 7: Deploy */}
      {/* ============================================================ */}
      {step === 7 && activePage && (
        <div style={{ ...card({ maxWidth: 540, textAlign: 'center' as const, margin: '0 auto' }) }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Deploy</h3>

          {activePage.deploy_status === 'deployed' && activePage.deploy_url ? (
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'var(--success-muted)',
                color: 'var(--success)',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 16,
              }}>
                LIVE
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Your landing page is live at:
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: 16,
              }}>
                <a
                  href={activePage.deploy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {activePage.deploy_url}
                </a>
                <button
                  onClick={() => handleCopyUrl(activePage.deploy_url!)}
                  style={{
                    ...btn('ghost'),
                    padding: '6px 12px',
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  Copy
                </button>
              </div>
              <button style={btn('ghost')} onClick={() => { setStep(1); setActivePage(null) }}>
                Build Another Page
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                Deploy your approved landing page to a live URL.
              </p>
              {deploying ? (
                <div>
                  <div style={{
                    width: 48,
                    height: 48,
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--accent)',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <p style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}>Deploying...</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : (
                <button
                  style={btn('primary')}
                  disabled={!canEdit}
                  onClick={handleDeploy}
                >
                  Deploy Page
                </button>
              )}
            </div>
          )}
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
