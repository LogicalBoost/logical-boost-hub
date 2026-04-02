// Confirm User — auto-confirms email for users who were invited but never confirmed
// Called when login fails with "Email not confirmed"
// Uses service role to confirm the user, then signs them in

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { email, password } = await req.json()

    if (!email?.trim() || !password) {
      return errorResponse('Email and password are required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Find user by email using filter (avoids pagination issues with listUsers)
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      // @ts-ignore - filter by email
    })

    // Search through all users for the email match
    // Use a more targeted approach - try to sign in first to validate password
    // If that fails with "email not confirmed", confirm and retry

    // Step 1: Find user by listing with filter
    let targetUser = null
    let page = 1
    while (!targetUser) {
      const { data: { users: batch }, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 100,
      })
      if (error || !batch || batch.length === 0) break
      targetUser = batch.find(u => u.email === email.trim())
      if (batch.length < 100) break
      page++
    }

    if (!targetUser) {
      return errorResponse('Invalid login credentials')
    }

    // Step 2: Auto-confirm the email if not already confirmed
    if (!targetUser.email_confirmed_at) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
        email_confirm: true,
      })
      if (updateError) {
        return errorResponse('Login failed')
      }
    }

    // Step 3: Sign in with the provided credentials to validate password
    const publicClient = createClient(supabaseUrl, anonKey)
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      return errorResponse(signInError.message)
    }

    return jsonResponse({
      success: true,
      session: signInData.session,
    })

  } catch (err) {
    return errorResponse((err as Error).message || 'Unexpected error', 500)
  }
})
