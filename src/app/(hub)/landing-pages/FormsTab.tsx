'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import type { Form, FormField, FormStep, FormWebhook, FormSettingsDb } from '@/types/database'

// ============================================================
// Types
// ============================================================
interface Client {
  id: string
  name: string
}

interface FormsTabProps {
  client: Client | null
  forms: Form[]
  formWebhooks: FormWebhook[]
  refreshForms: (clientId: string) => Promise<void>
  refreshFormWebhooks: (clientId: string) => Promise<void>
  canEdit: boolean
}

// ============================================================
// Shared inline style helpers (matching page.tsx patterns)
// ============================================================
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: 20,
  ...extra,
})

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  display: 'block',
}

// Field type presets for quick add
const FIELD_PRESETS = [
  { type: 'text', name: 'name', label: 'Name', icon: 'Aa' },
  { type: 'email', name: 'email', label: 'Email', icon: '@' },
  { type: 'phone', name: 'phone', label: 'Phone', icon: '#' },
  { type: 'textarea', name: 'message', label: 'Message', icon: '...' },
  { type: 'select', name: 'service', label: 'Dropdown', icon: 'v' },
  { type: 'radio', name: 'choice', label: 'Radio Group', icon: 'O' },
  { type: 'number', name: 'amount', label: 'Number', icon: '123' },
  { type: 'checkbox', name: 'consent', label: 'Checkbox', icon: '[]' },
] as const

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: '#3b82f6',
  email: '#8b5cf6',
  phone: '#06b6d4',
  textarea: '#f59e0b',
  select: '#ec4899',
  radio: '#10b981',
  number: '#f97316',
  checkbox: '#6366f1',
  hidden: '#64748b',
}

