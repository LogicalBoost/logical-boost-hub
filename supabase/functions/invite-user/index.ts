// Invite User — creates user via admin API and sends a secure invite email
// User must set their own password before accessing the platform

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { email, name, role, client_id, assigned_client_ids } = await req.json()

    if (!email?.trim()) {
      return errorResponse('Email is required')
    }
    if (!role) {
      return errorResponse('Role is required')
    }

    // Validate the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('Not authenticated', 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const siteUrl = Deno.env.get('SITE_URL') || 'https://hub.logicalboost.com'

    // Create a client with the caller's JWT to check their role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: callerUser } } = await callerClient.auth.getUser()
    if (!callerUser) {
      return errorResponse('Not authenticated', 401)
    }

    // Check caller is admin
    const { data: callerProfile } = await callerClient
      .from('users')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return errorResponse('Only admins can invite users', 403)
    }

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Check if user already exists in our users table
    const { data: existing } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .single()

    if (existing) {
      return errorResponse('A user with this email already exists')
    }

    // Also check auth.users to prevent duplicate auth accounts
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
    const existingAuth = authUsers?.find(u => u.email === email.trim())
    if (existingAuth) {
      return errorResponse('A user with this email already exists in the auth system')
    }

    // Step 1: Create user with NO password — they cannot log in until they set one
    // email_confirm: true so no confirmation email is sent
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      user_metadata: { name: name?.trim() || email.split('@')[0] },
    })

    if (createError) {
      return errorResponse('Failed to create user: ' + createError.message)
    }

    if (!authData.user) {
      return errorResponse('User creation returned no user')
    }

    // Step 2: Insert into our users table
    const userRecord: Record<string, unknown> = {
      id: authData.user.id,
      email: email.trim(),
      name: name?.trim() || email.split('@')[0],
      role,
      status: 'active',
    }

    // If client role, link to client
    if (role === 'client' && client_id) {
      userRecord.client_id = client_id
    }

    const { error: insertError } = await adminClient.from('users').insert(userRecord)

    if (insertError) {
      // Clean up auth user if DB insert fails
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return errorResponse('Failed to save user record: ' + insertError.message)
    }

    // Step 3: Add client_assignments
    if (role === 'client' && client_id) {
      await adminClient.from('client_assignments').insert({
        user_id: authData.user.id,
        client_id,
      })
    } else if (assigned_client_ids?.length > 0) {
      const assignments = assigned_client_ids.map((cid: string) => ({
        user_id: authData.user.id,
        client_id: cid,
      }))
      await adminClient.from('client_assignments').insert(assignments)
    }

    // Step 4: Send password reset email — this is the ONLY email they receive
    // The link has type=recovery which forces them to set a password on the login page
    // Using admin generateLink to create the recovery link, then sending via resetPasswordForEmail
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: {
        redirectTo: `${siteUrl}/login?reset=true`,
      },
    })

    // Send the actual email via the public client (generateLink doesn't send on service role)
    const publicClient = createClient(supabaseUrl, anonKey)
    const { error: emailError } = await publicClient.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/login?reset=true`,
    })

    return jsonResponse({
      success: true,
      user_id: authData.user.id,
      message: `Invite sent to ${email.trim()}. They will receive an email to set their password.`,
      email_error: emailError?.message || resetError?.message || null,
    })

  } catch (err) {
    return errorResponse((err as Error).message || 'Unexpected error', 500)
  }
})
