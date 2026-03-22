import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export async function getAccessibleClients(userId: string, role: string) {
  if (role === 'admin') {
    const { data } = await supabase.from('clients').select('*').order('name')
    return data || []
  }

  if (role === 'team_editor' || role === 'team_viewer') {
    const { data } = await supabase
      .from('client_assignments')
      .select('client_id, clients(*)')
      .eq('user_id', userId)
    return data?.map((a: { clients: unknown }) => a.clients).filter(Boolean) || []
  }

  if (role === 'client') {
    const { data: profile } = await supabase
      .from('users')
      .select('client_id')
      .eq('id', userId)
      .single()

    if (profile?.client_id) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', profile.client_id)
      return data || []
    }
  }

  return []
}
