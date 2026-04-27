// Shared caller-verification helper for edge functions.
//
// Why: every function that mutates client data needs to confirm the JWT
// caller actually has access to that client. Functions are deployed with
// --no-verify-jwt, so without this, anyone with the public anon key (or
// no token at all in some setups) can call them and pass arbitrary IDs.
//
// Pattern (per function):
//
//   const caller = await verifyCaller(req)
//   if (caller instanceof Response) return caller        // 401 / 403
//   const denied = await requireClientAccess(caller, client_id, supabase)
//   if (denied) return denied                            // 403
//
// Service-role-key edge-to-edge calls (rare today, but possible) bypass
// this by not setting Authorization. Such calls are explicitly trusted
// because possessing the service role key is itself the privilege check.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse } from './ai-client.ts'

export type CallerRole = 'admin' | 'team_editor' | 'team_viewer' | 'client'

export interface CallerInfo {
  user_id: string
  role: CallerRole
  client_id: string | null
  email: string | null
}

/**
 * Validate the caller's JWT and return their app-level profile.
 * Returns a Response on failure so the caller can `if (x instanceof Response) return x`.
 */
export async function verifyCaller(req: Request): Promise<CallerInfo | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Missing or malformed Authorization header', 401)
  }

  const supabaseUrl   = Deno.env.get('SUPABASE_URL')!
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Build a service-role client but tag it with the caller's JWT so
  // auth.getUser() resolves the underlying user.
  const sb = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userResp, error: getUserErr } = await sb.auth.getUser()
  if (getUserErr || !userResp?.user) {
    return errorResponse('Invalid or expired token', 401)
  }

  // Profile lookup runs with service role so RLS doesn't bounce a fresh
  // signup whose row exists but isn't yet visible to the caller's anon
  // session (rare race; safe under SDK).
  const { data: profile, error: profErr } = await sb
    .from('users')
    .select('id, email, role, client_id')
    .eq('id', userResp.user.id)
    .maybeSingle()

  if (profErr) return errorResponse('Could not load user profile: ' + profErr.message, 500)
  if (!profile) return errorResponse('User profile not found', 403)

  return {
    user_id:   profile.id,
    role:      profile.role as CallerRole,
    client_id: profile.client_id,
    email:     profile.email,
  }
}

/**
 * Returns null when the caller is permitted to operate on `clientId`,
 * otherwise a 403 Response. Mirrors the `has_client_access` SQL helper.
 */
export async function requireClientAccess(
  caller: CallerInfo,
  clientId: string,
  serviceClient: SupabaseClient,
): Promise<Response | null> {
  if (!clientId) return errorResponse('Missing client_id for access check', 400)

  if (caller.role === 'admin') return null

  if (caller.role === 'team_editor' || caller.role === 'team_viewer') {
    const { data, error } = await serviceClient
      .from('client_assignments')
      .select('id')
      .eq('user_id', caller.user_id)
      .eq('client_id', clientId)
      .maybeSingle()
    if (error)  return errorResponse('Access check failed: ' + error.message, 500)
    if (!data)  return errorResponse('Forbidden: no access to this client', 403)
    return null
  }

  if (caller.role === 'client') {
    if (caller.client_id !== clientId) {
      return errorResponse('Forbidden: this is not your client', 403)
    }
    return null
  }

  return errorResponse('Forbidden', 403)
}

/**
 * Helper for resolving a client_id from a related entity, then checking access.
 * Returns null on success or a Response on failure.
 */
export async function requireAccessViaEntity(
  caller: CallerInfo,
  table: 'avatars' | 'offers' | 'funnel_instances' | 'landing_pages' | 'copy_components',
  id: string,
  serviceClient: SupabaseClient,
): Promise<Response | null> {
  const { data, error } = await serviceClient.from(table).select('client_id').eq('id', id).maybeSingle()
  if (error) return errorResponse(`${table} lookup failed: ${error.message}`, 500)
  if (!data || !data.client_id) return errorResponse(`${table} not found or has no client_id`, 404)
  return requireClientAccess(caller, data.client_id, serviceClient)
}

/** Returns null when the caller is admin, otherwise a 403. */
export function requireAdmin(caller: CallerInfo): Response | null {
  if (caller.role !== 'admin') return errorResponse('Forbidden: admin only', 403)
  return null
}

/** Convenience: write either edit-permitted or read-only. */
export function requireEditor(caller: CallerInfo): Response | null {
  if (caller.role === 'admin' || caller.role === 'team_editor') return null
  return errorResponse('Forbidden: requires admin or team_editor', 403)
}
