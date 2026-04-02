// Admin utility: fix client_id on users table for client-role users
// Finds client-role users missing client_id and assigns them based on client_assignments

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Optional: target a specific email and/or assign a specific client
    const body = await req.json().catch(() => ({}))
    const targetEmail = body.email
    const assignClientId = body.assign_client_id

    // Direct assignment mode: set client_id on a specific user
    if (targetEmail && assignClientId) {
      const { data: user } = await adminClient.from('users').select('id, email, role, client_id').eq('email', targetEmail).single()
      if (!user) return errorResponse('User not found: ' + targetEmail)

      const { error: updateErr } = await adminClient.from('users').update({ client_id: assignClientId }).eq('id', user.id)
      if (updateErr) return errorResponse('Failed to update: ' + updateErr.message)

      // Also ensure client_assignments entry exists
      const { data: existing } = await adminClient.from('client_assignments').select('id').eq('user_id', user.id).eq('client_id', assignClientId).single()
      if (!existing) {
        await adminClient.from('client_assignments').insert({ user_id: user.id, client_id: assignClientId })
      }

      return jsonResponse({
        success: true,
        message: `Assigned ${targetEmail} to client ${assignClientId}`,
        user_id: user.id,
      })
    }

    // Find all client-role users missing client_id
    let query = adminClient.from('users').select('id, email, name, role, client_id').eq('role', 'client')
    if (targetEmail) {
      query = query.eq('email', targetEmail)
    } else {
      query = query.is('client_id', null)
    }
    const { data: clientUsers, error: userErr } = await query
    if (userErr) return errorResponse('Failed to query users: ' + userErr.message)

    if (!clientUsers || clientUsers.length === 0) {
      // Also check: are there client-role users at all?
      const { data: allClientUsers } = await adminClient.from('users').select('id, email, role, client_id').eq('role', 'client')
      return jsonResponse({
        message: 'No client-role users need fixing',
        all_client_users: allClientUsers,
      })
    }

    const fixes = []

    for (const user of clientUsers) {
      // Check client_assignments for this user
      const { data: assignments } = await adminClient
        .from('client_assignments')
        .select('client_id')
        .eq('user_id', user.id)

      if (assignments && assignments.length > 0) {
        // Assign first client from assignments
        const clientId = assignments[0].client_id
        const { error: updateErr } = await adminClient
          .from('users')
          .update({ client_id: clientId })
          .eq('id', user.id)

        fixes.push({
          email: user.email,
          user_id: user.id,
          assigned_client_id: clientId,
          source: 'client_assignments',
          error: updateErr?.message || null,
        })
      } else {
        // No assignment — try to find a client by matching email domain or name
        // Last resort: list all clients and see if there's a match
        const { data: allClients } = await adminClient.from('clients').select('id, name')

        if (allClients && allClients.length > 0) {
          // If there's only one client, assign it
          // Otherwise, report that manual assignment is needed
          if (targetEmail && allClients.length >= 1) {
            // If specific email targeted, assign the first client (user will specify which)
            fixes.push({
              email: user.email,
              user_id: user.id,
              available_clients: allClients.map(c => ({ id: c.id, name: c.name })),
              status: 'needs_manual_assignment',
            })
          } else if (allClients.length === 1) {
            const clientId = allClients[0].id
            const { error: updateErr } = await adminClient
              .from('users')
              .update({ client_id: clientId })
              .eq('id', user.id)
            fixes.push({
              email: user.email,
              user_id: user.id,
              assigned_client_id: clientId,
              client_name: allClients[0].name,
              source: 'only_client',
              error: updateErr?.message || null,
            })
          }
        }
      }
    }

    return jsonResponse({ fixes, users_checked: clientUsers.length })

  } catch (err) {
    return errorResponse((err as Error).message || 'Unexpected error', 500)
  }
})
