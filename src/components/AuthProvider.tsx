'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database'

interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  client_id: string | null
}

interface AuthContextType {
  user: SupabaseUser | null
  profile: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// Pages that don't require authentication
const PUBLIC_PATHS = ['/login']
// Paths exclusively for client-role users
const CLIENT_PATHS = ['/client']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  const loadProfile = useCallback(async (userId: string): Promise<AuthUser | null> => {
    const { data } = await supabase
      .from('users')
      .select('id, email, name, role, client_id')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data as AuthUser)
      return data as AuthUser
    } else {
      // User exists in auth but not in users table yet.
      // This happens on first signup. We'll auto-create a profile.
      const { data: userCount } = await supabase.rpc('get_user_count')
      const role: UserRole = (userCount === 0) ? 'admin' : 'team_editor'
      const authUser = (await supabase.auth.getUser()).data.user
      const { data: newProfile } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser?.email || '',
          name: authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || 'User',
          role,
          status: 'active',
        })
        .select()
        .single()

      if (newProfile) {
        setProfile(newProfile as AuthUser)
        return newProfile as AuthUser
      }
    }
    return null
  }, [])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    try { localStorage.removeItem('lbh_selected_client_id') } catch {}
    router.push('/login/')
  }, [router])

  useEffect(() => {
    // Check existing session — don't stop loading until profile is fully resolved
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }
      // Only now is it safe to render the app
      setLoading(false)
    })

    // Listen for auth state changes (login/logout after initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // Redirect logic
  useEffect(() => {
    if (loading) return

    const normalizedPath = pathname || '/'
    const isPublicPage = PUBLIC_PATHS.some(p => normalizedPath.startsWith(p))
    const isClientPage = CLIENT_PATHS.some(p => normalizedPath.startsWith(p))
    const isLandingPage = normalizedPath.startsWith('/p/')

    // Only block redirect for active recovery token in hash
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const isActiveRecovery = hash.includes('type=recovery')

    if (!user && !isPublicPage && !isLandingPage) {
      router.push('/login/')
    } else if (user && profile && isPublicPage && !isActiveRecovery) {
      // After login, route to the correct app based on role
      if (profile.role === 'client') {
        router.push('/client/dashboard/')
      } else {
        router.push('/dashboard/')
      }
    } else if (user && profile) {
      // Client-role user trying to access agency (hub) routes → redirect to client app
      if (profile.role === 'client' && !isClientPage && !isPublicPage && !isLandingPage) {
        router.push('/client/dashboard/')
      }
      // Agency user trying to access client routes → redirect to agency dashboard
      if (profile.role !== 'client' && isClientPage) {
        router.push('/dashboard/')
      }
    }
  }, [user, profile, loading, pathname, router])

  // Show loading spinner while checking auth + loading profile
  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>&#9881;&#65039;</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
