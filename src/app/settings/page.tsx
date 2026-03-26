'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import { analyzeBusiness, generateIntake, refineSystem } from '@/lib/api'
import type { UserRole, Competitor } from '@/types/database'
import TagInput from '@/components/TagInput'
import LogoUpload from '@/components/LogoUpload'

interface TeamMember {
  id: string
  email: string
  name: string | null
  role: UserRole
  status: 'active' | 'disabled'
  client_id: string | null
  created_at: string
}

interface ClientAssignment {
  id: string
  user_id: string
  client_id: string
}

type SettingsTab = 'business' | 'intake' | 'profile' | 'team' | 'clients'

export default function SettingsPage() {
  const { profile, user } = useAuth()
  const {
    client, loading, allClients, canEdit,
    setClient, setLoading, setError, createClient, loadClientData, loadAllClients,
    intakeQuestions, refreshIntake, refreshClient,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>(client ? 'business' : 'profile')

  // ─── Profile form ───
  const [editName, setEditName] = useState(profile?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // ─── Team management ───
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<ClientAssignment[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('team_editor')
  const [inviting, setInviting] = useState(false)
  const [managingMember, setManagingMember] = useState<TeamMember | null>(null)

  // ─── Business Overview state ───
  const [showNewForm, setShowNewForm] = useState(false)
  const [setupName, setSetupName] = useState('')
  const [setupWebsite, setSetupWebsite] = useState('')
  const [setupNotes, setSetupNotes] = useState('')
  const [analyzeMessage, setAnalyzeMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [businessSummary, setBusinessSummary] = useState('')
  const [services, setServices] = useState('')
  const [differentiators, setDifferentiators] = useState('')
  const [trustSignals, setTrustSignals] = useState('')
  const [tone, setTone] = useState('')
  const [adCopyNotes, setAdCopyNotes] = useState('')
  const [toneDescriptors, setToneDescriptors] = useState<string[]>([])
  const [bannedWords, setBannedWords] = useState<string[]>([])
  const [requiredDisclaimers, setRequiredDisclaimers] = useState<string[]>([])
  const [googleHeadlineMax, setGoogleHeadlineMax] = useState('30')
  const [googleDescMax, setGoogleDescMax] = useState('90')
  const [metaPrimaryMax, setMetaPrimaryMax] = useState('125')
  const [metaHeadlineMax, setMetaHeadlineMax] = useState('40')
  const [brandConstraints, setBrandConstraints] = useState('')
  const [complianceNotes, setComplianceNotes] = useState('')
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [reanalyzeNotes, setReanalyzeNotes] = useState('')
  const [reanalyzing, setReanalyzing] = useState(false)
  const [saving, setSaving] = useState(false)

  // ─── Intake state ───
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [intakeLoadingMessage, setIntakeLoadingMessage] = useState('')

  const isAdmin = profile?.role === 'admin'

  // Switch to business tab when client is selected
  useEffect(() => {
    if (client && activeTab === 'profile') {
      setActiveTab('business')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id])

  useEffect(() => {
    setEditName(profile?.name || '')
  }, [profile])

  useEffect(() => {
    if (isAdmin) {
      loadTeam()
    }
  }, [isAdmin])

  // Sync intake answers when intakeQuestions change
  useEffect(() => {
    if (intakeQuestions.length > 0) {
      const initial: Record<string, string> = {}
      for (const q of intakeQuestions) {
        initial[q.id] = q.answer || ''
      }
      setAnswers(initial)
    }
  }, [intakeQuestions])

  // ═══════════════════════════════════════
  // Team functions
  // ═══════════════════════════════════════

  async function loadTeam() {
    setLoadingTeam(true)
    const [{ data: members }, { data: assigns }] = await Promise.all([
      supabase.from('users').select('*').order('created_at'),
      supabase.from('client_assignments').select('*'),
    ])
    setTeamMembers((members || []) as TeamMember[])
    setAssignments((assigns || []) as ClientAssignment[])
    setLoadingTeam(false)
  }

  async function handleSaveProfile() {
    if (!user || !editName.trim()) return
    setSavingProfile(true)
    const { error } = await supabase
      .from('users')
      .update({ name: editName.trim() })
      .eq('id', user.id)
    setSavingProfile(false)
    if (error) {
      showToast('Failed to save: ' + error.message)
    } else {
      showToast('Profile updated')
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', inviteEmail.trim())
      .single()

    if (existing) {
      showToast('User with this email already exists')
      setInviting(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: inviteEmail.trim(),
      password: crypto.randomUUID().slice(0, 12),
      options: {
        data: { name: inviteName.trim() || inviteEmail.split('@')[0] },
      },
    })

    if (authError) {
      showToast('Failed to invite: ' + authError.message)
      setInviting(false)
      return
    }

    if (authData.user) {
      await supabase.from('users').insert({
        id: authData.user.id,
        email: inviteEmail.trim(),
        name: inviteName.trim() || inviteEmail.split('@')[0],
        role: inviteRole,
        status: 'active',
      })
    }

    showToast('Team member invited! They will receive a confirmation email.')
    setInviteEmail('')
    setInviteName('')
    setShowInviteForm(false)
    setInviting(false)
    loadTeam()
  }

  async function handleChangeRole(memberId: string, newRole: UserRole) {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', memberId)
    if (error) {
      showToast('Failed to update role: ' + error.message)
    } else {
      showToast('Role updated')
      loadTeam()
    }
  }

  async function handleToggleStatus(member: TeamMember) {
    const newStatus = member.status === 'active' ? 'disabled' : 'active'
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', member.id)
    if (error) {
      showToast('Failed to update status')
    } else {
      showToast(`User ${newStatus === 'active' ? 'enabled' : 'disabled'}`)
      loadTeam()
    }
  }

  async function handleAssignClient(memberId: string, clientId: string) {
    const exists = assignments.some(a => a.user_id === memberId && a.client_id === clientId)
    if (exists) {
      const { error } = await supabase
        .from('client_assignments')
        .delete()
        .eq('user_id', memberId)
        .eq('client_id', clientId)
      if (error) {
        showToast('Failed to remove assignment')
      } else {
        showToast('Client unassigned')
        loadTeam()
      }
    } else {
      const { error } = await supabase
        .from('client_assignments')
        .insert({ user_id: memberId, client_id: clientId })
      if (error) {
        showToast('Failed to assign client: ' + error.message)
      } else {
        showToast('Client assigned')
        loadTeam()
      }
    }
  }

  // ═══════════════════════════════════════
  // Business Overview functions
  // ═══════════════════════════════════════

  async function handleAnalyzeNewBusiness() {
    if (!setupName.trim() || !setupWebsite.trim()) {
      setError('Business name and website URL are required.')
      return
    }
    setLoading(true)
    setAnalyzeMessage('Creating client record...')
    setError(null)
    try {
      const newClient = await createClient(setupName.trim(), setupWebsite.trim())
      if (!newClient) {
        setLoading(false)
        setAnalyzeMessage('')
        return
      }
      setAnalyzeMessage('AI is analyzing your business...')
      await analyzeBusiness(newClient.id, setupWebsite.trim(), setupNotes.trim())
      await loadClientData(newClient.id)
      await loadAllClients()
      setAnalyzeMessage('')
      setSetupName('')
      setSetupWebsite('')
      setSetupNotes('')
      setShowNewForm(false)
    } catch (err) {
      setError((err as Error).message)
      setAnalyzeMessage('')
    } finally {
      setLoading(false)
    }
  }

  function handleStartEdit() {
    if (!client) return
    setName(client.name)
    setWebsite(client.website)
    setBusinessSummary(client.business_summary ?? '')
    setServices(client.services ?? '')
    setDifferentiators(client.differentiators ?? '')
    setTrustSignals(client.trust_signals ?? '')
    setTone(client.tone ?? '')
    setAdCopyNotes(client.ad_copy_notes ?? '')
    setToneDescriptors(client.ad_copy_rules?.tone_descriptors ?? [])
    setBannedWords(client.ad_copy_rules?.banned_words ?? [])
    setRequiredDisclaimers(client.ad_copy_rules?.required_disclaimers ?? [])
    setGoogleHeadlineMax(String(client.ad_copy_rules?.platform_rules.google.headline_max_chars ?? 30))
    setGoogleDescMax(String(client.ad_copy_rules?.platform_rules.google.description_max_chars ?? 90))
    setMetaPrimaryMax(String(client.ad_copy_rules?.platform_rules.meta.primary_text_max_chars ?? 125))
    setMetaHeadlineMax(String(client.ad_copy_rules?.platform_rules.meta.headline_max_chars ?? 40))
    setBrandConstraints(client.ad_copy_rules?.brand_constraints ?? '')
    setComplianceNotes(client.ad_copy_rules?.compliance_notes ?? '')
    setCompetitors(client.competitors ? [...client.competitors] : [])
    setEditing(true)
  }

  async function handleSaveBusiness() {
    if (!client) return
    setSaving(true)
    setError(null)
    try {
      const updates: Record<string, unknown> = {
        name: name.trim(),
        website: website.trim(),
        business_summary: businessSummary.trim() || null,
        services: services.trim() || null,
        differentiators: differentiators.trim() || null,
        trust_signals: trustSignals.trim() || null,
        tone: tone.trim() || null,
        ad_copy_notes: adCopyNotes.trim() || null,
        competitors: competitors.length > 0 ? competitors : null,
        ad_copy_rules: {
          tone_descriptors: toneDescriptors,
          banned_words: bannedWords,
          required_disclaimers: requiredDisclaimers,
          platform_rules: {
            google: {
              headline_max_chars: parseInt(googleHeadlineMax) || 30,
              description_max_chars: parseInt(googleDescMax) || 90,
            },
            meta: {
              primary_text_max_chars: parseInt(metaPrimaryMax) || 125,
              headline_max_chars: parseInt(metaHeadlineMax) || 40,
            },
            youtube: {},
          },
          brand_constraints: brandConstraints.trim(),
          compliance_notes: complianceNotes.trim(),
        },
      }
      const { error: updateError } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id)
      if (updateError) {
        setError(updateError.message)
      } else {
        await loadClientData(client.id)
        setEditing(false)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditing(false)
  }

  function handleAddCompetitor() {
    setCompetitors([...competitors, { name: '', website: '', notes: '' }])
  }

  function updateCompetitor(index: number, field: keyof Competitor, value: string) {
    const updated = competitors.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    )
    setCompetitors(updated)
  }

  function removeCompetitor(index: number) {
    setCompetitors(competitors.filter((_, i) => i !== index))
  }

  async function handleReanalyze() {
    if (!client) return
    setReanalyzing(true)
    setError(null)
    try {
      await analyzeBusiness(client.id, client.website, reanalyzeNotes.trim())
      await loadClientData(client.id)
      setReanalyzeNotes('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setReanalyzing(false)
    }
  }

  // ═══════════════════════════════════════
  // Intake functions
  // ═══════════════════════════════════════

  const sections = [...new Set(intakeQuestions.map((q) => q.section))]
  const answeredCount = intakeQuestions.filter((q) => {
    const localAnswer = answers[q.id]
    return (localAnswer ?? q.answer ?? '').trim().length > 0
  }).length
  const totalCount = intakeQuestions.length
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  async function handleGenerateIntake() {
    if (!client) return
    setLoading(true)
    setIntakeLoadingMessage('AI is generating targeted questions...')
    try {
      const result = await generateIntake(client.id)
      await refreshIntake(client.id)
      if (result.questions_created > 0) {
        showToast(`${result.questions_created} intake questions generated`)
      } else {
        showToast('No questions were generated. Try again.')
      }
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      setIntakeLoadingMessage('')
    }
  }

  async function saveIntakeAnswers() {
    const changed = Object.entries(answers).filter(([id, answer]) => {
      const q = intakeQuestions.find((q) => q.id === id)
      return q && answer !== (q.answer || '')
    })
    if (changed.length === 0) {
      showToast('No changes to save')
      return
    }
    for (const [id, answer] of changed) {
      await supabase.from('intake_questions').update({ answer }).eq('id', id)
    }
    if (client) {
      await refreshIntake(client.id)
    }
    showToast('Answers saved successfully')
  }

  async function handleSaveIntakeAnswers() {
    setLoading(true)
    try {
      await saveIntakeAnswers()
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAndRefine() {
    if (!client) return
    setLoading(true)
    try {
      await saveIntakeAnswers()
      setIntakeLoadingMessage('AI is refining your avatars and offers...')
      await refineSystem(client.id)
      await loadClientData(client.id)
      showToast('System refined — avatars and offers updated')
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      setIntakeLoadingMessage('')
    }
  }

  // ═══════════════════════════════════════
  // Render helpers
  // ═══════════════════════════════════════

  function renderBusinessTab() {
    // Show new client setup form when no client or explicitly adding new
    if (!client || showNewForm) {
      return (
        <div>
          {showNewForm && client && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewForm(false)}>
                Cancel
              </button>
            </div>
          )}
          <div className="card">
            <div className="card-title">New Client Setup</div>
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Business Name *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Enter business name"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Business Website URL *</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://example.com"
                  value={setupWebsite}
                  onChange={(e) => setSetupWebsite(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Call Notes / Raw Information</label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder="Paste call transcripts, notes, or any raw business information here..."
                  value={setupNotes}
                  onChange={(e) => setSetupNotes(e.target.value)}
                />
              </div>
              {analyzeMessage && (
                <div style={{ padding: 16, background: 'var(--surface-hover, #f0f4ff)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{analyzeMessage}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>Processing...</div>
                </div>
              )}
              <div>
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyzeNewBusiness}
                  disabled={loading || !setupName.trim() || !setupWebsite.trim()}
                >
                  {loading ? 'Processing...' : 'Analyze Business'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Client exists: show data
    const adRules = client.ad_copy_rules
    const clientCompetitors = client.competitors ?? []
    const toneList = adRules?.tone_descriptors ?? []
    const bannedList = adRules?.banned_words ?? []
    const disclaimerList = adRules?.required_disclaimers ?? []

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          {canEdit && (
            <button className="btn btn-secondary" onClick={() => setShowNewForm(true)}>
              + Add New Client
            </button>
          )}
          {canEdit && (editing ? (
            <>
              <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveBusiness} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleStartEdit}>
              Edit
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Company Info */}
          <div className="card">
            <div className="card-title">Company Info</div>
            <div className="detail-grid" style={{ marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="detail-item">
                  <span className="detail-label">Business Name</span>
                  {editing ? (
                    <input
                      className="form-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  ) : (
                    <span className="detail-value">{client.name}</span>
                  )}
                </div>
                <div className="detail-item">
                  <span className="detail-label">Website</span>
                  {editing ? (
                    <input
                      className="form-input"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  ) : (
                    <span className="detail-value">{client.website}</span>
                  )}
                </div>
              </div>
              {/* Client Logo */}
              <div className="detail-item">
                <span className="detail-label">Logo</span>
                {canEdit ? (
                  <LogoUpload
                    clientId={client.id}
                    currentLogoUrl={client.logo_url || null}
                    onUploadComplete={() => refreshClient(client.id)}
                  />
                ) : client.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={client.logo_url} alt={`${client.name} logo`} style={{ maxHeight: 80, objectFit: 'contain' }} />
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No logo uploaded yet</span>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Business Summary</span>
                {editing ? (
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={businessSummary}
                    onChange={(e) => setBusinessSummary(e.target.value)}
                  />
                ) : client.business_summary ? (
                  <span className="detail-value">{client.business_summary}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">Not yet analyzed</span>
                    <span className="empty-state-sub">Click Re-analyze Business below to generate</span>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Services</span>
                {editing ? (
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                  />
                ) : client.services ? (
                  <span className="detail-value">{client.services}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">Not yet analyzed</span>
                    <span className="empty-state-sub">Click Re-analyze Business below to generate</span>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Differentiators</span>
                {editing ? (
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={differentiators}
                    onChange={(e) => setDifferentiators(e.target.value)}
                  />
                ) : client.differentiators ? (
                  <span className="detail-value">{client.differentiators}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">Not yet analyzed</span>
                    <span className="empty-state-sub">Click Re-analyze Business below to generate</span>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Trust Signals</span>
                {editing ? (
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={trustSignals}
                    onChange={(e) => setTrustSignals(e.target.value)}
                  />
                ) : client.trust_signals ? (
                  <span className="detail-value">{client.trust_signals}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">Not yet analyzed</span>
                    <span className="empty-state-sub">Click Re-analyze Business below to generate</span>
                  </div>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Tone</span>
                {editing ? (
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  />
                ) : client.tone ? (
                  <span className="detail-value">{client.tone}</span>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-text">Not yet analyzed</span>
                    <span className="empty-state-sub">Click Re-analyze Business below to generate</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ad Copy Rules */}
          {(adRules || editing) && (
            <div className="card">
              <div className="card-title">Ad Copy Rules &amp; Guidelines</div>
              <div className="detail-grid" style={{ marginTop: 16 }}>
                <div className="detail-item">
                  <span className="detail-label">Tone Descriptors</span>
                  {editing ? (
                    <TagInput
                      tags={toneDescriptors}
                      onChange={setToneDescriptors}
                      placeholder="Type a tone descriptor and press Enter"
                    />
                  ) : toneList.length > 0 ? (
                    <div className="tag-list">
                      {toneList.map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-text">No tone descriptors set</span>
                    </div>
                  )}
                </div>
                <div className="detail-item">
                  <span className="detail-label">Banned Words</span>
                  {editing ? (
                    <TagInput
                      tags={bannedWords}
                      onChange={setBannedWords}
                      placeholder="Type a banned word and press Enter"
                      tagColor="var(--danger)"
                    />
                  ) : bannedList.length > 0 ? (
                    <div className="tag-list">
                      {bannedList.map((w) => (
                        <span key={w} className="tag" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{w}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-text">No banned words set</span>
                    </div>
                  )}
                </div>
                <div className="detail-item">
                  <span className="detail-label">Required Disclaimers</span>
                  {editing ? (
                    <div className="disclaimer-list">
                      {requiredDisclaimers.map((d, i) => (
                        <div key={i} className="disclaimer-item">
                          <textarea
                            className="form-textarea"
                            rows={2}
                            value={d}
                            onChange={(e) => {
                              const updated = [...requiredDisclaimers]
                              updated[i] = e.target.value
                              setRequiredDisclaimers(updated)
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setRequiredDisclaimers(requiredDisclaimers.filter((_, idx) => idx !== i))}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm disclaimer-add-btn"
                        onClick={() => setRequiredDisclaimers([...requiredDisclaimers, ''])}
                      >
                        + Add Disclaimer
                      </button>
                    </div>
                  ) : disclaimerList.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {disclaimerList.map((d) => (
                        <div key={d} style={{ fontSize: 14, color: 'var(--text-primary)', padding: '6px 10px', background: 'var(--warning-muted)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                          {d}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-text">No disclaimers set</span>
                    </div>
                  )}
                </div>
                <div className="platform-rules-grid">
                  <div className="platform-rule-card">
                    <div className="platform-rule-title">Google Ads Limits</div>
                    {editing ? (
                      <>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Headlines</span>
                          <input
                            className="form-input platform-rule-input"
                            type="number"
                            value={googleHeadlineMax}
                            onChange={(e) => setGoogleHeadlineMax(e.target.value)}
                          />
                          <span className="platform-rule-suffix">chars</span>
                        </div>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Descriptions</span>
                          <input
                            className="form-input platform-rule-input"
                            type="number"
                            value={googleDescMax}
                            onChange={(e) => setGoogleDescMax(e.target.value)}
                          />
                          <span className="platform-rule-suffix">chars</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Headlines</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.google.headline_max_chars ?? 30} chars</span>
                        </div>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Descriptions</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.google.description_max_chars ?? 90} chars</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="platform-rule-card">
                    <div className="platform-rule-title">Meta Ads Limits</div>
                    {editing ? (
                      <>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Primary text</span>
                          <input
                            className="form-input platform-rule-input"
                            type="number"
                            value={metaPrimaryMax}
                            onChange={(e) => setMetaPrimaryMax(e.target.value)}
                          />
                          <span className="platform-rule-suffix">chars</span>
                        </div>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Headlines</span>
                          <input
                            className="form-input platform-rule-input"
                            type="number"
                            value={metaHeadlineMax}
                            onChange={(e) => setMetaHeadlineMax(e.target.value)}
                          />
                          <span className="platform-rule-suffix">chars</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Primary text</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.meta.primary_text_max_chars ?? 125} chars</span>
                        </div>
                        <div className="platform-rule-row">
                          <span className="platform-rule-label">Headlines</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{adRules?.platform_rules.meta.headline_max_chars ?? 40} chars</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Brand Constraints</span>
                  {editing ? (
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={brandConstraints}
                      onChange={(e) => setBrandConstraints(e.target.value)}
                    />
                  ) : adRules?.brand_constraints ? (
                    <span className="detail-value">{adRules.brand_constraints}</span>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-text">No brand constraints set</span>
                    </div>
                  )}
                </div>
                <div className="detail-item">
                  <span className="detail-label">Compliance Notes</span>
                  {editing ? (
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={complianceNotes}
                      onChange={(e) => setComplianceNotes(e.target.value)}
                    />
                  ) : adRules?.compliance_notes ? (
                    <span className="detail-value">{adRules.compliance_notes}</span>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-text">No compliance notes set</span>
                    </div>
                  )}
                </div>
                <div className="detail-item">
                  <span className="detail-label">Additional Copy Notes</span>
                  {editing ? (
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={adCopyNotes}
                      onChange={(e) => setAdCopyNotes(e.target.value)}
                    />
                  ) : client.ad_copy_notes ? (
                    <span className="detail-value">{client.ad_copy_notes}</span>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-text">No additional copy notes</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!adRules && !editing && (
            <div className="card">
              <div className="card-title">Ad Copy Rules &amp; Guidelines</div>
              <div className="empty-state" style={{ marginTop: 16, padding: 24, textAlign: 'center' }}>
                <span className="empty-state-text">Not yet analyzed</span>
                <span className="empty-state-sub">Click Re-analyze Business below to generate ad copy rules</span>
              </div>
            </div>
          )}

          {/* Competitors */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Competitors</span>
              {editing && (
                <button className="btn btn-secondary" onClick={handleAddCompetitor}>
                  Add Competitor
                </button>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              {editing ? (
                <>
                  {competitors.map((c, index) => (
                    <div key={index} className="copy-item" style={{ marginBottom: 12 }}>
                      <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                        <input
                          className="form-input"
                          placeholder="Competitor name"
                          value={c.name}
                          onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                        />
                        <input
                          className="form-input"
                          placeholder="Website URL"
                          value={c.website}
                          onChange={(e) => updateCompetitor(index, 'website', e.target.value)}
                        />
                        <textarea
                          className="form-textarea"
                          rows={2}
                          placeholder="Notes about this competitor"
                          value={c.notes}
                          onChange={(e) => updateCompetitor(index, 'notes', e.target.value)}
                        />
                        <button
                          className="btn btn-secondary"
                          style={{ justifySelf: 'start', fontSize: 13 }}
                          onClick={() => removeCompetitor(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {competitors.length === 0 && (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      No competitors added yet. Click &quot;Add Competitor&quot; to get started.
                    </div>
                  )}
                </>
              ) : clientCompetitors.length > 0 ? (
                clientCompetitors.map((c, index) => (
                  <div key={index} className="copy-item" style={{ marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{c.website}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{c.notes}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
                  <span className="empty-state-text">No competitors found</span>
                  <span className="empty-state-sub">Not yet analyzed -- click Re-analyze Business below</span>
                </div>
              )}
            </div>
          </div>

          {/* Re-analyze Section */}
          {canEdit && (
            <div className="card">
              <div className="card-title">Re-analyze Business</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, marginBottom: 12 }}>
                Uses intake answers and call notes to build a comprehensive business overview.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">New Call Notes / Additional Information</label>
                  <textarea
                    className="form-textarea"
                    rows={6}
                    placeholder="Paste new call transcripts, notes, or any additional business information to re-run AI analysis..."
                    value={reanalyzeNotes}
                    onChange={(e) => setReanalyzeNotes(e.target.value)}
                  />
                </div>
                {reanalyzing && (
                  <div style={{ padding: 16, background: 'var(--surface-hover, #f0f4ff)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>AI is analyzing your business...</div>
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>Processing...</div>
                  </div>
                )}
                <div>
                  <button
                    className="btn btn-primary"
                    onClick={handleReanalyze}
                    disabled={reanalyzing || !reanalyzeNotes.trim()}
                  >
                    {reanalyzing ? 'Processing...' : 'Re-analyze Business'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderIntakeTab() {
    if (!client) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">&#128203;</div>
          <div className="empty-state-text">No client selected</div>
          <div className="empty-state-sub">Set up your client first in the Business tab.</div>
        </div>
      )
    }

    // No intake questions yet
    if (intakeQuestions.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">&#128221;</div>
          <div className="empty-state-text">No intake questions yet</div>
          <div className="empty-state-sub">
            Generate targeted questions based on your client profile.
          </div>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={handleGenerateIntake}
              disabled={loading}
              style={{ marginTop: 16 }}
            >
              {loading ? intakeLoadingMessage || 'Generating...' : 'Generate Intake Questions'}
            </button>
          )}
        </div>
      )
    }

    // Intake questions exist
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {answeredCount}/{totalCount} answered
            <span className={`badge ${answeredCount === totalCount ? 'badge-approved' : 'badge-pending'}`} style={{ marginLeft: 8 }}>
              {answeredCount === totalCount ? 'Completed' : 'Pending'}
            </span>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSaveIntakeAnswers}
            disabled={loading}
          >
            Save Answers
          </button>
        </div>

        {/* Loading message overlay */}
        {loading && intakeLoadingMessage && (
          <div className="card" style={{ marginBottom: 16, padding: '12px 20px', textAlign: 'center' }}>
            {intakeLoadingMessage}
          </div>
        )}

        {/* Progress bar */}
        <div className="card" style={{ marginBottom: 16, padding: '12px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                borderRadius: 4,
                background: progressPercent === 100 ? '#22c55e' : '#6366f1',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Questions grouped by section */}
        {sections.map((section) => (
          <div key={section} className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>{section}</div>
            {intakeQuestions
              .filter((q) => q.section === section)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((q) => (
                <div key={q.id} className="form-group">
                  <label className="form-label">{q.question}</label>
                  <textarea
                    className="form-input form-textarea"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Type your answer here..."
                  />
                </div>
              ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          {canEdit && (
            <button
              className="btn btn-secondary"
              onClick={handleGenerateIntake}
              disabled={loading}
            >
              Regenerate Questions
            </button>
          )}
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={handleSaveAndRefine}
              disabled={loading}
            >
              {loading && intakeLoadingMessage ? intakeLoadingMessage : 'Save & Refine System'}
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderProfileTab() {
    return (
      <div className="funnel-section-card">
        <div className="funnel-section-header">
          <h3>My Profile</h3>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                value={profile?.email || ''}
                disabled
                style={{ opacity: 0.6 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <div style={{ padding: '8px 0' }}>
                <span className="tag" style={{ fontSize: 13 }}>{profile?.role || 'admin'}</span>
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSaveProfile}
            disabled={savingProfile}
            style={{ marginTop: 12 }}
          >
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  function renderTeamTab() {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
          </div>
          <button className="btn btn-primary" onClick={() => setShowInviteForm(true)}>
            + Invite Team Member
          </button>
        </div>

        {loadingTeam ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading team...</div>
        ) : (
          <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
            {teamMembers.map(member => (
              <div key={member.id} className="card" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', opacity: member.status === 'disabled' ? 0.5 : 1,
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {member.name || 'Unnamed'}
                    {member.id === user?.id && (
                      <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8 }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{member.email}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className="tag" style={{ fontSize: 11 }}>{member.role}</span>
                    {member.status === 'disabled' && (
                      <span className="tag" style={{ fontSize: 11, background: '#ef4444', marginLeft: 4 }}>disabled</span>
                    )}
                  </div>
                </div>
                {member.id !== user?.id && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={member.role}
                      onChange={e => handleChangeRole(member.id, e.target.value as UserRole)}
                      className="form-input"
                      style={{ fontSize: 12, padding: '4px 8px', minWidth: 120 }}
                    >
                      <option value="admin">Admin</option>
                      <option value="team_editor">Team Editor</option>
                      <option value="team_viewer">Team Viewer</option>
                      <option value="client">Client</option>
                    </select>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setManagingMember(member)}
                    >
                      Clients
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => handleToggleStatus(member)}
                    >
                      {member.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Invite Modal */}
        {showInviteForm && (
          <div className="modal-overlay" onClick={() => setShowInviteForm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
              <div className="modal-header">
                <h2 className="modal-title">Invite Team Member</h2>
                <button className="modal-close" onClick={() => setShowInviteForm(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleInviteMember}>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      className="form-input"
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="team@example.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      className="form-input"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="form-input"
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as UserRole)}
                    >
                      <option value="admin">Admin (full access)</option>
                      <option value="team_editor">Team Editor (edit assigned clients)</option>
                      <option value="team_viewer">Team Viewer (read-only)</option>
                      <option value="client">Client (own data only)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowInviteForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={inviting}>
                      {inviting ? 'Inviting...' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Client Assignment Modal */}
        {managingMember && (
          <div className="modal-overlay" onClick={() => setManagingMember(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
              <div className="modal-header">
                <h2 className="modal-title">Assign Clients to {managingMember.name || managingMember.email}</h2>
                <button className="modal-close" onClick={() => setManagingMember(null)}>&times;</button>
              </div>
              <div className="modal-body">
                {allClients.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                    No clients created yet.
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Toggle which clients this team member can access:
                    </p>
                    {allClients.map(c => {
                      const isAssigned = assignments.some(
                        a => a.user_id === managingMember.id && a.client_id === c.id
                      )
                      return (
                        <label
                          key={c.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                            border: '1px solid var(--border)', marginBottom: 6,
                            background: isAssigned ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => handleAssignClient(managingMember.id, c.id)}
                            style={{ accentColor: 'var(--accent)' }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                            {c.website && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.website}</div>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderClientAccessTab() {
    return (
      <div className="funnel-section-card">
        <div className="funnel-section-header">
          <h3>Client Access Map</h3>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Overview of which team members have access to each client.
          </p>
          {allClients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No clients created yet.
            </div>
          ) : (
            <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
              {allClients.map(c => {
                const clientAssignments = assignments.filter(a => a.client_id === c.id)
                const assignedMembers = teamMembers.filter(m =>
                  clientAssignments.some(a => a.user_id === m.id)
                )
                const admins = teamMembers.filter(m => m.role === 'admin')
                return (
                  <div key={c.id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{c.name}</div>
                    <div className="tag-list">
                      {admins.map(a => (
                        <span key={a.id} className="tag" style={{ fontSize: 11 }}>
                          {a.name || a.email} (admin)
                        </span>
                      ))}
                      {assignedMembers.map(m => (
                        <span key={m.id} className="tag" style={{ fontSize: 11 }}>
                          {m.name || m.email} ({m.role})
                        </span>
                      ))}
                      {assignedMembers.length === 0 && admins.length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No team members assigned</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // Main render
  // ═══════════════════════════════════════

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Client setup, intake, account, and team management</p>
      </div>

      {/* Tabs */}
      <div className="funnel-tabs" style={{ marginBottom: 24 }}>
        <button
          className={`funnel-tab ${activeTab === 'business' ? 'funnel-tab-active' : ''}`}
          onClick={() => setActiveTab('business')}
        >
          Business
        </button>
        <button
          className={`funnel-tab ${activeTab === 'intake' ? 'funnel-tab-active' : ''}`}
          onClick={() => setActiveTab('intake')}
        >
          Intake
        </button>
        <button
          className={`funnel-tab ${activeTab === 'profile' ? 'funnel-tab-active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        {isAdmin && (
          <>
            <button
              className={`funnel-tab ${activeTab === 'team' ? 'funnel-tab-active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              Team
            </button>
            <button
              className={`funnel-tab ${activeTab === 'clients' ? 'funnel-tab-active' : ''}`}
              onClick={() => setActiveTab('clients')}
            >
              Client Access
            </button>
          </>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'business' && renderBusinessTab()}
      {activeTab === 'intake' && renderIntakeTab()}
      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'team' && isAdmin && renderTeamTab()}
      {activeTab === 'clients' && isAdmin && renderClientAccessTab()}
    </div>
  )
}
