'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Client, Avatar, Offer, IntakeQuestion, CopyComponent, FunnelInstance, CompetitorIntel, LandingPage, MediaAsset, BrandKitRecord, PageTemplate, PublishedPage, PromptTemplate, ClientTemplate, QAReview, Form, FormWebhook, ClientPhoneNumber, UserRole, AdComponent, Ad, BannerAsset } from '@/types/database'

interface AppState {
  client: Client | null
  avatars: Avatar[]
  offers: Offer[]
  intakeQuestions: IntakeQuestion[]
  funnelInstances: FunnelInstance[]
  copyComponents: CopyComponent[]
  competitors: CompetitorIntel[]
  landingPages: LandingPage[]
  publishedPages: PublishedPage[]
  mediaAssets: MediaAsset[]
  brandKit: BrandKitRecord | null
  pageTemplates: PageTemplate[]
  promptTemplates: PromptTemplate[]
  clientTemplates: ClientTemplate[]
  qaReviews: QAReview[]
  forms: Form[]
  formWebhooks: FormWebhook[]
  clientPhoneNumbers: ClientPhoneNumber[]
  adComponents: AdComponent[]
  ads: Ad[]
  bannerAssets: BannerAsset[]
  loading: boolean
  error: string | null
  userRole: UserRole
}

interface AppStore extends AppState {
  allClients: Client[]
  /** True if user can create/edit/generate content (admin, team_editor) */
  canEdit: boolean
  /** True if user is a client with limited access */
  isClientRole: boolean
  setClient: (client: Client | null) => void
  setAvatars: (avatars: Avatar[]) => void
  setOffers: (offers: Offer[]) => void
  setIntakeQuestions: (questions: IntakeQuestion[]) => void
  setCopyComponents: (components: CopyComponent[]) => void
  setFunnelInstances: (instances: FunnelInstance[]) => void
  setCompetitors: (competitors: CompetitorIntel[]) => void
  setLandingPages: (pages: LandingPage[]) => void
  setPublishedPages: (pages: PublishedPage[]) => void
  setMediaAssets: (assets: MediaAsset[]) => void
  setBrandKit: (kit: BrandKitRecord | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  loadAllClients: () => Promise<Client[]>
  loadClientData: (clientId: string) => Promise<void>
  switchClient: (clientId: string) => Promise<void>
  createClient: (name: string, website: string) => Promise<Client | null>
  updateAvatar: (id: string, updates: Partial<Avatar>) => void
  updateOffer: (id: string, updates: Partial<Offer>) => void
  refreshAvatars: (clientId: string) => Promise<void>
  refreshOffers: (clientId: string) => Promise<void>
  refreshIntake: (clientId: string) => Promise<void>
  refreshCopyComponents: (clientId: string) => Promise<void>
  refreshFunnelInstances: (clientId: string) => Promise<void>
  refreshLandingPages: (clientId: string) => Promise<void>
  refreshPublishedPages: (clientId: string) => Promise<void>
  refreshMediaAssets: (clientId: string) => Promise<void>
  refreshBrandKit: (clientId: string) => Promise<void>
  refreshPromptTemplates: (clientId?: string) => Promise<void>
  refreshClientTemplates: (clientId: string) => Promise<void>
  refreshQAReviews: (clientId: string) => Promise<void>
  refreshForms: (clientId: string) => Promise<void>
  refreshFormWebhooks: (clientId: string) => Promise<void>
  refreshClientPhoneNumbers: (clientId: string) => Promise<void>
  refreshAdComponents: (clientId: string) => Promise<void>
  refreshAds: (clientId: string) => Promise<void>
  refreshBannerAssets: (clientId: string) => Promise<void>
  /** Refresh just the client record from DB (e.g. after logo upload or brand kit analysis) */
  refreshClient: (clientId: string) => Promise<void>
  setUserRole: (role: UserRole) => void
}

const AppContext = createContext<AppStore | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [allClients, setAllClients] = useState<Client[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestion[]>([])
  const [funnelInstances, setFunnelInstances] = useState<FunnelInstance[]>([])
  const [copyComponents, setCopyComponents] = useState<CopyComponent[]>([])
  const [competitors, setCompetitors] = useState<CompetitorIntel[]>([])
  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [publishedPages, setPublishedPages] = useState<PublishedPage[]>([])
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [brandKit, setBrandKit] = useState<BrandKitRecord | null>(null)
  const [pageTemplates, setPageTemplates] = useState<PageTemplate[]>([])
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [clientTemplates, setClientTemplates] = useState<ClientTemplate[]>([])
  const [qaReviews, setQAReviews] = useState<QAReview[]>([])
  const [forms, setForms] = useState<Form[]>([])
  const [formWebhooks, setFormWebhooks] = useState<FormWebhook[]>([])
  const [clientPhoneNumbers, setClientPhoneNumbers] = useState<ClientPhoneNumber[]>([])
  const [adComponents, setAdComponents] = useState<AdComponent[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [bannerAssets, setBannerAssets] = useState<BannerAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('admin')
  const canEdit = userRole === 'admin' || userRole === 'team_editor'
  const isClientRole = userRole === 'client'

  // Persist selected client ID to localStorage so it survives page navigations
  const STORAGE_KEY = 'lbh_selected_client_id'

  const saveClientId = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch { /* SSR or storage unavailable */ }
  }, [])

