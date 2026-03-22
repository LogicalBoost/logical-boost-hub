'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Client, Avatar, Offer, IntakeQuestion, CopyComponent, FunnelInstance, CompetitorIntel } from '@/types/database'

interface AppState {
  client: Client | null
  avatars: Avatar[]
  offers: Offer[]
  intakeQuestions: IntakeQuestion[]
  funnelInstances: FunnelInstance[]
  copyComponents: CopyComponent[]
  competitors: CompetitorIntel[]
  loading: boolean
  error: string | null
}

interface AppStore extends AppState {
  setClient: (client: Client | null) => void
  setAvatars: (avatars: Avatar[]) => void
  setOffers: (offers: Offer[]) => void
  setIntakeQuestions: (questions: IntakeQuestion[]) => void
  setCopyComponents: (components: CopyComponent[]) => void
  setFunnelInstances: (instances: FunnelInstance[]) => void
  setCompetitors: (competitors: CompetitorIntel[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  loadClientData: (clientId: string) => Promise<void>
  createClient: (name: string, website: string) => Promise<Client | null>
  updateAvatar: (id: string, updates: Partial<Avatar>) => void
  updateOffer: (id: string, updates: Partial<Offer>) => void
  refreshAvatars: (clientId: string) => Promise<void>
  refreshOffers: (clientId: string) => Promise<void>
  refreshIntake: (clientId: string) => Promise<void>
  refreshCopyComponents: (clientId: string) => Promise<void>
  refreshFunnelInstances: (clientId: string) => Promise<void>
}

const AppContext = createContext<AppStore | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestion[]>([])
  const [funnelInstances, setFunnelInstances] = useState<FunnelInstance[]>([])
  const [copyComponents, setCopyComponents] = useState<CopyComponent[]>([])
  const [competitors, setCompetitors] = useState<CompetitorIntel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('avatars').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('offers').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('intake_questions').select('*').eq('client_id', clientId).order('sort_order'),
        supabase.from('funnel_instances').select('*').eq('client_id', clientId).order('generated_at'),
        supabase.from('copy_components').select('*').eq('client_id', clientId).order('created_at'),
        supabase.from('competitor_intel').select('*').eq('client_id', clientId).order('captured_at'),
      ])
      if (clientData) setClient(clientData)
      setAvatars(avatarData || [])
      setOffers(offerData || [])
      setIntakeQuestions(intakeData || [])
      setFunnelInstances(funnelData || [])
      setCopyComponents(copyData || [])
      setCompetitors(competitorData || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

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
    setClient(data)
    return data as Client
  }, [])

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

  return (
    <AppContext.Provider value={{
      client, avatars, offers, intakeQuestions, funnelInstances, copyComponents, competitors, loading, error,
      setClient, setAvatars, setOffers, setIntakeQuestions, setCopyComponents, setFunnelInstances, setCompetitors,
      setLoading, setError, loadClientData, createClient: createNewClient,
      updateAvatar, updateOffer, refreshAvatars, refreshOffers, refreshIntake,
      refreshCopyComponents, refreshFunnelInstances,
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
