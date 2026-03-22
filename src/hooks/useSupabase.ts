'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Client, Avatar, Offer, CopyComponent, FunnelInstance, Creative, LandingPage, IntakeQuestion, CompetitorIntel } from '@/types/database'

// Generic hook for fetching data by client_id
function useClientData<T>(table: string, clientId: string | null, options?: { orderBy?: string; filter?: Record<string, string> }) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    setLoading(true)
    let query = supabase.from(table).select('*').eq('client_id', clientId)
    if (options?.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    }
    if (options?.orderBy) {
      query = query.order(options.orderBy)
    }
    const { data: result, error: err } = await query
    if (err) setError(err.message)
    else setData(result as T[])
    setLoading(false)
  }, [table, clientId, options?.orderBy, options?.filter])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// Auth state
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (authUser) {
        const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
        setUser(data as User | null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single()
        setUser(data as User | null)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}

// Client selector state
export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClients() {
      const { data } = await supabase.from('clients').select('*').order('name')
      const clientList = (data as Client[]) || []
      setClients(clientList)
      if (clientList.length > 0 && !selectedClientId) {
        setSelectedClientId(clientList[0].id)
      }
      setLoading(false)
    }
    loadClients()
  }, [selectedClientId])

  const selectedClient = clients.find(c => c.id === selectedClientId) || null

  return { clients, selectedClient, selectedClientId, setSelectedClientId, loading }
}

// Data hooks
export function useAvatars(clientId: string | null) {
  return useClientData<Avatar>('avatars', clientId, { orderBy: 'created_at' })
}

export function useOffers(clientId: string | null) {
  return useClientData<Offer>('offers', clientId, { orderBy: 'created_at' })
}

export function useCopyComponents(clientId: string | null, funnelInstanceId?: string) {
  const filter = funnelInstanceId ? { funnel_instance_id: funnelInstanceId } : undefined
  return useClientData<CopyComponent>('copy_components', clientId, { filter })
}

export function useFunnelInstances(clientId: string | null) {
  return useClientData<FunnelInstance>('funnel_instances', clientId)
}

export function useCreatives(clientId: string | null, funnelInstanceId?: string) {
  const filter = funnelInstanceId ? { funnel_instance_id: funnelInstanceId } : undefined
  return useClientData<Creative>('creatives', clientId, { filter })
}

export function useLandingPages(clientId: string | null, funnelInstanceId?: string) {
  const filter = funnelInstanceId ? { funnel_instance_id: funnelInstanceId } : undefined
  return useClientData<LandingPage>('landing_pages', clientId, { filter })
}

export function useIntakeQuestions(clientId: string | null) {
  return useClientData<IntakeQuestion>('intake_questions', clientId, { orderBy: 'sort_order' })
}

export function useCompetitorIntel(clientId: string | null) {
  return useClientData<CompetitorIntel>('competitor_intel', clientId, { orderBy: 'captured_at' })
}

// Mutation helpers
export async function updateStatus(table: string, id: string, status: 'approved' | 'denied') {
  const { error } = await supabase.from(table).update({ status }).eq('id', id)
  return { error }
}

export async function deleteRecord(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  return { error }
}

export async function insertRecord<T extends Record<string, unknown>>(table: string, record: T) {
  const { data, error } = await supabase.from(table).insert(record).select().single()
  return { data, error }
}
