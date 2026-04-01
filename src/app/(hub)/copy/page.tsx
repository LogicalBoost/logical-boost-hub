'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { generateFunnel, generateMore, runQACopywriterReview, runQAComplianceReview } from '@/lib/api'
import { showToast } from '@/lib/demo-toast'
import { ANGLES, getAngleLabel, ANGLE_COLORS, TEMPLATE_INFO } from '@/types/database'
import type { CopyComponent, CopyComponentType, BrandKit, TemplateId, QAReview, QAComponentReview } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { TEMPLATE_SLOTS, mapComponentsToSlots } from '@/lib/template-slots'
import type { CopySlotDef } from '@/lib/template-slots'

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
function AngleBadge({ slug, compact }: { slug: string; compact?: boolean }) {
  const color = ANGLE_COLORS[slug] || '#6b7280'
  const label = getAngleLabel(slug)
  if (compact) {
    return (
      <span
        className="angle-dot"
        style={{ backgroundColor: color }}
        title={label}
      />
    )
  }
  return (
    <span
      className="angle-badge"
      style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}
    >
      {label}
    </span>
  )
}

// ── Single copy item row ────────────────────────────────────────────────
function CopyRow({
  item,
  onDeny,
  onEdit,
  selected,
  onToggleSelect,
  selectionMode,
  startEditing,
}: {
  item: CopyComponent
  onDeny: (id: string) => void
  onEdit?: (id: string, newText: string) => void
  selected?: boolean
  onToggleSelect?: (id: string) => void
  selectionMode?: boolean
  startEditing?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [confirmingDeny, setConfirmingDeny] = useState(false)
  const [editing, setEditing] = useState(startEditing || false)
  const [editText, setEditText] = useState(item.text)

  const handleCopy = async () => {
    if (confirmingDeny || editing) return
    if (selectionMode && onToggleSelect) {
      onToggleSelect(item.id)
      return
    }
    await copyToClipboard(item.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== item.text && onEdit) {
      onEdit(item.id, editText.trim())
    }
    setEditing(false)
  }

  const handleCancelEdit = () => {
    setEditText(item.text)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="copy-row copy-row-editing" onClick={e => e.stopPropagation()}>
        <textarea
          className="form-textarea"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          rows={Math.max(2, Math.ceil(editText.length / 80))}
          style={{ width: '100%', fontSize: 13, background: 'var(--bg-input)', resize: 'vertical' }}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit()
            if (e.key === 'Escape') handleCancelEdit()
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 'auto', alignSelf: 'center' }}>
            {editText.length} chars &middot; Ctrl+Enter to save
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleCancelEdit} style={{ fontSize: 11, padding: '4px 10px' }}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} style={{ fontSize: 11, padding: '4px 10px' }} disabled={!editText.trim() || editText === item.text}>Save</button>
        </div>
      </div>
    )
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
        <span className="copy-row-angles-full">
          {(item.angle_ids || []).map((slug) => (
            <AngleBadge key={slug} slug={slug} />
          ))}
        </span>
        <span className="copy-row-angles-compact">
          {(item.angle_ids || []).map((slug) => (
            <AngleBadge key={slug} slug={slug} compact />
          ))}
        </span>
        <span className="copy-row-chars">({item.character_count || item.text.length})</span>
        {/* Edit button */}
        {onEdit && !confirmingDeny && (
          <button
            className="copy-row-deny"
            title="Edit this item"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            style={{ padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
        {confirmingDeny ? (
          <span className="copy-row-deny-confirm" onClick={(e) => e.stopPropagation()}>
            <button
              className="copy-row-deny-yes"
              onClick={(e) => {
                e.stopPropagation()
                onDeny(item.id)
                setConfirmingDeny(false)
              }}
            >
              Remove
            </button>
            <button
              className="copy-row-deny-cancel"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmingDeny(false)
              }}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            className="copy-row-deny"
            title="Remove this item"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmingDeny(true)
            }}
            style={{ padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        )}
      </div>
      {copied && <span className="copy-feedback">Copied!</span>}
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
          <div className="video-column-header">1. Hooks</div>
          <div className="video-column-list">
            {hooks.slice(0, 15).map((h, i) => (
              <CopyRow key={h.id} item={{ ...h, text: `${i + 1}. ${h.text}` }} onDeny={onDeny} />
            ))}
            {hooks.length === 0 && <div className="video-empty">No hooks yet</div>}
          </div>
        </div>
        <div className="video-column">
          <div className="video-column-header">2. Script Body (~30s)</div>
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
          <div className="video-column-header">3. Script Body (~60s)</div>
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
          <div className="video-column-header">4. CTAs</div>
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
          &#8635; Shuffle
        </button>
        <span className="combinations-counter">{combos.toLocaleString()} Combos</span>
        {canEdit && (
          <div className="video-generate-btns">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onGenerateMore('video_hook')}
              disabled={!!generatingSection}
            >
              {generatingSection === 'video_hook' ? '...' : '+ Hooks'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onGenerateMore('short_script')}
              disabled={!!generatingSection}
            >
              {generatingSection === 'short_script' ? '...' : '+ Short'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onGenerateMore('long_script')}
              disabled={!!generatingSection}
            >
              {generatingSection === 'long_script' ? '...' : '+ Long'}
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

// ── Landing Page Copy Section ──────────────────────────────────────────
function TemplateCopySection({
  instanceComponents,
  onGenerateMore,
  generatingSection,
  canEdit,
}: {
  instanceComponents: CopyComponent[]
  onGenerateMore: (sectionType: string, templatePrompt?: string) => void
  generatingSection: string | null
  canEdit: boolean
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | ''>('')
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)

  const templateIds = Object.keys(TEMPLATE_INFO) as TemplateId[]

  // Map components to selected template's slots
  const slotMapping = useMemo(() => {
    if (!selectedTemplate) return null
    const comps = instanceComponents.map(c => ({ id: c.id, type: c.type, text: c.text }))
    return mapComponentsToSlots(selectedTemplate, comps)
  }, [selectedTemplate, instanceComponents])

  const allSlots = selectedTemplate ? (TEMPLATE_SLOTS[selectedTemplate] || []) : []
  // Only show copy slots here — business assets belong in Business Overview
  const copySlots = allSlots.filter(s => s.source === 'copy')
  const businessSlotCount = allSlots.filter(s => s.source === 'business').length
  const mediaSlotCount = allSlots.filter(s => s.source === 'media').length

  // Group missing slots by content type for batch generation
  const missingByType = useMemo(() => {
    if (!slotMapping) return {}
    const groups: Record<string, CopySlotDef[]> = {}
    for (const slotId of slotMapping.missing) {
      const slotDef = copySlots.find(s => s.id === slotId)
      if (slotDef) {
        if (!groups[slotDef.contentType]) groups[slotDef.contentType] = []
        groups[slotDef.contentType].push(slotDef)
      }
    }
    return groups
  }, [slotMapping, copySlots])

  const totalSlots = copySlots.length
  const filledCount = slotMapping ? Object.keys(slotMapping.filled).length : 0
  const missingCount = slotMapping ? slotMapping.missing.length : 0

  function handleGenerateForSlot(slot: CopySlotDef) {
    const templateName = selectedTemplate ? TEMPLATE_INFO[selectedTemplate].name : ''
    const prompt = `Generate content specifically for a "${slot.label}" slot in a ${templateName} landing page template. Requirements: ${slot.notes}. Make it compelling, specific, and conversion-focused.`
    onGenerateMore(slot.contentType, prompt)
  }

  function handleGenerateAllMissing() {
    if (!selectedTemplate || !slotMapping) return
    const templateName = TEMPLATE_INFO[selectedTemplate].name
    // Generate the most common missing type with template context
    const types = Object.keys(missingByType)
    if (types.length === 0) return
    // Find the type with the most missing slots
    const primaryType = types.reduce((a, b) => missingByType[a].length > missingByType[b].length ? a : b)
    const slotDescs = missingByType[primaryType].map(s => `"${s.label}" (${s.notes})`).join(', ')
    const prompt = `Generate content for a ${templateName} landing page template. These specific slots need content: ${slotDescs}. Each piece of content should be distinct and optimized for its specific slot position on the page.`
    onGenerateMore(primaryType, prompt)
  }

  return (
    <div className="funnel-section-card">
      <div className="funnel-section-header">
        <h3>Landing Page Copy</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Generate copy tailored to specific landing page templates
        </span>
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <label className="form-label" style={{ marginBottom: 6 }}>Select Template</label>
        <select
          className="form-input"
          value={selectedTemplate}
          onChange={(e) => { setSelectedTemplate(e.target.value as TemplateId | ''); setExpandedSlot(null) }}
          style={{ maxWidth: 400 }}
        >
          <option value="">Choose a template to see its copy slots...</option>
          {templateIds.map(tid => (
            <option key={tid} value={tid}>
              {TEMPLATE_INFO[tid].name} — {TEMPLATE_INFO[tid].bestFor}
            </option>
          ))}
        </select>
      </div>

      {selectedTemplate && slotMapping && (
        <>
          {/* Status bar */}
          <div style={{
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--accent)' }}>{filledCount}</span>
              <span style={{ color: 'var(--text-muted)' }}> / {totalSlots} slots filled</span>
            </div>
            {missingCount > 0 && (
              <span style={{ fontSize: 12, color: '#f59e0b' }}>
                {missingCount} missing
              </span>
            )}
            <div style={{ flex: 1 }} />
            {canEdit && missingCount > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerateAllMissing}
                disabled={!!generatingSection}
              >
                {generatingSection ? 'Generating...' : `Generate Missing Copy`}
              </button>
            )}
          </div>

          {/* Slot list — copy slots only */}
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {copySlots.map(slot => {
              const isFilled = !!slotMapping.filled[slot.id]
              const isMissing = slotMapping.missing.includes(slot.id)
              const options = slotMapping.options[slot.id] || []
              const isExpanded = expandedSlot === slot.id

              return (
                <div
                  key={slot.id}
                  style={{
                    padding: '10px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: isMissing ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: isFilled ? 'var(--accent)' : '#f59e0b',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {slot.label}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                          {slot.contentType}{slot.isArray ? ' (array)' : ''} · {slot.notes}
                        </span>
                      </div>
                      {isFilled && (
                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)', marginTop: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {slotMapping.filled[slot.id].slice(0, 120)}{slotMapping.filled[slot.id].length > 120 ? '...' : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {options.length > 0 && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setExpandedSlot(isExpanded ? null : slot.id)}
                        >
                          {options.length} option{options.length !== 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                      {canEdit && isMissing && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => handleGenerateForSlot(slot)}
                          disabled={!!generatingSection}
                        >
                          {generatingSection === slot.contentType ? '...' : 'Generate'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded options list */}
                  {isExpanded && options.length > 0 && (
                    <div style={{
                      marginTop: 8, marginLeft: 18,
                      borderLeft: '2px solid var(--border)',
                      paddingLeft: 12,
                    }}>
                      {options.map((opt, idx) => (
                        <div
                          key={opt.id || idx}
                          style={{
                            padding: '6px 0',
                            fontSize: 12,
                            color: slotMapping.filled[slot.id] === opt.text ? 'var(--accent)' : 'var(--text-secondary)',
                            borderBottom: idx < options.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          {slotMapping.filled[slot.id] === opt.text && (
                            <span style={{ marginRight: 6 }}>✓</span>
                          )}
                          {opt.text.slice(0, 200)}{opt.text.length > 200 ? '...' : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Business assets note */}
          {(businessSlotCount > 0 || mediaSlotCount > 0) && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}>
              {businessSlotCount > 0 && (
                <span>{businessSlotCount} business asset slot{businessSlotCount !== 1 ? 's' : ''} (testimonials, ratings, badges, disclaimers) — enter in Business Overview or Landing Page builder</span>
              )}
              {businessSlotCount > 0 && mediaSlotCount > 0 && <span> · </span>}
              {mediaSlotCount > 0 && (
                <span>{mediaSlotCount} media slot{mediaSlotCount !== 1 ? 's' : ''} (video URLs) — add in Landing Page builder</span>
              )}
            </div>
          )}
        </>
      )}

      {!selectedTemplate && (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Select a template above to see which copy slots are filled and which need content generated.
          </div>
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
    qaReviews,
    refreshCopyComponents,
    refreshFunnelInstances,
    refreshQAReviews,
    setLoading,
    loading,
    canEdit,
    isClientRole,
    publishedPages,
  } = useAppStore()

  // Client role users should not access this page
  if (isClientRole) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2 style={{ fontSize: 20, color: 'var(--text-primary)', marginBottom: 8 }}>Access Restricted</h2>
        <p>This section is managed by the agency team.</p>
      </div>
    )
  }

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
  const [runningQA, setRunningQA] = useState(false)
  const [showQAPanel, setShowQAPanel] = useState(false)

  const approvedAvatars = avatars
    .filter((a) => a.status === 'approved')
    .sort((a, b) => (a.priority || 99) - (b.priority || 99))
  const approvedOffers = offers.filter((o) => o.status === 'approved')

  // Set defaults — pick highest-priority avatar
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

  // Avatar campaign info for selector (instance count + total components)
  const avatarCampaignInfo = useCallback(
    (avId: string) => {
      const instances = funnelInstances.filter(f => f.avatar_id === avId && f.status === 'active')
      const totalComponents = instances.reduce((sum, fi) => {
        return sum + copyComponents.filter(c => c.funnel_instance_id === fi.id && c.status !== 'denied').length
      }, 0)
      return { instanceCount: instances.length, totalComponents }
    },
    [funnelInstances, copyComponents]
  )

  // ── QA Review data ──────────────────────────────────────────────────────

  // Latest QA reviews for current funnel instance
  const latestCopywriterReview = useMemo(() => {
    if (!currentInstance) return null
    return qaReviews.find(r => r.funnel_instance_id === currentInstance.id && r.review_type === 'copywriter' && r.status === 'completed') || null
  }, [qaReviews, currentInstance])

  const latestComplianceReview = useMemo(() => {
    if (!currentInstance) return null
    return qaReviews.find(r => r.funnel_instance_id === currentInstance.id && r.review_type === 'compliance' && r.status === 'completed') || null
  }, [qaReviews, currentInstance])

  // Build lookup map: component_id → QA reviews
  const qaComponentMap = useMemo(() => {
    const map = new Map<string, { copywriter?: QAComponentReview; compliance?: QAComponentReview }>()
    if (latestCopywriterReview) {
      for (const r of latestCopywriterReview.component_reviews) {
        const entry = map.get(r.component_id) || {}
        entry.copywriter = r
        map.set(r.component_id, entry)
      }
    }
    if (latestComplianceReview) {
      for (const r of latestComplianceReview.component_reviews) {
        const entry = map.get(r.component_id) || {}
        entry.compliance = r
        map.set(r.component_id, entry)
      }
    }
    return map
  }, [latestCopywriterReview, latestComplianceReview])

  async function handleRunQAReview() {
    if (!currentInstance || !client) return
    setRunningQA(true)
    setShowQAPanel(true)
    try {
      // Run both reviews in parallel
      const [copyResult, complianceResult] = await Promise.allSettled([
        runQACopywriterReview(currentInstance.id),
        runQAComplianceReview(currentInstance.id),
      ])
      await refreshQAReviews(client.id)
      const successCount = [copyResult, complianceResult].filter(r => r.status === 'fulfilled').length
      showToast(`QA Review complete! ${successCount}/2 agents finished successfully.`)
    } catch (err) {
      showToast(`QA Review failed: ${(err as Error).message}`)
    } finally {
      setRunningQA(false)
    }
  }

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

  async function handleGenerateMore(sectionType: string, templatePrompt?: string) {
    if (!currentInstance || !client) return
    setGeneratingSection(sectionType)
    try {
      await generateMore(currentInstance.id, sectionType, {
        userPrompt: templatePrompt,
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

  async function handleEdit(componentId: string, newText: string) {
    if (!client) return
    await supabase.from('copy_components').update({
      text: newText,
      character_count: newText.length,
    }).eq('id', componentId)
    await refreshCopyComponents(client.id)
    showToast('Copy updated')
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
            <h1 className="page-title">Copy</h1>
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

  // Selected names for display
  const selectedAvatar = approvedAvatars.find(a => a.id === avatarId)
  const selectedOffer = approvedOffers.find(o => o.id === offerId)

  // ── Render: Main page ────────────────────────────────────────────────
  return (
    <div className="funnel-page">
      {/* ── Compact selector bar ── */}
      <div className="funnel-selector-bar">
        <div className="funnel-selector-col">
          <label className="funnel-selector-label">Avatar (by priority)</label>
          <select
            className="form-input funnel-avatar-select"
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
          >
            {approvedAvatars.map((a, idx) => {
              const info = avatarCampaignInfo(a.id)
              const tag = a.priority === 1 ? '★' : a.priority === 2 ? '▲' : ''
              return (
                <option key={a.id} value={a.id}>
                  {idx + 1}. {tag}{tag ? ' ' : ''}{a.name} — {a.avatar_type}{info.totalComponents > 0 ? ` (${info.totalComponents} components)` : ''}
                </option>
              )
            })}
          </select>
        </div>
        <div className="funnel-selector-col">
          <label className="funnel-selector-label">Offer</label>
          <select
            className="form-input"
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
          >
            {approvedOffers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}{o.offer_type ? ` (${o.offer_type})` : ''}
              </option>
            ))}
          </select>
        </div>
        {!currentInstance && canEdit && !generating ? (
          <button
            className="btn btn-primary funnel-selector-btn"
            onClick={handleGenerate}
            disabled={loading || !avatarId || !offerId}
          >
            &#9889; Generate Campaign
          </button>
        ) : currentInstance ? (
          <div className="funnel-selector-status">
            <span className="funnel-selector-check">&#10003;</span>
            <span>{instanceComponents.length} components</span>
          </div>
        ) : null}
      </div>

      {/* Avatar context strip — shows key info about the selected avatar */}
      {selectedAvatar && (
        <div className="funnel-avatar-context">
          <span className="funnel-avatar-context-name">{selectedAvatar.name}</span>
          <span className="funnel-avatar-context-sep">·</span>
          <span className="funnel-avatar-context-type">{selectedAvatar.avatar_type}</span>
          {(selectedAvatar.recommended_angles as string[] || []).length > 0 && (
            <>
              <span className="funnel-avatar-context-sep">·</span>
              <span className="funnel-avatar-context-angles">
                {(selectedAvatar.recommended_angles as string[] || []).slice(0, 4).map(slug => (
                  <AngleBadge key={slug} slug={slug} />
                ))}
              </span>
            </>
          )}
          {selectedOffer && (
            <>
              <span className="funnel-avatar-context-sep">·</span>
              <span className="funnel-avatar-context-offer">Offer: {selectedOffer.name}</span>
            </>
          )}
        </div>
      )}

      {/* Landing page thumbnails for selected avatar */}
      {avatarId && (() => {
        const avatarPages = publishedPages.filter(p => p.avatar_id === avatarId)
        if (avatarPages.length === 0) return null
        const HUB_URL = 'https://hub.logicalboost.com'
        return (
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-card)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            marginBottom: 12,
          }}>
            <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11, marginBottom: 8 }}>
              Landing Pages
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {avatarPages.map(page => {
                const pageUrl = `${HUB_URL}/p/${page.client_slug}/${page.slug}`
                const offerMatch = offers.find(o => o.id === page.offer_id)
                const iframeW = 390
                const thumbW = 110
                const thumbH = 140
                const iframeH = Math.round((thumbH / thumbW) * iframeW)
                const scale = thumbW / iframeW
                return (
                  <a
                    key={page.id}
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`/${page.slug}${offerMatch ? ` — ${offerMatch.name}` : ''}`}
                    style={{
                      display: 'block', width: thumbW, textDecoration: 'none',
                      borderRadius: 6, overflow: 'hidden',
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.15s, transform 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{
                      width: thumbW, height: thumbH, overflow: 'hidden',
                      position: 'relative', background: '#0d1117',
                    }}>
                      <iframe
                        src={pageUrl}
                        title="Page preview"
                        loading="lazy"
                        sandbox="allow-same-origin allow-scripts"
                        tabIndex={-1}
                        style={{
                          width: iframeW, height: iframeH,
                          transform: `scale(${scale})`,
                          transformOrigin: 'top left',
                          border: 'none',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>
                    <div style={{
                      padding: '4px 6px', background: 'var(--bg-secondary)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        /{page.slug}
                      </div>
                      {offerMatch && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {offerMatch.name}
                        </div>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )
      })()}

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

          {/* ── QA Review Panel ──────────────────────────────────── */}
          {canEdit && instanceComponents.length > 0 && (
            <div className="qa-review-section">
              <div className="qa-review-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>QA Review</h3>
                  {latestCopywriterReview && (
                    <span
                      className="qa-score-badge"
                      style={{
                        background: (latestCopywriterReview.overall_score || 0) >= 80 ? '#10b981' : (latestCopywriterReview.overall_score || 0) >= 60 ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {latestCopywriterReview.overall_score}/100
                    </span>
                  )}
                  {latestComplianceReview && (
                    <span
                      className="qa-compliance-badge"
                      style={{
                        background: (latestComplianceReview.flagged_count || 0) === 0 ? '#10b981' : (latestComplianceReview.flagged_count || 0) <= 5 ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {(() => {
                        const meta = latestComplianceReview.metadata as Record<string, number> | null
                        return meta ? `${meta.passing || 0}/${meta.total_components || 0} passing` : `${latestComplianceReview.flagged_count} flagged`
                      })()}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(latestCopywriterReview || latestComplianceReview) && (
                    <button
                      className="btn btn-sm"
                      onClick={() => setShowQAPanel(!showQAPanel)}
                      style={{ fontSize: 12 }}
                    >
                      {showQAPanel ? 'Hide Details' : 'Show Details'}
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleRunQAReview}
                    disabled={runningQA || generating}
                    style={{ fontSize: 12 }}
                  >
                    {runningQA ? (
                      <><span className="generating-spinner" style={{ width: 14, height: 14, marginRight: 6 }} /> Running QA...</>
                    ) : latestCopywriterReview ? (
                      <>&#128269; Re-run QA Review</>
                    ) : (
                      <>&#128269; Run QA Review</>
                    )}
                  </button>
                </div>
              </div>

              {showQAPanel && (latestCopywriterReview || latestComplianceReview || runningQA) && (
                <div className="qa-review-details">
                  {runningQA && !latestCopywriterReview && (
                    <div className="qa-running-message">
                      <div className="generating-spinner" style={{ width: 20, height: 20 }} />
                      <span>Running copywriter quality + compliance review on {instanceComponents.length} components... This takes 30-60 seconds.</span>
                    </div>
                  )}

                  {/* Copywriter Review */}
                  {latestCopywriterReview && (
                    <div className="qa-review-block">
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text-secondary)' }}>&#9997; Copywriter Review</h4>
                      <p style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {latestCopywriterReview.overall_assessment}
                      </p>
                      {(() => {
                        const meta = latestCopywriterReview.metadata as Record<string, unknown> | null
                        const issues = meta?.variety_issues as string[] | undefined
                        if (!issues || issues.length === 0) return null
                        return (
                          <div style={{ marginBottom: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>Variety Issues:</span>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                              {issues.map((issue: string, i: number) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      })()}
                      {/* Per-component weak items */}
                      {latestCopywriterReview.component_reviews.filter(r => (r.score || 100) < 60).length > 0 && (
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>Weak Items ({latestCopywriterReview.component_reviews.filter(r => (r.score || 100) < 60).length}):</span>
                          <div className="qa-flagged-list">
                            {latestCopywriterReview.component_reviews.filter(r => (r.score || 100) < 60).slice(0, 10).map((r, i) => {
                              const comp = instanceComponents.find(c => c.id === r.component_id)
                              return (
                                <div key={i} className="qa-flagged-item" style={{ flexWrap: 'wrap' }}>
                                  <span className="qa-flagged-type">{r.type}</span>
                                  <span className="qa-flagged-score" style={{ color: '#ef4444' }}>{r.score}/100</span>
                                  <span className="qa-flagged-text">{(r as QAComponentReview).recommendation || ''}</span>
                                  {comp && (
                                    <div style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                      &ldquo;{comp.text.substring(0, 150)}{comp.text.length > 150 ? '...' : ''}&rdquo;
                                    </div>
                                  )}
                                  {canEdit && comp && (
                                    <div style={{ width: '100%', display: 'flex', gap: 6, marginTop: 4 }}>
                                      <button
                                        className="btn btn-sm"
                                        style={{ fontSize: 10, padding: '2px 8px' }}
                                        onClick={() => {
                                          setShowQAPanel(false)
                                          // Find the tab for this component type and scroll to it
                                          const tabKey = comp.type
                                          setActiveTab(tabKey)
                                          // Small delay then highlight
                                          setTimeout(() => {
                                            const el = document.getElementById(`copy-${comp.id}`)
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }, 100)
                                        }}
                                      >
                                        Find &amp; Edit
                                      </button>
                                      <button
                                        className="btn btn-sm"
                                        style={{ fontSize: 10, padding: '2px 8px', color: '#ef4444', borderColor: '#ef4444' }}
                                        onClick={() => handleDeny(comp.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compliance Review */}
                  {latestComplianceReview && (
                    <div className="qa-review-block">
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text-secondary)' }}>&#9888; Compliance Review</h4>
                      <p style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {latestComplianceReview.overall_assessment}
                      </p>
                      {(() => {
                        const meta = latestComplianceReview.metadata as Record<string, unknown> | null
                        const sev = meta?.severity_breakdown as Record<string, number> | undefined
                        if (!sev) return null
                        return (
                          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12 }}>
                            <span style={{ color: '#ef4444' }}>&#9679; {sev.error || 0} errors</span>
                            <span style={{ color: '#f59e0b' }}>&#9679; {sev.warning || 0} warnings</span>
                            <span style={{ color: '#3b82f6' }}>&#9679; {sev.info || 0} info</span>
                          </div>
                        )
                      })()}
                      {/* Flagged items */}
                      {latestComplianceReview.component_reviews.length > 0 && (
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>
                            Flagged Items ({latestComplianceReview.component_reviews.length}):
                          </span>
                          <div className="qa-flagged-list">
                            {latestComplianceReview.component_reviews.slice(0, 15).map((r, i) => {
                              const comp = instanceComponents.find(c => c.id === r.component_id)
                              return (
                                <div key={i} className="qa-flagged-item" style={{ flexWrap: 'wrap' }}>
                                  <span className="qa-flagged-type">{r.type}</span>
                                  {r.violations && r.violations.length > 0 && (
                                    <span
                                      className="qa-flagged-severity"
                                      style={{
                                        color: r.violations[0].severity === 'error' ? '#ef4444' : r.violations[0].severity === 'warning' ? '#f59e0b' : '#3b82f6'
                                      }}
                                    >
                                      {r.violations[0].severity}
                                    </span>
                                  )}
                                  <span className="qa-flagged-text">
                                    {r.violations?.[0]?.detail || r.suggestions?.[0] || ''}
                                  </span>
                                  {comp && (
                                    <div style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                      &ldquo;{comp.text.substring(0, 150)}{comp.text.length > 150 ? '...' : ''}&rdquo;
                                    </div>
                                  )}
                                  {canEdit && comp && (
                                    <div style={{ width: '100%', display: 'flex', gap: 6, marginTop: 4 }}>
                                      <button
                                        className="btn btn-sm"
                                        style={{ fontSize: 10, padding: '2px 8px' }}
                                        onClick={() => {
                                          setShowQAPanel(false)
                                          setActiveTab(comp.type)
                                          setTimeout(() => {
                                            const el = document.getElementById(`copy-${comp.id}`)
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          }, 100)
                                        }}
                                      >
                                        Find &amp; Edit
                                      </button>
                                      <button
                                        className="btn btn-sm"
                                        style={{ fontSize: 10, padding: '2px 8px', color: '#ef4444', borderColor: '#ef4444' }}
                                        onClick={() => handleDeny(comp.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                    Prompts for both QA agents can be customized in Settings &gt; Prompts
                  </div>
                </div>
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
                    <div key={item.id} id={`copy-${item.id}`}>
                      <CopyRow
                        item={item}
                        onDeny={handleDeny}
                        onEdit={canEdit ? handleEdit : undefined}
                        selected={selectedIds.has(item.id)}
                        onToggleSelect={toggleSelect}
                        selectionMode={selectionMode}
                      />
                    </div>
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

          {/* ── Landing Page Copy ─────────────────────────────────── */}
          <TemplateCopySection
            instanceComponents={instanceComponents}
            onGenerateMore={handleGenerateMore}
            generatingSection={generatingSection}
            canEdit={canEdit}
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
        <div className="empty-state" style={{ padding: 60 }}>
          <div className="empty-state-icon">&#9889;</div>
          <div className="empty-state-text">No campaign generated for this Avatar + Offer</div>
          <div className="empty-state-sub" style={{ maxWidth: 500 }}>
            {canEdit
              ? 'Select your target avatar and offer above, then click "Generate Campaign" to create ~130-180 copy components across multiple marketing angles.'
              : 'No campaign has been generated for this combination yet.'}
          </div>
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