  const getSavedClientId = useCallback(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  }, [])

  const loadAllClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setAllClients(data || [])
    return data || []
  }, [])

  const loadClientData = useCallback(async (clientId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: clientData },
        { data: avatarData },
        { data: offerData },
        { data: intakeData },
        { data: funnelData },
        { data: copyData },
        { data: competitorData },
        { data: landingPageData },
        { data: publishedPageData },
        { data: assetData },
        { data: brandKitData },
        { data: templateData },
        { data: clientTemplateData },
        { data: qaReviewData },
        { data: formsData },
        { data: formWebhooksData },
        { data: phoneNumberData },
        { data: adComponentData },
        { data: adData },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('avatars').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('offers').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('intake_questions').select('*').eq('client_id', clientId).order('sort_order'),
        supabase.from('funnel_instances').select('*').eq('client_id', clientId).order('generated_at'),
        supabase.from('copy_components').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('competitor_intel').select('*').eq('client_id', clientId).order('captured_at'),
        supabase.from('landing_pages').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('published_pages').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('media_assets').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('brand_kits').select('*').eq('client_id', clientId).single(),
        supabase.from('page_templates').select('*').eq('is_active', true).order('created_at'),
        supabase.from('client_templates').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('qa_reviews').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('forms').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('form_webhooks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('client_phone_numbers').select('*').eq('client_id', clientId).order('is_default', { ascending: false }),
        supabase.from('ad_components').select('*').eq('client_id', clientId).order('per_client_seq'),
        supabase.from('ads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      ])
      if (clientData) setClient(clientData)
      setAvatars(avatarData || [])
      setOffers(offerData || [])
      setIntakeQuestions(intakeData || [])
      setFunnelInstances(funnelData || [])
      setCopyComponents(copyData || [])
      setCompetitors(competitorData || [])
      setLandingPages(landingPageData || [])
      setPublishedPages(publishedPageData || [])
      setMediaAssets(assetData || [])
      setBrandKit(brandKitData || null)
      setPageTemplates(templateData || [])
      setClientTemplates(clientTemplateData || [])
      setQAReviews(qaReviewData || [])
      setForms(formsData || [])
      setFormWebhooks(formWebhooksData || [])
      setClientPhoneNumbers(phoneNumberData || [])
      setAdComponents(adComponentData || [])
      setAds(adData || [])
      setBannerAssets([])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const switchClient = useCallback(async (clientId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: clientData },
        { data: avatarData },
        { data: offerData },
        { data: intakeData },
        { data: funnelData },
        { data: copyData },
        { data: competitorData },
        { data: landingPageData },
        { data: publishedPageData },
        { data: assetData },
        { data: brandKitData },
        { data: templateData },
        { data: clientTemplateData },
        { data: qaReviewData },
        { data: formsData },
        { data: formWebhooksData },
        { data: phoneNumberData },
        { data: adComponentData },
        { data: adData },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('avatars').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('offers').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('intake_questions').select('*').eq('client_id', clientId).order('sort_order'),
        supabase.from('funnel_instances').select('*').eq('client_id', clientId).order('generated_at'),
        supabase.from('copy_components').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('competitor_intel').select('*').eq('client_id', clientId).order('captured_at'),
        supabase.from('landing_pages').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('published_pages').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('media_assets').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('brand_kits').select('*').eq('client_id', clientId).single(),
        supabase.from('page_templates').select('*').eq('is_active', true).order('created_at'),
        supabase.from('client_templates').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('qa_reviews').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('forms').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('form_webhooks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('client_phone_numbers').select('*').eq('client_id', clientId).order('is_default', { ascending: false }),
        supabase.from('ad_components').select('*').eq('client_id', clientId).order('per_client_seq'),
        supabase.from('ads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      ])
      if (clientData) {
        setClient(clientData)
        saveClientId(clientData.id)
      }
      setAvatars(avatarData || [])
      setOffers(offerData || [])
      setIntakeQuestions(intakeData || [])
      setFunnelInstances(funnelData || [])
      setCopyComponents(copyData || [])
      setCompetitors(competitorData || [])
      setLandingPages(landingPageData || [])
      setPublishedPages(publishedPageData || [])
      setMediaAssets(assetData || [])
      setBrandKit(brandKitData || null)
      setPageTemplates(templateData || [])
      setClientTemplates(clientTemplateData || [])
      setQAReviews(qaReviewData || [])
      setForms(formsData || [])
      setFormWebhooks(formWebhooksData || [])
      setClientPhoneNumbers(phoneNumberData || [])
      setAdComponents(adComponentData || [])
      setAds(adData || [])
      setBannerAssets([])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [saveClientId])

  const createNewClient = useCallback(async (name: string, website: string) => {
    const { data, error: err } = await supabase
      .from('clients')
      .insert({ name, website, intake_status: 'pending' })
      .select()
      .single()
    if (err) {
      setError(err.message)
      return null
    }
    // Reset all data for the new (empty) client
    setClient(data)
    saveClientId(data.id)
    setAllClients(prev => [data as Client, ...prev])
    setAvatars([])
    setOffers([])
    setIntakeQuestions([])
    setFunnelInstances([])
    setCopyComponents([])
    setCompetitors([])
    setLandingPages([])
    setPublishedPages([])
    setMediaAssets([])
    setBrandKit(null)
    setClientTemplates([])
    setQAReviews([])
    setForms([])
    setFormWebhooks([])
    setAdComponents([])
    setAds([])
    setBannerAssets([])
    return data as Client
  }, [saveClientId])

  const updateAvatar = useCallback((id: string, updates: Partial<Avatar>) => {
    setAvatars(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    supabase.from('avatars').update(updates).eq('id', id).then(() => {})
  }, [])

  const updateOffer = useCallback((id: string, updates: Partial<Offer>) => {
    setOffers(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    supabase.from('offers').update(updates).eq('id', id).then(() => {})
  }, [])

  const refreshAvatars = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('avatars').select('*').eq('client_id', clientId).order('created_at')
    setAvatars(data || [])
  }, [])

  const refreshOffers = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('offers').select('*').eq('client_id', clientId).order('created_at')
    setOffers(data || [])
  }, [])

  const refreshIntake = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('intake_questions').select('*').eq('client_id', clientId).order('sort_order')
    setIntakeQuestions(data || [])
  }, [])

  const refreshCopyComponents = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('copy_components').select('*').eq('client_id', clientId).order('created_at')
    setCopyComponents(data || [])
  }, [])

  const refreshFunnelInstances = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('funnel_instances').select('*').eq('client_id', clientId).order('generated_at')
    setFunnelInstances(data || [])
  }, [])

  const refreshLandingPages = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('landing_pages').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setLandingPages(data || [])
  }, [])

  const refreshPublishedPages = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('published_pages').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setPublishedPages(data || [])
  }, [])

  const refreshMediaAssets = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('media_assets').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setMediaAssets(data || [])
  }, [])

  const refreshBrandKit = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('brand_kits').select('*').eq('client_id', clientId).single()
    setBrandKit(data || null)
  }, [])

  const refreshPromptTemplates = useCallback(async (clientId?: string) => {
    // Load agency defaults (client_id is null)
    const { data: defaults } = await supabase
      .from('prompt_templates')
      .select('*')
      .is('client_id', null)
      .eq('is_active', true)
      .order('prompt_key')
    const all: PromptTemplate[] = [...(defaults || [])]
    // If a client is selected, also load client-specific overrides
    if (clientId) {
      const { data: overrides } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('prompt_key')
      if (overrides) all.push(...overrides)
    }
    setPromptTemplates(all)
  }, [])

  const refreshClientTemplates = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('client_templates').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setClientTemplates(data || [])
  }, [])

  const refreshQAReviews = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('qa_reviews').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setQAReviews(data || [])
  }, [])

  const refreshForms = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('forms').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setForms(data || [])
  }, [])

  const refreshFormWebhooks = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('form_webhooks').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setFormWebhooks(data || [])
  }, [])

  const refreshClientPhoneNumbers = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('client_phone_numbers').select('*').eq('client_id', clientId).order('is_default', { ascending: false })
    setClientPhoneNumbers(data || [])
  }, [])

  const refreshClient = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (data) {
      setClient(data)
      // Also update allClients list so header dropdown stays in sync
      setAllClients(prev => prev.map(c => c.id === clientId ? data : c))
    }
  }, [])

  const refreshAdComponents = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('ad_components').select('*').eq('client_id', clientId).order('per_client_seq')
    setAdComponents(data || [])
  }, [])

  const refreshAds = useCallback(async (clientId: string) => {
    const { data } = await supabase.from('ads').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setAds(data || [])
  }, [])

  const refreshBannerAssets = useCallback(async (clientId: string) => {
    // banner_assets is scoped through ads.client_id; fetch via ad ids for the client
    const { data: adRows } = await supabase.from('ads').select('id').eq('client_id', clientId)
    const adIds = (adRows || []).map(r => r.id)
    if (adIds.length === 0) {
      setBannerAssets([])
      return
    }
    const { data } = await supabase.from('banner_assets').select('*').in('ad_id', adIds).order('created_at', { ascending: false })
    setBannerAssets(data || [])
  }, [])

  return (
    <AppContext.Provider value={{
      allClients, client, avatars, offers, intakeQuestions, funnelInstances, copyComponents, competitors, landingPages, publishedPages, mediaAssets, brandKit, pageTemplates, promptTemplates, clientTemplates, qaReviews, forms, formWebhooks, clientPhoneNumbers, adComponents, ads, bannerAssets, loading, error,
      userRole, canEdit, isClientRole,
      setClient, setAvatars, setOffers, setIntakeQuestions, setCopyComponents, setFunnelInstances, setCompetitors, setLandingPages, setPublishedPages, setMediaAssets, setBrandKit,
      setLoading, setError, loadAllClients, loadClientData, switchClient, createClient: createNewClient,
      updateAvatar, updateOffer, refreshAvatars, refreshOffers, refreshIntake,
      refreshCopyComponents, refreshFunnelInstances, refreshLandingPages, refreshPublishedPages, refreshMediaAssets, refreshBrandKit, refreshPromptTemplates, refreshClientTemplates, refreshQAReviews, refreshForms, refreshFormWebhooks, refreshClientPhoneNumbers, refreshAdComponents, refreshAds, refreshBannerAssets, refreshClient, setUserRole,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppStore() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppStore must be inside AppProvider')
  return ctx
}