function generateId() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ============================================================
// Main FormsTab Component
// ============================================================
export default function FormsTab({ client, forms, formWebhooks, refreshForms, refreshFormWebhooks, canEdit }: FormsTabProps) {
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editingFormId, setEditingFormId] = useState<string | null>(null) // null = creating new

  // Editor state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'standard' | 'multi_step'>('standard')
  const [fields, setFields] = useState<FormField[]>([])
  const [steps, setSteps] = useState<FormStep[]>([])
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [settings, setSettings] = useState<FormSettingsDb>({})
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Expanded field (for editing options on radio/select)
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)

  // ── Open editor with blank form ──
  const handleCreateNew = useCallback(() => {
    setEditingFormId(null)
    setFormName('')
    setFormType('standard')
    setFields([
      { id: generateId(), type: 'text', name: 'first_name', label: 'First Name', placeholder: 'John', required: true, width: 'half' },
      { id: generateId(), type: 'text', name: 'last_name', label: 'Last Name', placeholder: 'Doe', required: true, width: 'half' },
      { id: generateId(), type: 'email', name: 'email', label: 'Email', placeholder: 'john@example.com', required: true, width: 'full' },
      { id: generateId(), type: 'phone', name: 'phone', label: 'Phone', placeholder: '(555) 123-4567', required: false, width: 'full' },
    ])
    setSteps([])
    setActiveStepIndex(0)
    setSettings({ submit_button_text: 'Get Started', success_message: "Thanks! We'll be in touch shortly." })
    setWebhookUrl('')
    setExpandedFieldId(null)
    setView('editor')
  }, [])

  // ── Open editor with existing form ──
  const handleEditForm = useCallback((form: Form) => {
    setEditingFormId(form.id)
    setFormName(form.name)
    setFormType(form.form_type)
    setFields(form.fields || [])
    // Ensure steps have IDs
    const stepsWithIds = (form.steps || []).map(s => ({
      ...s,
      id: (s as FormStep).id || generateId(),
    }))
    setSteps(stepsWithIds)
    setActiveStepIndex(0)
    setSettings(form.settings || {})
    // Load webhook
    const wh = formWebhooks.find(w => w.form_id === form.id)
    setWebhookUrl(wh?.webhook_url || '')
    setExpandedFieldId(null)
    setView('editor')
  }, [formWebhooks])

  // ── Delete form ──
  const handleDeleteForm = useCallback(async (formId: string) => {
    if (!client) return
    const { error } = await supabase.from('forms').delete().eq('id', formId)
    if (error) {
      showToast('Failed to delete: ' + error.message)
    } else {
      showToast('Form deleted')
      refreshForms(client.id)
    }
    setDeleteConfirmId(null)
  }, [client, refreshForms])

  // ── Save form (create or update) ──
  const handleSave = useCallback(async () => {
    if (!client) return
    if (!formName.trim()) {
      showToast('Please enter a form name')
      return
    }
    if (fields.length === 0) {
      showToast('Add at least one field')
      return
    }

    setSaving(true)
    try {
      const payload = {
        client_id: client.id,
        name: formName.trim(),
        form_type: formType,
        fields,
        steps: formType === 'multi_step' && steps.length > 0 ? steps : null,
        settings,
      }

      if (editingFormId) {
        // Update existing
        const { error } = await supabase.from('forms').update(payload).eq('id', editingFormId)
        if (error) throw error

        // Update webhook
        const existingWh = formWebhooks.find(w => w.form_id === editingFormId)
        if (webhookUrl.trim()) {
          if (existingWh) {
            await supabase.from('form_webhooks').update({ webhook_url: webhookUrl.trim() }).eq('id', existingWh.id)
          } else {
            await supabase.from('form_webhooks').insert({ client_id: client.id, form_id: editingFormId, webhook_url: webhookUrl.trim(), name: 'Primary Webhook' })
          }
        } else if (existingWh) {
          await supabase.from('form_webhooks').delete().eq('id', existingWh.id)
        }
        showToast('Form updated!')
      } else {
        // Create new
        const { data: newForm, error } = await supabase.from('forms').insert(payload).select().single()
        if (error) throw error
        if (newForm && webhookUrl.trim()) {
          await supabase.from('form_webhooks').insert({ client_id: client.id, form_id: newForm.id, webhook_url: webhookUrl.trim(), name: 'Primary Webhook' })
        }
        showToast('Form created! You can now select it in the Builder.')
      }

      await refreshForms(client.id)
      await refreshFormWebhooks(client.id)
      setView('list')
    } catch (err) {
      showToast('Error: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }, [client, editingFormId, formName, formType, fields, steps, settings, webhookUrl, formWebhooks, refreshForms, refreshFormWebhooks])

  // ── Add a field ──
  const addField = useCallback((type: string, label: string, name: string) => {
    const id = generateId()
    const newField: FormField = {
      id,
      type: type as FormField['type'],
      name: name + (fields.some(f => f.name === name) ? `_${fields.length}` : ''),
      label,
      placeholder: type === 'textarea' ? 'Tell us more...' : '',
      required: type === 'email',
      width: (type === 'textarea' || type === 'checkbox' || type === 'radio') ? 'full' : 'half',
      ...(type === 'select' || type === 'radio' ? {
        options: [
          { value: 'option_1', label: 'Option 1' },
          { value: 'option_2', label: 'Option 2' },
          { value: 'option_3', label: 'Option 3' },
        ]
      } : {}),
    }
    setFields(prev => [...prev, newField])

    // If multi-step and we have steps, add to active step
    if (formType === 'multi_step' && steps.length > 0) {
      setSteps(prev => prev.map((s, i) =>
        i === activeStepIndex ? { ...s, field_ids: [...s.field_ids, id] } : s
      ))
    }

    // Auto-expand radio/select fields for option editing
    if (type === 'radio' || type === 'select') {
      setExpandedFieldId(id)
    }
  }, [fields, formType, steps, activeStepIndex])

  // ── Switch to multi-step: auto-create step 1 with all fields ──
  const switchToMultiStep = useCallback(() => {
    setFormType('multi_step')
    if (steps.length === 0) {
      setSteps([{
        id: generateId(),
        name: 'Step 1',
        field_ids: fields.map(f => f.id),
      }])
      setActiveStepIndex(0)
    }
  }, [fields, steps])

  const switchToStandard = useCallback(() => {
    setFormType('standard')
  }, [])

  // ── Step management ──
  const addStep = useCallback(() => {
    const newStep: FormStep = {
      id: generateId(),
      name: `Step ${steps.length + 1}`,
      field_ids: [],
    }
    setSteps(prev => [...prev, newStep])
    setActiveStepIndex(steps.length)
  }, [steps])

  const removeStep = useCallback((stepIndex: number) => {
    if (steps.length <= 1) {
      showToast('Must have at least one step')
      return
    }
    setSteps(prev => prev.filter((_, i) => i !== stepIndex))
    setActiveStepIndex(prev => Math.min(prev, steps.length - 2))
  }, [steps])

  const renameStep = useCallback((stepIndex: number, newName: string) => {
    setSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, name: newName } : s))
  }, [])

  // ── Move field to a different step ──
  const moveFieldToStep = useCallback((fieldId: string, targetStepIndex: number) => {
    setSteps(prev => prev.map((s, i) => ({
      ...s,
      field_ids: i === targetStepIndex
        ? [...s.field_ids.filter(fid => fid !== fieldId), fieldId]
        : s.field_ids.filter(fid => fid !== fieldId),
    })))
  }, [])

  // ── Get fields for current step (multi-step) or all fields (standard) ──
  const getVisibleFields = useCallback((): FormField[] => {
    if (formType === 'standard' || steps.length === 0) return fields
    const step = steps[activeStepIndex]
    if (!step) return []
    return step.field_ids.map(fid => fields.find(f => f.id === fid)).filter((f): f is FormField => f !== undefined)
  }, [formType, fields, steps, activeStepIndex])

  // ── Get unassigned fields (multi-step only) ──
  const getUnassignedFields = useCallback((): FormField[] => {
    if (formType !== 'multi_step' || steps.length === 0) return []
    const assignedIds = new Set(steps.flatMap(s => s.field_ids))
    return fields.filter(f => !assignedIds.has(f.id))
  }, [formType, fields, steps])

  if (!client) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Select a client to manage forms.</div>
  }

  // ════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Forms</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Build lead capture forms with multi-step support. Assign them to landing pages in the Builder.
            </p>
          </div>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={handleCreateNew}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              + New Form
            </button>
          )}
        </div>

        {forms.length === 0 ? (
          <div style={card({ textAlign: 'center', padding: 48 })}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#128203;</div>
            <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Forms Yet</h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Create your first form to start capturing leads on your landing pages.
            </p>
            {canEdit && (
              <button
                className="btn btn-primary"
                onClick={handleCreateNew}
                style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Create First Form
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {forms.map(form => {
              const wh = formWebhooks.find(w => w.form_id === form.id)
              return (
                <div key={form.id} style={card({ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' })}>
                  {/* Type badge */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: form.form_type === 'multi_step' ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {form.form_type === 'multi_step' ? '\u{1F4CB}' : '\u{1F4DD}'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{form.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: form.form_type === 'multi_step' ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
                        color: form.form_type === 'multi_step' ? '#10b981' : '#3b82f6',
                      }}>
                        {form.form_type === 'multi_step' ? `Multi-Step (${form.steps?.length || 0} steps)` : 'Standard'}
                      </span>
                      <span>{form.fields.length} field{form.fields.length !== 1 ? 's' : ''}</span>
                      {wh && <span style={{ color: 'var(--accent)' }}>Webhook active</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {canEdit && (
                      <button
                        onClick={() => handleEditForm(form)}
                        style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    )}
                    {canEdit && deleteConfirmId !== form.id && (
                      <button
                        onClick={() => setDeleteConfirmId(form.id)}
                        style={{ padding: '6px 14px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    )}
                    {deleteConfirmId === form.id && (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                          onClick={() => handleDeleteForm(form.id)}
                          style={{ padding: '6px 12px', borderRadius: 6, background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >Yes, Delete</button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
                        >Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // EDITOR VIEW
  // ════════════════════════════════════════════════════════════
  const visibleFields = getVisibleFields()
  const unassignedFields = getUnassignedFields()

  return (
    <div>
      {/* Editor Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setView('list')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '4px 0' }}
          >
            &larr; Back to Forms
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{editingFormId ? 'Edit Form' : 'New Form'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setView('list')}
            style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 6, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : editingFormId ? 'Update Form' : 'Create Form'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Form Name + Type ── */}
        <div style={card()}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Form Name</label>
              <input
                className="form-input"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Lead Capture, Debt Assessment, Quote Request"
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Form Type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={switchToStandard}
                  style={{
                    padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: formType === 'standard' ? 'var(--accent)' : 'var(--bg-input)',
                    color: formType === 'standard' ? '#fff' : 'var(--text-secondary)',
                    border: formType === 'standard' ? 'none' : '1px solid var(--border)',
                  }}
                >Standard</button>
                <button
                  onClick={switchToMultiStep}
                  style={{
                    padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: formType === 'multi_step' ? 'var(--accent)' : 'var(--bg-input)',
                    color: formType === 'multi_step' ? '#fff' : 'var(--text-secondary)',
                    border: formType === 'multi_step' ? 'none' : '1px solid var(--border)',
                  }}
                >Multi-Step</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Multi-Step: Step Tabs ── */}
        {formType === 'multi_step' && (
          <div style={card({ padding: 0 })}>
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  onClick={() => setActiveStepIndex(i)}
                  style={{
                    padding: '12px 20px',
                    cursor: 'pointer',
                    borderBottom: i === activeStepIndex ? '2px solid var(--accent)' : '2px solid transparent',
                    color: i === activeStepIndex ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: i === activeStepIndex ? 600 : 400,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    whiteSpace: 'nowrap',
                    marginBottom: -1,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: i === activeStepIndex ? 'var(--accent)' : 'var(--bg-input)',
                    color: i === activeStepIndex ? '#fff' : 'var(--text-muted)',
                  }}>{i + 1}</span>
                  {step.name}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({step.field_ids.length})</span>
                </div>
              ))}
              <button
                onClick={addStep}
                style={{ padding: '12px 16px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                + Add Step
              </button>
            </div>

            {/* Active step controls */}
            {steps[activeStepIndex] && (
              <div style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Step Name:</label>
                <input
                  className="form-input"
                  value={steps[activeStepIndex].name}
                  onChange={e => renameStep(activeStepIndex, e.target.value)}
                  style={{ maxWidth: 250, fontSize: 13, padding: '6px 10px' }}
                />
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(activeStepIndex)}
                    style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remove Step
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Quick Add ── */}
        <div style={card()}>
          <label style={labelStyle}>Quick Add Field</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FIELD_PRESETS.map(preset => (
              <button
                key={preset.type}
                onClick={() => addField(preset.type, preset.label === 'Dropdown' ? 'Service Needed' : preset.label === 'Radio Group' ? 'Your Choice' : preset.label === 'Checkbox' ? 'I agree to be contacted' : preset.label, preset.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 6,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <span style={{ color: FIELD_TYPE_COLORS[preset.type] || 'var(--text-muted)', fontWeight: 700, fontSize: 11 }}>{preset.icon}</span>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Field List ── */}
        <div style={card()}>
          <label style={labelStyle}>
            {formType === 'multi_step' && steps[activeStepIndex]
              ? `${steps[activeStepIndex].name} Fields (${visibleFields.length})`
              : `Fields (${fields.length})`
            }
          </label>

          {visibleFields.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              {formType === 'multi_step' ? 'No fields in this step. Use Quick Add above or move fields from other steps.' : 'No fields yet. Use Quick Add above to get started.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visibleFields.map((field, idx) => (
                <div key={field.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 8,
                    background: expandedFieldId === field.id ? 'var(--bg-input)' : 'var(--bg-secondary)',
                    border: expandedFieldId === field.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'border-color 0.15s',
                  }}>
                    {/* Reorder arrows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          if (formType === 'multi_step' && steps[activeStepIndex]) {
                            setSteps(prev => prev.map((s, si) => {
                              if (si !== activeStepIndex) return s
                              const fids = [...s.field_ids]
                              const fi = fids.indexOf(field.id)
                              if (fi > 0) { [fids[fi - 1], fids[fi]] = [fids[fi], fids[fi - 1]] }
                              return { ...s, field_ids: fids }
                            }))
                          } else {
                            const arr = [...fields]; const fi = arr.findIndex(f => f.id === field.id)
                            if (fi > 0) { [arr[fi - 1], arr[fi]] = [arr[fi], arr[fi - 1]]; setFields(arr) }
                          }
                        }}
                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--border)' : 'var(--text-muted)', fontSize: 10, padding: 0, lineHeight: 1 }}
                      >&#9650;</button>
                      <button
                        disabled={idx === visibleFields.length - 1}
                        onClick={() => {
                          if (formType === 'multi_step' && steps[activeStepIndex]) {
                            setSteps(prev => prev.map((s, si) => {
                              if (si !== activeStepIndex) return s
                              const fids = [...s.field_ids]
                              const fi = fids.indexOf(field.id)
                              if (fi >= 0 && fi < fids.length - 1) { [fids[fi], fids[fi + 1]] = [fids[fi + 1], fids[fi]] }
                              return { ...s, field_ids: fids }
                            }))
                          } else {
                            const arr = [...fields]; const fi = arr.findIndex(f => f.id === field.id)
                            if (fi >= 0 && fi < arr.length - 1) { [arr[fi], arr[fi + 1]] = [arr[fi + 1], arr[fi]]; setFields(arr) }
                          }
                        }}
                        style={{ background: 'none', border: 'none', cursor: idx === visibleFields.length - 1 ? 'default' : 'pointer', color: idx === visibleFields.length - 1 ? 'var(--border)' : 'var(--text-muted)', fontSize: 10, padding: 0, lineHeight: 1 }}
                      >&#9660;</button>
                    </div>

                    {/* Type badge */}
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 4,
                      background: `${FIELD_TYPE_COLORS[field.type] || '#64748b'}20`,
                      color: FIELD_TYPE_COLORS[field.type] || '#64748b',
                      textTransform: 'uppercase', fontWeight: 700, flexShrink: 0, letterSpacing: 0.3,
                    }}>{field.type}</span>

                    {/* Label (editable) */}
                    <input
                      value={field.label}
                      onChange={e => setFields(prev => prev.map(f => f.id === field.id ? { ...f, label: e.target.value, name: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') } : f))}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, minWidth: 80 }}
                    />

                    {/* Expand button for radio/select */}
                    {(field.type === 'radio' || field.type === 'select') && (
                      <button
                        onClick={() => setExpandedFieldId(expandedFieldId === field.id ? null : field.id)}
                        title="Edit options"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: expandedFieldId === field.id ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, padding: '2px 6px' }}
                      >
                        {expandedFieldId === field.id ? '&#9660;' : '&#9654;'} Options
                      </button>
                    )}

                    {/* Move to step (multi-step only) */}
                    {formType === 'multi_step' && steps.length > 1 && (
                      <select
                        value={activeStepIndex}
                        onChange={e => moveFieldToStep(field.id, parseInt(e.target.value))}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Move to step"
                      >
                        {steps.map((s, si) => (
                          <option key={s.id} value={si}>{s.name}</option>
                        ))}
                      </select>
                    )}

                    {/* Width toggle */}
                    <button
                      onClick={() => setFields(prev => prev.map(f => f.id === field.id ? { ...f, width: f.width === 'half' ? 'full' : 'half' } : f))}
                      title={field.width === 'half' ? 'Half width' : 'Full width'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '2px 4px' }}
                    >{field.width === 'half' ? '\u00BD' : '\u25AC'}</button>

                    {/* Required toggle */}
                    <button
                      onClick={() => setFields(prev => prev.map(f => f.id === field.id ? { ...f, required: !f.required } : f))}
                      style={{
                        background: field.required ? 'rgba(239,68,68,0.12)' : 'transparent',
                        border: field.required ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
                        borderRadius: 4, cursor: 'pointer',
                        color: field.required ? '#ef4444' : 'var(--text-muted)',
                        fontSize: 10, padding: '2px 7px', fontWeight: 700,
                      }}
                    >{field.required ? 'REQ' : 'OPT'}</button>

                    {/* Remove */}
                    <button
                      onClick={() => {
                        setFields(prev => prev.filter(f => f.id !== field.id))
                        if (formType === 'multi_step') {
                          setSteps(prev => prev.map(s => ({ ...s, field_ids: s.field_ids.filter(fid => fid !== field.id) })))
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >&#10005;</button>
                  </div>

                  {/* Expanded: Options editor for radio/select */}
                  {expandedFieldId === field.id && (field.type === 'radio' || field.type === 'select') && (
                    <div style={{
                      margin: '4px 0 4px 38px',
                      padding: 14, borderRadius: 8,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                    }}>
                      <label style={{ ...labelStyle, marginBottom: 10 }}>
                        {field.type === 'radio' ? 'Radio Options' : 'Dropdown Options'}
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(field.options || []).map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 20, textAlign: 'center', flexShrink: 0 }}>
                              {field.type === 'radio' ? '\u25CB' : `${oi + 1}.`}
                            </span>
                            <input
                              className="form-input"
                              value={opt.label}
                              onChange={e => {
                                const newLabel = e.target.value
                                const newValue = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
                                setFields(prev => prev.map(f => {
                                  if (f.id !== field.id) return f
                                  const newOpts = [...(f.options || [])]
                                  newOpts[oi] = { value: newValue, label: newLabel }
                                  return { ...f, options: newOpts }
                                }))
                              }}
                              placeholder={`Option ${oi + 1}`}
                              style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                            />
                            <button
                              onClick={() => {
                                setFields(prev => prev.map(f => {
                                  if (f.id !== field.id) return f
                                  return { ...f, options: (f.options || []).filter((_, i) => i !== oi) }
                                }))
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 4px' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >&#10005;</button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setFields(prev => prev.map(f => {
                            if (f.id !== field.id) return f
                            const idx = (f.options || []).length + 1
                            return { ...f, options: [...(f.options || []), { value: `option_${idx}`, label: `Option ${idx}` }] }
                          }))
                        }}
                        style={{ marginTop: 8, padding: '4px 12px', borderRadius: 4, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Add Option
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Unassigned fields (multi-step) */}
          {formType === 'multi_step' && unassignedFields.length > 0 && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 8, border: '1px dashed var(--border)', background: 'rgba(245,158,11,0.05)' }}>
              <label style={{ ...labelStyle, color: '#f59e0b' }}>Unassigned Fields ({unassignedFields.length})</label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>These fields are not in any step. Click to add them to the current step.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {unassignedFields.map(f => (
                  <button
                    key={f.id}
                    onClick={() => moveFieldToStep(f.id, activeStepIndex)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 6,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: `${FIELD_TYPE_COLORS[f.type] || '#64748b'}20`,
                      color: FIELD_TYPE_COLORS[f.type] || '#64748b',
                      textTransform: 'uppercase', fontWeight: 700,
                    }}>{f.type}</span>
                    {f.label}
                    <span style={{ color: 'var(--accent)' }}>+</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Settings ── */}
        <div style={card()}>
          <label style={labelStyle}>Form Settings</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grid-2col-responsive">
            <div>
              <label style={{ ...labelStyle, fontSize: 12 }}>Submit Button Text</label>
              <input
                className="form-input"
                value={settings.submit_button_text || ''}
                onChange={e => setSettings(prev => ({ ...prev, submit_button_text: e.target.value }))}
                placeholder="Get Started"
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 12 }}>Success Message</label>
              <input
                className="form-input"
                value={settings.success_message || ''}
                onChange={e => setSettings(prev => ({ ...prev, success_message: e.target.value }))}
                placeholder="Thanks! We'll be in touch."
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 12 }}>Redirect URL (optional)</label>
              <input
                className="form-input"
                value={settings.redirect_url || ''}
                onChange={e => setSettings(prev => ({ ...prev, redirect_url: e.target.value }))}
                placeholder="https://example.com/thank-you"
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 12 }}>Webhook URL</label>
              <input
                className="form-input"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/..."
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Form data POSTed here on submission.</div>
            </div>
          </div>

          {/* Multi-step specific settings */}
          {formType === 'multi_step' && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label style={labelStyle}>Multi-Step Settings</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }} className="grid-2col-responsive">
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>Next Button Text</label>
                  <input
                    className="form-input"
                    value={settings.next_button_text || ''}
                    onChange={e => setSettings(prev => ({ ...prev, next_button_text: e.target.value }))}
                    placeholder="Next"
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>Back Button Text</label>
                  <input
                    className="form-input"
                    value={settings.back_button_text || ''}
                    onChange={e => setSettings(prev => ({ ...prev, back_button_text: e.target.value }))}
                    placeholder="Back"
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>Progress Bar</label>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, show_progress_bar: prev.show_progress_bar === false ? true : false }))}
                    style={{
                      marginTop: 4,
                      padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: settings.show_progress_bar !== false ? 'var(--accent)' : 'var(--bg-input)',
                      color: settings.show_progress_bar !== false ? '#fff' : 'var(--text-secondary)',
                      border: settings.show_progress_bar !== false ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {settings.show_progress_bar !== false ? 'Shown' : 'Hidden'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Preview ── */}
        <div style={card()}>
          <label style={labelStyle}>Preview</label>
          <div style={{
            padding: 20, borderRadius: 10,
            background: '#f9fafb', border: '1px solid #e5e7eb',
          }}>
            {/* Step indicator preview (multi-step) */}
            {formType === 'multi_step' && steps.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  {steps.map((step, i) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        background: i === activeStepIndex ? '#10b981' : i < activeStepIndex ? '#3b82f6' : '#e5e7eb',
                        color: i <= activeStepIndex ? '#fff' : '#9ca3af',
                      }}>
                        {i < activeStepIndex ? '\u2713' : i + 1}
                      </div>
                      {i < steps.length - 1 && (
                        <div style={{ width: 30, height: 2, background: i < activeStepIndex ? '#3b82f6' : '#e5e7eb', borderRadius: 1 }} />
                      )}
                    </div>
                  ))}
                </div>
                <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#1a202c' }}>
                  {steps[activeStepIndex]?.name || 'Step'}
                </p>
              </div>
            )}

            {/* Fields preview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {visibleFields.map(field => (
                <div key={field.id} style={{ gridColumn: field.width === 'half' ? 'span 1' : 'span 2' }}>
                  {field.type === 'radio' ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(field.options || []).map((opt, oi) => (
                          <div key={oi} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', borderRadius: 8,
                            border: oi === 0 ? '2px solid #10b981' : '1px solid #e5e7eb',
                            background: oi === 0 ? 'rgba(16,185,129,0.05)' : '#fff',
                          }}>
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%',
                              border: oi === 0 ? '5px solid #10b981' : '2px solid #d1d5db',
                            }} />
                            <span style={{ fontSize: 13, color: '#374151' }}>{opt.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : field.type === 'checkbox' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, border: '2px solid #d1d5db' }} />
                      <span style={{ fontSize: 13, color: '#374151' }}>{field.label}</span>
                    </div>
                  ) : field.type === 'select' ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#9ca3af' }}>
                        Select...
                      </div>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', height: 60, fontSize: 13, color: '#9ca3af' }}>
                        {field.placeholder || 'Tell us more...'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#9ca3af' }}>
                        {field.placeholder || field.label}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Button preview */}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{
                display: 'inline-block',
                padding: '10px 32px', borderRadius: 8,
                background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 14,
              }}>
                {formType === 'multi_step' && activeStepIndex < steps.length - 1
                  ? (settings.next_button_text || 'Next')
                  : (settings.submit_button_text || 'Submit')
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom save bar ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() => setView('list')}
            style={{ padding: '10px 20px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 6, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : editingFormId ? 'Update Form' : 'Create Form'}
          </button>
        </div>
      </div>
    </div>
  )
}
