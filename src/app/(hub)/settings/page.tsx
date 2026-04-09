'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import { analyzeBusiness, analyzeBrandKit, generateIntake, refineSystem, inviteUser } from '@/lib/api'
import type { UserRole, Competitor, PromptTemplate, ClientPhoneNumber } from '@/types/database'
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

type SettingsTab = 'business' | 'intake' | 'profile' | 'team' | 'clients' | 'prompts' | 'phones'

export default function SettingsPage() {
  const { profile, user } = useAuth()
  const {
    client, loading, allClients, canEdit, isClientRole,
    setClient, setLoading, setError, createClient, loadClientData, loadAllClients,
    intakeQuestions, refreshIntake, refreshClient,
    clientPhoneNumbers, refreshClientPhoneNumbers,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>(isClientRole ? 'profile' : (client ? 'business' : 'profile'))

  // ─── Profile form ───
  const [editName, setEditName] = useState(profile?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')

  // ─── Team management ───
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<ClientAssignment[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('team_editor')
  const [inviteClientIds, setInviteClientIds] = useState<string[]>([])
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
  // Review sites
  interface ReviewSiteEdit { platform: string; url: string; rating: string; review_count: string; enabled: boolean }
  const [reviewSites, setReviewSites] = useState<ReviewSiteEdit[]>([])
  const [reanalyzeNotes, setReanalyzeNotes] = useState('')
  const [reanalyzing, setReanalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzingBrandKit, setAnalyzingBrandKit] = useState(false)

  // ─── Brand Kit editing state ───
  const [editingBrandKit, setEditingBrandKit] = useState(false)
  const [bkPrimary, setBkPrimary] = useState('')
  const [bkSecondary, setBkSecondary] = useState('')
  const [bkAccent, setBkAccent] = useState('')
  const [bkBackground, setBkBackground] = useState('')
  const [bkText, setBkText] = useState('')
  const [bkHeadingFont, setBkHeadingFont] = useState('')
  const [bkBodyFont, setBkBodyFont] = useState('')

  // ─── Prompt Templates state ───
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editPromptText, setEditPromptText] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)

  // ─── Phone Numbers state ───
  const [showPhoneForm, setShowPhoneForm] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneLabel, setPhoneLabel] = useState('Main')
  const [phoneNotes, setPhoneNotes] = useState('')
  const [phoneIsDefault, setPhoneIsDefault] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null)
  const [editPhoneNumber, setEditPhoneNumber] = useState('')
  const [editPhoneLabel, setEditPhoneLabel] = useState('')
  const [editPhoneNotes, setEditPhoneNotes] = useState('')
  const [editPhoneIsDefault, setEditPhoneIsDefault] = useState(false)
  const [deletingPhoneId, setDeletingPhoneId] = useState<string | null>(null)

  // ─── Company Assets state ───
  interface ClientContentItem {
    id: string
    content_type: string
    title: string | null
    body: string | null
    person_name: string | null
    person_role: string | null
    person_photo: string | null
    rating: number | null
    stat_value: string | null
    stat_label: string | null
    source: string | null
    sort_order: number
    is_featured: boolean
    created_at: string
  }
  const [clientContent, setClientContent] = useState<ClientContentItem[]>([])
  const [loadingContent, setLoadingContent] = useState(false)
  const [addingContentType, setAddingContentType] = useState<string | null>(null)
  const [newContentForm, setNewContentForm] = useState<Record<string, string>>({})

  // ─── Intake state ───
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [intakeLoadingMessage, setIntakeLoadingMessage] = useState('')

  const isAdmin = profile?.role === 'admin'

  // Switch to business tab when client is selected (agency only)
  useEffect(() => {
    if (client && activeTab === 'profile' && !isClientRole) {
      setActiveTab('business')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, isClientRole])

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

  // Load client content when client changes
  useEffect(() => {
    if (client?.id) {
      loadClientContent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id])

  // Load prompt templates when prompts tab is activated or client changes
  useEffect(() => {
    if (activeTab === 'prompts') {
      loadPromptTemplates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, client?.id])

  // Load phone numbers when phones tab is activated or client changes
  useEffect(() => {
    if (activeTab === 'phones' && client?.id) {
      refreshClientPhoneNumbers(client.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, client?.id])

  async function loadClientContent() {
    if (!client?.id) return
    setLoadingContent(true)
    const { data } = await supabase
      .from('client_content')
      .select('*')
      .eq('client_id', client.id)
      .order('content_type')
      .order('sort_order')
      .order('created_at')
    setClientContent((data || []) as ClientContentItem[])
    setLoadingContent(false)
  }

  async function handleAddContent(contentType: string) {
    if (!client?.id) return
    const form = newContentForm
    const record: Record<string, unknown> = {
      client_id: client.id,
      content_type: contentType,
      source: 'manual',
    }

    if (contentType === 'testimonial' || contentType === 'review') {
      record.person_name = form.person_name || null
      record.person_role = form.person_role || null
      record.body = form.body || null
      record.rating = form.rating ? parseInt(form.rating) : null
    } else if (contentType === 'stat') {
      record.stat_value = form.stat_value || null
      record.stat_label = form.stat_label || null
    } else if (contentType === 'team_member') {
      record.person_name = form.person_name || null
      record.person_role = form.person_role || null
      record.body = form.body || null
    } else if (contentType === 'faq') {
      record.title = form.title || null
      record.body = form.body || null
    } else {
      record.title = form.title || null
      record.body = form.body || null
    }

    const { error } = await supabase.from('client_content').insert(record)
    if (error) {
      showToast('Failed to add: ' + error.message)
    } else {
      showToast('Added successfully')
      setAddingContentType(null)
      setNewContentForm({})
      loadClientContent()
    }
  }

  async function handleDeleteContent(id: string) {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from('client_content').delete().eq('id', id)
    if (error) {
      showToast('Failed to delete: ' + error.message)
    } else {
      setClientContent(prev => prev.filter(c => c.id !== id))
    }
  }

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

    // Validate: non-admin roles must have at least one client assigned
    if (inviteRole !== 'admin' && inviteClientIds.length === 0) {
      showToast('Please select at least one client to assign')
      return
    }

    // Client role must have exactly one client
    if (inviteRole === 'client' && inviteClientIds.length !== 1) {
      showToast('Client role users must be assigned to exactly one client')
      return
    }

    setInviting(true)

    try {
      const result = await inviteUser(
        inviteEmail.trim(),
        inviteName.trim() || inviteEmail.split('@')[0],
        inviteRole,
        inviteRole === 'client' ? inviteClientIds[0] : undefined,
        inviteRole !== 'client' && inviteRole !== 'admin' ? inviteClientIds : undefined
      )

      showToast(result.message || 'Invite sent! They will receive a password setup email.')
      setInviteEmail('')
      setInviteName('')
      setInviteClientIds([])
      setShowInviteForm(false)
      loadTeam()
    } catch (err) {
      showToast('Failed to invite: ' + (err as Error).message)
    } finally {
      setInviting(false)
    }
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
    // Sync review sites from metadata
    const existingReviewSites = (client.metadata as Record<string, unknown>)?.review_sites as Array<Record<string, unknown>> | undefined
    setReviewSites(
      existingReviewSites
        ? existingReviewSites.map((rs) => ({
            platform: String(rs.platform || 'google'),
            url: String(rs.url || ''),
            rating: String(rs.rating || ''),
            review_count: String(rs.review_count || ''),
            enabled: rs.enabled !== false,
          }))
        : []
    )
    // Sync brand kit
    const bk = client.brand_kit as Record<string, unknown> | null
    setBkPrimary((bk?.primary_color as string) || '')
    setBkSecondary((bk?.secondary_color as string) || '')
    setBkAccent((bk?.accent_color as string) || '')
    setBkBackground((bk?.background_color as string) || '')
    setBkText((bk?.text_color as string) || '')
    setBkHeadingFont((bk?.heading_font as string) || '')
    setBkBodyFont((bk?.body_font as string) || '')
    setEditing(true)
  }

  async function handleAnalyzeBrandKit() {
    if (!client) return
    setAnalyzingBrandKit(true)
    try {
      await analyzeBrandKit(client.id)
      await refreshClient(client.id)
      showToast('Brand kit extracted from website')
    } catch (err) {
      showToast('Brand kit extraction failed: ' + (err as Error).message)
    } finally {
      setAnalyzingBrandKit(false)
    }
  }

  async function handleSaveBrandKit() {
    if (!client) return
    const existing = (client.brand_kit as Record<string, unknown>) || {}
    const updated = {
      ...existing,
      primary_color: bkPrimary || existing.primary_color,
      secondary_color: bkSecondary || existing.secondary_color,
      accent_color: bkAccent || existing.accent_color,
      background_color: bkBackground || existing.background_color,
      text_color: bkText || existing.text_color,
      heading_font: bkHeadingFont || existing.heading_font,
      body_font: bkBodyFont || existing.body_font,
    }
    const { error } = await supabase.from('clients').update({
      brand_kit: updated,
      updated_at: new Date().toISOString(),
    }).eq('id', client.id)
    if (error) {
      showToast('Failed to save brand kit: ' + error.message)
    } else {
      showToast('Brand kit saved')
      setEditingBrandKit(false)
      await refreshClient(client.id)
    }
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
      // Merge review_sites into existing metadata (preserve trustpilot, etc.)
      const existingMeta = (client.metadata as Record<string, unknown>) || {}
      const cleanedReviewSites = reviewSites
        .filter(rs => rs.url.trim())
        .map(rs => ({
          platform: rs.platform,
          url: rs.url.trim(),
          rating: rs.rating ? parseFloat(rs.rating) || undefined : undefined,
          review_count: rs.review_count ? parseInt(rs.review_count) || undefined : undefined,
          enabled: rs.enabled,
        }))
      updates.metadata = {
        ...existingMeta,
        review_sites: cleanedReviewSites.length > 0 ? cleanedReviewSites : undefined,
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
      await loadClientContent()
      setReanalyzeNotes('')
      showToast('Business re-analyzed successfully')
    } catch (err) {
      setError((err as Error).message)
      showToast('Re-analysis failed: ' + (err as Error).message)
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
  // Prompt Templates functions
  // ═══════════════════════════════════════

  async function loadPromptTemplates() {
    setLoadingPrompts(true)
    // Load agency defaults (client_id is null)
    const { data: defaults } = await supabase
      .from('prompt_templates')
      .select('*')
      .is('client_id', null)
      .eq('is_active', true)
      .order('prompt_key')
    const all: PromptTemplate[] = [...(defaults || [])]
    // If a client is selected, also load client-specific overrides
    if (client?.id) {
      const { data: overrides } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .order('prompt_key')
      if (overrides) all.push(...overrides)
    }
    setPromptTemplates(all)
    setLoadingPrompts(false)
  }

  async function handleSavePrompt(promptId: string) {
    setSavingPrompt(true)
    const { error } = await supabase
      .from('prompt_templates')
      .update({
        system_prompt: editPromptText,
        updated_at: new Date().toISOString(),
        version: (promptTemplates.find(p => p.id === promptId)?.version || 1) + 1,
      })
      .eq('id', promptId)
    setSavingPrompt(false)
    if (error) {
      showToast('Failed to save prompt: ' + error.message)
    } else {
      showToast('Prompt saved')
      setEditingPromptId(null)
      setEditPromptText('')
      loadPromptTemplates()
    }
  }

  async function handleCustomizeForClient(prompt: PromptTemplate) {
    if (!client?.id) {
      showToast('Select a client first')
      return
    }
    setSavingPrompt(true)
    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        client_id: client.id,
        prompt_key: prompt.prompt_key,
        name: prompt.name,
        description: prompt.description,
        system_prompt: prompt.system_prompt,
        user_prompt_template: prompt.user_prompt_template,
        is_active: true,
        version: 1,
      })
      .select()
      .single()
    setSavingPrompt(false)
    if (error) {
      if (error.code === '23505') {
        showToast('Client-specific override already exists for this prompt')
      } else {
        showToast('Failed to create override: ' + error.message)
      }
    } else if (data) {
      showToast('Client override created — now edit it')
      loadPromptTemplates()
      setEditingPromptId(data.id)
      setEditPromptText(data.system_prompt)
    }
  }

  async function handleResetToDefault(prompt: PromptTemplate) {
    if (!confirm('Delete this client-specific override and revert to the agency default?')) return
    setSavingPrompt(true)
    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', prompt.id)
    setSavingPrompt(false)
    if (error) {
      showToast('Failed to reset: ' + error.message)
    } else {
      showToast('Reset to agency default')
      setEditingPromptId(null)
      loadPromptTemplates()
    }
  }

  function startEditPrompt(prompt: PromptTemplate) {
    if (editingPromptId === prompt.id) {
      // Toggle off
      setEditingPromptId(null)
      setEditPromptText('')
    } else {
      setEditingPromptId(prompt.id)
      setEditPromptText(prompt.system_prompt)
    }
  }

  function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
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
              <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                            title="Delete"
                            style={{ padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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

          {/* Brand Kit */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Brand Kit</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {canEdit && !editingBrandKit && (
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => {
                      const bk = client.brand_kit as Record<string, unknown> | null
                      setBkPrimary((bk?.primary_color as string) || '')
                      setBkSecondary((bk?.secondary_color as string) || '')
                      setBkAccent((bk?.accent_color as string) || '')
                      setBkBackground((bk?.background_color as string) || '')
                      setBkText((bk?.text_color as string) || '')
                      setBkHeadingFont((bk?.heading_font as string) || '')
                      setBkBodyFont((bk?.body_font as string) || '')
                      setEditingBrandKit(true)
                    }}>
                    Edit
                  </button>
                )}
                {canEdit && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={handleAnalyzeBrandKit}
                    disabled={analyzingBrandKit}
                  >
                    {analyzingBrandKit ? 'Analyzing...' : 'Extract from Website'}
                  </button>
                )}
              </div>
            </div>

            {(() => {
              const bk = client.brand_kit as Record<string, unknown> | null
              if (!bk?.primary_color && !editingBrandKit) {
                return (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No brand kit yet. Click &quot;Extract from Website&quot; to analyze colors and fonts from the client&apos;s site.
                  </div>
                )
              }

              if (editingBrandKit) {
                return (
                  <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                      {[
                        { label: 'Primary', value: bkPrimary, set: setBkPrimary },
                        { label: 'Secondary', value: bkSecondary, set: setBkSecondary },
                        { label: 'Accent / CTA', value: bkAccent, set: setBkAccent },
                        { label: 'Background', value: bkBackground, set: setBkBackground },
                        { label: 'Text', value: bkText, set: setBkText },
                      ].map(c => (
                        <div key={c.label} className="form-group">
                          <label className="form-label" style={{ fontSize: 11 }}>{c.label}</label>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="color"
                              value={c.value || '#000000'}
                              onChange={e => c.set(e.target.value)}
                              style={{ width: 36, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none' }}
                            />
                            <input
                              className="form-input"
                              type="text"
                              placeholder="#000000"
                              value={c.value}
                              onChange={e => c.set(e.target.value)}
                              style={{ fontSize: 12, fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>Heading Font</label>
                        <input className="form-input" value={bkHeadingFont} onChange={e => setBkHeadingFont(e.target.value)} placeholder="e.g. Inter, sans-serif" />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>Body Font</label>
                        <input className="form-input" value={bkBodyFont} onChange={e => setBkBodyFont(e.target.value)} placeholder="e.g. Inter, sans-serif" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={handleSaveBrandKit}>Save Brand Kit</button>
                      <button className="btn btn-secondary" onClick={() => setEditingBrandKit(false)}>Cancel</button>
                    </div>
                  </div>
                )
              }

              // Display mode
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    {[
                      { label: 'Primary', color: bk?.primary_color as string },
                      { label: 'Secondary', color: bk?.secondary_color as string },
                      { label: 'Accent', color: bk?.accent_color as string },
                      { label: 'Background', color: bk?.background_color as string },
                      { label: 'Text', color: bk?.text_color as string },
                    ].filter(c => c.color).map(c => (
                      <div key={c.label} style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 8,
                          background: c.color,
                          border: '2px solid var(--border)',
                          marginBottom: 4,
                        }} />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.label}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.color}</div>
                      </div>
                    ))}
                  </div>
                  {(bk?.heading_font || bk?.body_font) ? (
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                      {bk?.heading_font ? <span>Headings: <strong style={{ color: 'var(--text-primary)' }}>{String(bk.heading_font)}</strong></span> : null}
                      {bk?.body_font ? <span>Body: <strong style={{ color: 'var(--text-primary)' }}>{String(bk.body_font)}</strong></span> : null}
                    </div>
                  ) : null}
                  {/* Color preview bar */}
                  <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', display: 'flex', height: 8 }}>
                    {[bk?.primary_color, bk?.secondary_color, bk?.accent_color, bk?.background_color, bk?.text_color]
                      .filter(Boolean)
                      .map((color, i) => (
                        <div key={i} style={{ flex: 1, background: color as string }} />
                      ))}
                  </div>
                </div>
              )
            })()}
          </div>

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

          {/* Company Assets Section */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Company Assets</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                Extracted from website + manually added
              </span>
            </div>

            {loadingContent ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading assets...</div>
            ) : (
              <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
                {/* Testimonials */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Testimonials & Reviews</h4>
                    {canEdit && (
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => { setAddingContentType('testimonial'); setNewContentForm({}) }}>
                        + Add
                      </button>
                    )}
                  </div>
                  {addingContentType === 'testimonial' && (
                    <div style={{ padding: 12, background: 'var(--surface-hover)', borderRadius: 8, marginBottom: 8, display: 'grid', gap: 8 }}>
                      <input className="form-input" placeholder="Person name" value={newContentForm.person_name || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, person_name: e.target.value }))} />
                      <input className="form-input" placeholder="Role / Location (e.g. Homeowner, Orlando)" value={newContentForm.person_role || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, person_role: e.target.value }))} />
                      <textarea className="form-textarea" rows={3} placeholder="Testimonial quote (copy verbatim)" value={newContentForm.body || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, body: e.target.value }))} />
                      <select className="form-input" value={newContentForm.rating || ''} onChange={e => setNewContentForm(p => ({ ...p, rating: e.target.value }))}>
                        <option value="">Rating (optional)</option>
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="3">3 Stars</option>
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => handleAddContent('testimonial')}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setAddingContentType(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {clientContent.filter(c => c.content_type === 'testimonial' || c.content_type === 'review').length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                      No testimonials yet. Click &quot;Analyze Business&quot; to extract from website, or add manually.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {clientContent.filter(c => c.content_type === 'testimonial' || c.content_type === 'review').map(t => (
                        <div key={t.id} style={{ padding: 12, background: 'var(--surface-hover)', borderRadius: 8, position: 'relative' }}>
                          <div style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{t.body}&rdquo;</div>
                          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{t.person_name}</span>
                              {t.person_role && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> — {t.person_role}</span>}
                              {t.rating && <span style={{ marginLeft: 8, color: '#f59e0b' }}>{'★'.repeat(t.rating)}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.source}</span>
                              {canEdit && (
                                <button onClick={() => handleDeleteContent(t.id)} title="Delete"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Stats & Metrics</h4>
                    {canEdit && (
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => { setAddingContentType('stat'); setNewContentForm({}) }}>
                        + Add
                      </button>
                    )}
                  </div>
                  {addingContentType === 'stat' && (
                    <div style={{ padding: 12, background: 'var(--surface-hover)', borderRadius: 8, marginBottom: 8, display: 'grid', gap: 8 }}>
                      <input className="form-input" placeholder='Stat value (e.g. "2,100+", "4.9/5.0")' value={newContentForm.stat_value || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, stat_value: e.target.value }))} />
                      <input className="form-input" placeholder='Label (e.g. "Happy Clients", "Years Experience")' value={newContentForm.stat_label || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, stat_label: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => handleAddContent('stat')}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setAddingContentType(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {clientContent.filter(c => c.content_type === 'stat').length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No stats yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {clientContent.filter(c => c.content_type === 'stat').map(s => (
                        <div key={s.id} style={{ padding: '8px 16px', background: 'var(--surface-hover)', borderRadius: 8, textAlign: 'center', position: 'relative', minWidth: 120 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{s.stat_value}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.stat_label}</div>
                          {canEdit && (
                            <button onClick={() => handleDeleteContent(s.id)} title="Delete"
                              style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team Members */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Team Members</h4>
                    {canEdit && (
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => { setAddingContentType('team_member'); setNewContentForm({}) }}>
                        + Add
                      </button>
                    )}
                  </div>
                  {addingContentType === 'team_member' && (
                    <div style={{ padding: 12, background: 'var(--surface-hover)', borderRadius: 8, marginBottom: 8, display: 'grid', gap: 8 }}>
                      <input className="form-input" placeholder="Full name" value={newContentForm.person_name || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, person_name: e.target.value }))} />
                      <input className="form-input" placeholder="Title / Role" value={newContentForm.person_role || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, person_role: e.target.value }))} />
                      <textarea className="form-textarea" rows={2} placeholder="Short bio (optional)" value={newContentForm.body || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, body: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => handleAddContent('team_member')}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setAddingContentType(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {clientContent.filter(c => c.content_type === 'team_member').length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No team members yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {clientContent.filter(c => c.content_type === 'team_member').map(m => (
                        <div key={m.id} style={{ padding: 10, background: 'var(--surface-hover)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{m.person_name}</span>
                            {m.person_role && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> — {m.person_role}</span>}
                            {m.body && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.body}</div>}
                          </div>
                          {canEdit && (
                            <button onClick={() => handleDeleteContent(m.id)} title="Delete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Certifications & Awards */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Certifications & Awards</h4>
                    {canEdit && (
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => { setAddingContentType('certification'); setNewContentForm({}) }}>
                        + Add
                      </button>
                    )}
                  </div>
                  {addingContentType === 'certification' && (
                    <div style={{ padding: 12, background: 'var(--surface-hover)', borderRadius: 8, marginBottom: 8, display: 'grid', gap: 8 }}>
                      <input className="form-input" placeholder="Certification or award name" value={newContentForm.title || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, title: e.target.value }))} />
                      <input className="form-input" placeholder="Details (optional)" value={newContentForm.body || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, body: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => handleAddContent('certification')}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setAddingContentType(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {clientContent.filter(c => c.content_type === 'certification' || c.content_type === 'award').length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No certifications or awards yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {clientContent.filter(c => c.content_type === 'certification' || c.content_type === 'award').map(c => (
                        <div key={c.id} style={{ padding: '6px 12px', background: 'var(--surface-hover)', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{c.content_type === 'award' ? '🏆' : '✓'} {c.title}</span>
                          {canEdit && (
                            <button onClick={() => handleDeleteContent(c.id)} title="Delete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* FAQs */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>FAQs</h4>
                    {canEdit && (
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => { setAddingContentType('faq'); setNewContentForm({}) }}>
                        + Add
                      </button>
                    )}
                  </div>
                  {addingContentType === 'faq' && (
                    <div style={{ padding: 12, background: 'var(--surface-hover)', borderRadius: 8, marginBottom: 8, display: 'grid', gap: 8 }}>
                      <input className="form-input" placeholder="Question" value={newContentForm.title || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, title: e.target.value }))} />
                      <textarea className="form-textarea" rows={3} placeholder="Answer" value={newContentForm.body || ''}
                        onChange={e => setNewContentForm(p => ({ ...p, body: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => handleAddContent('faq')}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setAddingContentType(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {clientContent.filter(c => c.content_type === 'faq').length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No FAQs yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {clientContent.filter(c => c.content_type === 'faq').map(f => (
                        <div key={f.id} style={{ padding: 10, background: 'var(--surface-hover)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{f.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{f.body}</div>
                          </div>
                          {canEdit && (
                            <button onClick={() => handleDeleteContent(f.id)} title="Delete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Trustpilot Widget */}
                {(() => {
                  const meta = client?.metadata as Record<string, Record<string, string>> | undefined
                  const tp = meta?.trustpilot
                  if (!tp) return null
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Trustpilot Integration</h4>
                        <a href={tp.reviewUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: 'var(--accent)' }}>
                          View on Trustpilot
                        </a>
                      </div>
                      <div style={{ padding: 12, background: 'var(--surface-hover)', borderRadius: 8, display: 'grid', gap: 10 }}>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Business ID: </span>
                          <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>{tp.businessUnitId}</code>
                        </div>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Domain: </span>
                          <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>{tp.domain}</code>
                        </div>
                        <details style={{ fontSize: 12 }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--accent)', marginBottom: 6 }}>Widget Snippets (click to expand)</summary>
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Mini Rating Bar</div>
                              <pre style={{ fontSize: 10, background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{tp.miniWidget}</pre>
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Review Carousel</div>
                              <pre style={{ fontSize: 10, background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{tp.carouselWidget}</pre>
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Review Grid</div>
                              <pre style={{ fontSize: 10, background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{tp.gridWidget}</pre>
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Script Tag (add to &lt;head&gt;)</div>
                              <pre style={{ fontSize: 10, background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{tp.scriptTag}</pre>
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  )
                })() as React.ReactNode}
              </div>
            )}
          </div>

          {/* Review Profiles */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Review Profiles</span>
              {editing && (
                <button className="btn btn-secondary" onClick={() => setReviewSites([...reviewSites, { platform: 'google', url: '', rating: '', review_count: '', enabled: true }])}>
                  Add Review Site
                </button>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              Add review profile URLs to show trust badges on landing pages.
            </div>
            <div style={{ marginTop: 16 }}>
              {editing ? (
                <>
                  {reviewSites.map((rs, index) => (
                    <div key={index} style={{ marginBottom: 12, padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                      <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 11 }}>Platform</label>
                          <select
                            className="form-input"
                            value={rs.platform}
                            onChange={(e) => {
                              const updated = [...reviewSites]
                              updated[index] = { ...updated[index], platform: e.target.value }
                              setReviewSites(updated)
                            }}
                          >
                            <option value="google">Google</option>
                            <option value="yelp">Yelp</option>
                            <option value="bbb">BBB</option>
                            <option value="facebook">Facebook</option>
                            <option value="trustpilot">Trustpilot</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11 }}>Profile URL</label>
                          <input
                            className="form-input"
                            type="url"
                            placeholder={rs.platform === 'google' ? 'https://g.page/... or Google Maps URL' : rs.platform === 'yelp' ? 'https://yelp.com/biz/...' : rs.platform === 'bbb' ? 'https://bbb.org/...' : rs.platform === 'facebook' ? 'https://facebook.com/.../reviews' : 'https://...'}
                            value={rs.url}
                            onChange={(e) => {
                              const updated = [...reviewSites]
                              updated[index] = { ...updated[index], url: e.target.value }
                              setReviewSites(updated)
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr auto', gap: 10, alignItems: 'end' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 11 }}>Rating</label>
                          <input
                            className="form-input"
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            placeholder="4.8"
                            value={rs.rating}
                            onChange={(e) => {
                              const updated = [...reviewSites]
                              updated[index] = { ...updated[index], rating: e.target.value }
                              setReviewSites(updated)
                            }}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11 }}>Reviews</label>
                          <input
                            className="form-input"
                            type="number"
                            placeholder="150"
                            value={rs.review_count}
                            onChange={(e) => {
                              const updated = [...reviewSites]
                              updated[index] = { ...updated[index], review_count: e.target.value }
                              setReviewSites(updated)
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={rs.enabled}
                              onChange={(e) => {
                                const updated = [...reviewSites]
                                updated[index] = { ...updated[index], enabled: e.target.checked }
                                setReviewSites(updated)
                              }}
                            />
                            Show on pages
                          </label>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 13, padding: '6px 12px' }}
                          onClick={() => setReviewSites(reviewSites.filter((_, i) => i !== index))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {reviewSites.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      No review sites added yet. Click &quot;Add Review Site&quot; to add Google, Yelp, BBB, or other review profiles.
                    </div>
                  )}
                </>
              ) : (() => {
                const savedSites = (client?.metadata as Record<string, unknown>)?.review_sites as Array<Record<string, unknown>> | undefined
                if (!savedSites || savedSites.length === 0) {
                  return (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      No review profiles configured. Click Edit to add Google, Yelp, BBB, or other review site URLs.
                    </div>
                  )
                }
                return (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {savedSites.map((rs, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: rs.platform === 'google' ? '#fbbc04' : rs.platform === 'yelp' ? '#d32323' : rs.platform === 'bbb' ? '#005a78' : rs.platform === 'facebook' ? '#1877f2' : 'var(--text-primary)', textTransform: 'uppercase', minWidth: 70 }}>
                          {String(rs.platform)}
                        </span>
                        <a href={String(rs.url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', flex: 1, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {String(rs.url)}
                        </a>
                        {!!rs.rating && <span style={{ fontSize: 12, fontWeight: 600 }}>{String(rs.rating)}</span>}
                        {!!rs.review_count && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{String(rs.review_count)} reviews</span>}
                        {rs.enabled === false && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>Hidden</span>}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Re-analyze Section */}
          {canEdit && (
            <div className="card">
              <div className="card-title">Re-analyze Business</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, marginBottom: 12 }}>
                Re-scrapes the website to extract testimonials, stats, team, and other assets. Add new notes below if available, or just click to re-analyze with the current URL.
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
                    disabled={reanalyzing}
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

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      setPasswordMessage('Please fill in both password fields.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordMessage('Password must be at least 8 characters.')
      return
    }
    setSavingPassword(true)
    setPasswordMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordMessage('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMessage('Failed to update password: ' + (err as Error).message)
    } finally {
      setSavingPassword(false)
    }
  }

  function renderProfileTab() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="funnel-section-card">
          <div className="funnel-section-header">
            <h3>My Profile</h3>
          </div>
          <div style={{ padding: 24 }}>
            <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
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
              {!isClientRole && (
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <div style={{ padding: '8px 0' }}>
                    <span className="tag" style={{ fontSize: 13 }}>{profile?.role || 'admin'}</span>
                  </div>
                </div>
              )}
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

        {/* Password Change */}
        <div className="funnel-section-card">
          <div className="funnel-section-header">
            <h3>Change Password</h3>
          </div>
          <div style={{ padding: 24 }}>
            <div className="grid-2col-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            {passwordMessage && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                background: passwordMessage.includes('success') ? 'var(--success-muted)' : 'var(--danger-muted)',
                color: passwordMessage.includes('success') ? 'var(--success)' : 'var(--danger)',
              }}>
                {passwordMessage}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={handleChangePassword}
              disabled={savingPassword}
              style={{ marginTop: 12 }}
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
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
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <span className="tag" style={{ fontSize: 11 }}>{member.role}</span>
                    {member.status === 'disabled' && (
                      <span className="tag" style={{ fontSize: 11, background: '#ef4444' }}>disabled</span>
                    )}
                    {member.role !== 'admin' && (() => {
                      const memberAssignments = assignments.filter(a => a.user_id === member.id)
                      const assignedClients = memberAssignments
                        .map(a => allClients.find(c => c.id === a.client_id))
                        .filter(Boolean)
                      if (assignedClients.length === 0) {
                        return <span style={{ fontSize: 11, color: 'var(--warning)' }}>No clients assigned</span>
                      }
                      return assignedClients.map(c => (
                        <span key={c!.id} className="tag" style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent)' }}>
                          {c!.name}
                        </span>
                      ))
                    })()}
                  </div>
                </div>
                {member.id !== user?.id && (
                  <div className="team-actions-responsive" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
                      onChange={e => {
                        setInviteRole(e.target.value as UserRole)
                        setInviteClientIds([])
                      }}
                    >
                      <option value="admin">Admin (full access to all clients)</option>
                      <option value="team_editor">Team Editor (edit assigned clients)</option>
                      <option value="team_viewer">Team Viewer (read-only)</option>
                      <option value="client">Client (access to their own account)</option>
                    </select>
                  </div>

                  {/* Client assignment — required for non-admin roles */}
                  {inviteRole !== 'admin' && (
                    <div className="form-group">
                      <label className="form-label">
                        {inviteRole === 'client' ? 'Assign to Client *' : 'Assign to Clients *'}
                      </label>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                        {inviteRole === 'client'
                          ? 'Select which client account this person belongs to'
                          : 'Select which client accounts this person can access'}
                      </p>
                      {allClients.length === 0 ? (
                        <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                          No clients created yet. Create a client first in Business Overview.
                        </div>
                      ) : (
                        <div style={{
                          maxHeight: 200, overflowY: 'auto',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        }}>
                          {allClients.map(c => {
                            const isSelected = inviteClientIds.includes(c.id)
                            return (
                              <label
                                key={c.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 12px', cursor: 'pointer',
                                  borderBottom: '1px solid var(--border)',
                                  background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                }}
                              >
                                <input
                                  type={inviteRole === 'client' ? 'radio' : 'checkbox'}
                                  name="invite-client"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (inviteRole === 'client') {
                                      setInviteClientIds([c.id])
                                    } else {
                                      setInviteClientIds(prev =>
                                        isSelected
                                          ? prev.filter(id => id !== c.id)
                                          : [...prev, c.id]
                                      )
                                    }
                                  }}
                                  style={{ accentColor: 'var(--accent)' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</div>
                                  {c.website && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.website}</div>}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowInviteForm(false); setInviteClientIds([]) }}>Cancel</button>
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
  // Phone Numbers tab render
  // ═══════════════════════════════════════

  function renderPhoneNumbersTab() {
    if (!client) {
      return (
        <div className="funnel-section-card">
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Select a client to manage phone numbers.
          </div>
        </div>
      )
    }

    async function handleAddPhone() {
      if (!client?.id || !phoneNumber.trim()) return
      setSavingPhone(true)
      try {
        // If setting as default, unset other defaults first
        if (phoneIsDefault) {
          await supabase
            .from('client_phone_numbers')
            .update({ is_default: false })
            .eq('client_id', client.id)
        }
        const { error } = await supabase.from('client_phone_numbers').insert({
          client_id: client.id,
          phone_number: phoneNumber.trim(),
          label: phoneLabel.trim() || 'Main',
          notes: phoneNotes.trim() || null,
          is_default: phoneIsDefault || clientPhoneNumbers.length === 0,
        })
        if (error) throw error
        showToast('Phone number added')
        setPhoneNumber('')
        setPhoneLabel('Main')
        setPhoneNotes('')
        setPhoneIsDefault(false)
        setShowPhoneForm(false)
        await refreshClientPhoneNumbers(client.id)
      } catch (err: unknown) {
        showToast(`Failed to add phone number: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setSavingPhone(false)
      }
    }

    async function handleUpdatePhone(phone: ClientPhoneNumber) {
      if (!client?.id || !editPhoneNumber.trim()) return
      setSavingPhone(true)
      try {
        if (editPhoneIsDefault && !phone.is_default) {
          await supabase
            .from('client_phone_numbers')
            .update({ is_default: false })
            .eq('client_id', client.id)
        }
        const { error } = await supabase.from('client_phone_numbers').update({
          phone_number: editPhoneNumber.trim(),
          label: editPhoneLabel.trim() || 'Main',
          notes: editPhoneNotes.trim() || null,
          is_default: editPhoneIsDefault,
        }).eq('id', phone.id)
        if (error) throw error
        showToast('Phone number updated')
        setEditingPhoneId(null)
        await refreshClientPhoneNumbers(client.id)
      } catch (err: unknown) {
        showToast(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setSavingPhone(false)
      }
    }

    async function handleDeletePhone(id: string) {
      if (!client?.id) return
      setSavingPhone(true)
      try {
        const { error } = await supabase.from('client_phone_numbers').delete().eq('id', id)
        if (error) throw error
        showToast('Phone number deleted')
        setDeletingPhoneId(null)
        await refreshClientPhoneNumbers(client.id)
      } catch (err: unknown) {
        showToast(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setSavingPhone(false)
      }
    }

    async function handleSetDefault(id: string) {
      if (!client?.id) return
      try {
        await supabase
          .from('client_phone_numbers')
          .update({ is_default: false })
          .eq('client_id', client.id)
        const { error } = await supabase
          .from('client_phone_numbers')
          .update({ is_default: true })
          .eq('id', id)
        if (error) throw error
        showToast('Default phone number updated')
        await refreshClientPhoneNumbers(client.id)
      } catch (err: unknown) {
        showToast(`Failed to set default: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    function startEditing(phone: ClientPhoneNumber) {
      setEditingPhoneId(phone.id)
      setEditPhoneNumber(phone.phone_number)
      setEditPhoneLabel(phone.label)
      setEditPhoneNotes(phone.notes || '')
      setEditPhoneIsDefault(phone.is_default)
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="funnel-section-card">
          <div className="funnel-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Phone Numbers</h3>
            {!showPhoneForm && (
              <button className="btn btn-primary" onClick={() => setShowPhoneForm(true)} style={{ fontSize: 13, padding: '6px 14px' }}>
                + Add Phone Number
              </button>
            )}
          </div>
          <div style={{ padding: 24 }}>
            {/* Add form */}
            {showPhoneForm && (
              <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className="form-input"
                      placeholder="(555) 123-4567"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Label</label>
                    <input
                      className="form-input"
                      placeholder="Main"
                      value={phoneLabel}
                      onChange={e => setPhoneLabel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: 12, maxWidth: 600 }}>
                  <label className="form-label">Notes (optional)</label>
                  <textarea
                    className="form-input"
                    placeholder="e.g., Hours: Mon-Fri 9-5"
                    value={phoneNotes}
                    onChange={e => setPhoneNotes(e.target.value)}
                    rows={2}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={phoneIsDefault}
                    onChange={e => setPhoneIsDefault(e.target.checked)}
                  />
                  Set as default phone number
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={handleAddPhone} disabled={savingPhone || !phoneNumber.trim()}>
                    {savingPhone ? 'Adding...' : 'Add Phone Number'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setShowPhoneForm(false); setPhoneNumber(''); setPhoneLabel('Main'); setPhoneNotes(''); setPhoneIsDefault(false) }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Phone list */}
            {clientPhoneNumbers.length === 0 && !showPhoneForm ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                No phone numbers added yet. Click &quot;+ Add Phone Number&quot; to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {clientPhoneNumbers.map(phone => (
                  <div key={phone.id} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                    {editingPhoneId === phone.id ? (
                      /* Inline edit mode */
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
                          <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input
                              className="form-input"
                              value={editPhoneNumber}
                              onChange={e => setEditPhoneNumber(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Label</label>
                            <input
                              className="form-input"
                              value={editPhoneLabel}
                              onChange={e => setEditPhoneLabel(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginTop: 12, maxWidth: 600 }}>
                          <label className="form-label">Notes</label>
                          <textarea
                            className="form-input"
                            value={editPhoneNotes}
                            onChange={e => setEditPhoneNotes(e.target.value)}
                            rows={2}
                            style={{ resize: 'vertical' }}
                          />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editPhoneIsDefault}
                            onChange={e => setEditPhoneIsDefault(e.target.checked)}
                          />
                          Default phone number
                        </label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                          <button className="btn btn-primary" onClick={() => handleUpdatePhone(phone)} disabled={savingPhone || !editPhoneNumber.trim()}>
                            {savingPhone ? 'Saving...' : 'Save'}
                          </button>
                          <button className="btn btn-secondary" onClick={() => setEditingPhoneId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : deletingPhoneId === phone.id ? (
                      /* Inline delete confirmation */
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--danger)', fontSize: 14 }}>
                          Delete this phone number?
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn"
                            style={{ background: 'var(--danger)', color: '#fff', fontSize: 13, padding: '6px 14px' }}
                            onClick={() => handleDeletePhone(phone.id)}
                            disabled={savingPhone}
                          >
                            {savingPhone ? 'Deleting...' : 'Yes, Delete'}
                          </button>
                          <button className="btn btn-secondary" onClick={() => setDeletingPhoneId(null)} style={{ fontSize: 13, padding: '6px 14px' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{phone.phone_number}</span>
                            <span className="tag" style={{ fontSize: 11 }}>{phone.label}</span>
                            {phone.is_default && (
                              <span className="tag" style={{ fontSize: 11, background: 'var(--success-muted)', color: 'var(--success)' }}>Default</span>
                            )}
                          </div>
                          {phone.notes && (
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{phone.notes}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!phone.is_default && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleSetDefault(phone.id)}
                              style={{ fontSize: 12, padding: '4px 10px' }}
                              title="Set as default"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            className="btn btn-secondary"
                            onClick={() => startEditing(phone)}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setDeletingPhoneId(phone.id)}
                            style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // Phone Numbers tab — read-only for clients
  // ═══════════════════════════════════════

  function renderPhoneNumbersReadOnly() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="funnel-section-card">
          <div className="funnel-section-header">
            <h3>Phone Numbers</h3>
          </div>
          <div style={{ padding: 24 }}>
            {clientPhoneNumbers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                No phone numbers have been set up yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {clientPhoneNumbers.map(phone => (
                  <div key={phone.id} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{phone.phone_number}</span>
                      <span className="tag" style={{ fontSize: 11 }}>{phone.label}</span>
                      {phone.is_default && (
                        <span className="tag" style={{ fontSize: 11, background: 'var(--success-muted)', color: 'var(--success)' }}>Default</span>
                      )}
                    </div>
                    {phone.notes && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{phone.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // Prompts tab render
  // ═══════════════════════════════════════

  function renderPromptsTab() {
    // Group prompts: client overrides first, then agency defaults
    // For each prompt_key, show the client override if it exists, otherwise the agency default
    const agencyDefaults = promptTemplates.filter(p => p.client_id === null)
    const clientOverrides = promptTemplates.filter(p => p.client_id !== null)

    // Build display list: client overrides first (if client selected), then agency defaults not overridden
    const overriddenKeys = new Set(clientOverrides.map(p => p.prompt_key))
    const displayList: { prompt: PromptTemplate; isOverride: boolean; hasOverride: boolean }[] = []

    // Client overrides at top
    for (const p of clientOverrides) {
      displayList.push({ prompt: p, isOverride: true, hasOverride: true })
    }
    // Agency defaults (mark if they have a client override)
    for (const p of agencyDefaults) {
      displayList.push({ prompt: p, isOverride: false, hasOverride: overriddenKeys.has(p.prompt_key) })
    }

    const PLACEHOLDER_LEGEND: { key: string; description: string }[] = [
      { key: '{{avatar_name}}', description: 'Target avatar name' },
      { key: '{{offer_name}}', description: 'Offer name' },
      { key: '{{business_summary}}', description: 'Client business summary' },
      { key: '{{template_slug}}', description: 'Landing page template ID' },
      { key: '{{business_context}}', description: 'Full business context block' },
      { key: '{{avatar_context}}', description: 'Full avatar details block' },
      { key: '{{offer_context}}', description: 'Full offer details block' },
    ]

    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Manage the AI prompts used for content generation.
            {client ? ` Showing prompts for ${client.name} with agency defaults.` : ' Showing agency-wide default prompts.'}
          </p>

          {/* Placeholder legend */}
          <details style={{ marginBottom: 16 }}>
            <summary style={{
              fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
            }}>
              Available placeholder variables
            </summary>
            <div style={{
              marginTop: 8, padding: 12, background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 8, fontSize: 12,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
                {PLACEHOLDER_LEGEND.map(p => (
                  <React.Fragment key={p.key}>
                    <code style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{p.key}</code>
                    <span style={{ color: 'var(--text-secondary)' }}>{p.description}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </details>
        </div>

        {loadingPrompts ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading prompts...</div>
        ) : displayList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No prompt templates found. Push migration 022 to create the default prompts.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {displayList.map(({ prompt, isOverride, hasOverride }) => {
              const isEditing = editingPromptId === prompt.id
              // If this is an agency default that has a client override, dim it
              const isDimmed = !isOverride && hasOverride && client

              return (
                <div
                  key={prompt.id}
                  className="funnel-section-card"
                  style={isDimmed ? { opacity: 0.5 } : undefined}
                >
                  <div className="funnel-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{prompt.name}</h3>
                      {prompt.description && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                          {prompt.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                        background: isOverride ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                        color: isOverride ? '#3b82f6' : '#22c55e',
                      }}>
                        {isOverride ? 'Client Override' : 'Agency Default'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        v{prompt.version}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '12px 20px 16px' }}>
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: isEditing ? 12 : 0, flexWrap: 'wrap' }}>
                      <button
                        className={`btn ${isEditing ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ fontSize: 12, padding: '6px 14px' }}
                        onClick={() => startEditPrompt(prompt)}
                      >
                        {isEditing ? 'Collapse' : 'Edit'}
                      </button>

                      {!isOverride && client && !hasOverride && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '6px 14px' }}
                          onClick={() => handleCustomizeForClient(prompt)}
                          disabled={savingPrompt}
                        >
                          Customize for {client.name}
                        </button>
                      )}

                      {isOverride && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '6px 14px', color: '#ef4444' }}
                          onClick={() => handleResetToDefault(prompt)}
                          disabled={savingPrompt}
                        >
                          Reset to Default
                        </button>
                      )}

                      {isDimmed && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                          Overridden by client-specific prompt above
                        </span>
                      )}
                    </div>

                    {/* Editor area */}
                    {isEditing && (
                      <div>
                        <textarea
                          value={editPromptText}
                          onChange={e => setEditPromptText(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: 360,
                            padding: 16,
                            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
                            fontSize: 12,
                            lineHeight: 1.6,
                            background: 'var(--bg-input)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            resize: 'vertical',
                            outline: 'none',
                          }}
                          onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                          spellCheck={false}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: 12, padding: '6px 16px' }}
                              onClick={() => handleSavePrompt(prompt.id)}
                              disabled={savingPrompt || editPromptText === prompt.system_prompt}
                            >
                              {savingPrompt ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 12, padding: '6px 16px' }}
                              onClick={() => { setEditingPromptId(null); setEditPromptText('') }}
                            >
                              Cancel
                            </button>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Last updated: {formatTimeAgo(prompt.updated_at)}
                          </span>
                        </div>
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
        {!isClientRole && (
          <>
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
          </>
        )}
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
            <button
              className={`funnel-tab ${activeTab === 'prompts' ? 'funnel-tab-active' : ''}`}
              onClick={() => setActiveTab('prompts')}
            >
              Prompts
            </button>
          </>
        )}
        <button
          className={`funnel-tab ${activeTab === 'phones' ? 'funnel-tab-active' : ''}`}
          onClick={() => setActiveTab('phones')}
        >
          Phone Numbers
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'business' && !isClientRole && renderBusinessTab()}
      {activeTab === 'intake' && !isClientRole && renderIntakeTab()}
      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'team' && isAdmin && renderTeamTab()}
      {activeTab === 'clients' && isAdmin && renderClientAccessTab()}
      {activeTab === 'prompts' && isAdmin && renderPromptsTab()}
      {activeTab === 'phones' && (isClientRole ? renderPhoneNumbersReadOnly() : renderPhoneNumbersTab())}
    </div>
  )
}
