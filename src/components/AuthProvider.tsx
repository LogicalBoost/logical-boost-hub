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
const PUBLIC_PATHS = ['/login/']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, email, name, role, client_id')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data as AuthUser)
    } else {
      // User exists in auth but not in users table yet.
      // This happens on first signup. We'll auto-create a profile.
      // Default to admin for the first user, team_editor for subsequent.
      // Use RPC function to bypass RLS and get accurate total user count.
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
      }
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    try { localStorage.removeItem('lbh_selected_client_id') } catch {}
    router.push('/login/')
  }, [router])

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth state changes
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

    // Normalize pathname for basePath comparison
    const normalizedPath = pathname || '/'
    const isPublicPage = PUBLIC_PATHS.some(p => normalizedPath.startsWith(p))

    if (!user && !isPublicPage) {
      // Not logged in and trying to access protected page
      router.push('/login/')
    } else if (user && isPublicPage) {
      // Logged in but on login page, redirect to dashboard
      router.push('/dashboard/')
    }
  }, [user, loading, pathname, router])

  // Show loading spinner while checking auth
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
