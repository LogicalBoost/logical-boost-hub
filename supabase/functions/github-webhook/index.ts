import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()

    // Verify GitHub webhook signature if secret is set
    const webhookSecret = Deno.env.get('GITHUB_WEBHOOK_SECRET')
    if (webhookSecret) {
      const signature = req.headers.get('x-hub-signature-256')
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // Verify HMAC-SHA256
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
      const expectedSig = 'sha256=' + Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      if (signature !== expectedSig) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const payload = JSON.parse(body)

    // Only process push events
    const event = req.headers.get('x-github-event')
    if (event !== 'push') {
      return new Response(JSON.stringify({ skipped: true, reason: `Event type: ${event}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const repoFullName = payload.repository?.full_name // e.g. "LogicalBoost/upstart-pages"
    if (!repoFullName) {
      throw new Error('No repository info in webhook payload')
    }

    // Extract client slug from repo name (e.g., "upstart-pages" -> "upstart")
    const repoName = repoFullName.split('/')[1] // "upstart-pages"

    // Find the client by github_repo field
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .eq('github_repo', repoFullName)
      .single()

    if (!client) {
      return new Response(JSON.stringify({ skipped: true, reason: `No client found for repo ${repoFullName}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find which page data files were modified in this push
    const commits = payload.commits || []
    const modifiedFiles = new Set<string>()
    for (const commit of commits) {
      for (const f of [...(commit.added || []), ...(commit.modified || [])]) {
        // Match pages/*.json files
        if (f.startsWith('pages/') && f.endsWith('.json')) {
          modifiedFiles.add(f)
        }
      }
    }

    if (modifiedFiles.size === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No page data files modified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const branch = payload.ref?.replace('refs/heads/', '') || 'main'
    let updatedCount = 0

    for (const filePath of modifiedFiles) {
      // Fetch file content from GitHub
      const fileRes = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${filePath}?ref=${branch}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (!fileRes.ok) {
        console.error(`Failed to fetch ${filePath}: ${fileRes.status}`)
        continue
      }

      const fileData = await fileRes.json()
      const content = atob(fileData.content.replace(/\n/g, ''))

      let pageData: Record<string, unknown>
      try {
        pageData = JSON.parse(content)
      } catch (e) {
        console.error(`Invalid JSON in ${filePath}:`, e)
        continue
      }

      // Extract slug from filename: "pages/gig3.json" -> "gig3"
      const slug = filePath.replace('pages/', '').replace('.json', '')

      // Update the published_pages record
      const updatePayload: Record<string, unknown> = {}

      if (pageData.sections) updatePayload.sections = pageData.sections
      if (pageData.copy_slots) updatePayload.copy_slots = pageData.copy_slots
      if (pageData.media_assets) updatePayload.media_assets = pageData.media_assets
      if (pageData.brand_kit) updatePayload.brand_kit_snapshot = pageData.brand_kit

      updatePayload.updated_at = new Date().toISOString()

      if (Object.keys(updatePayload).length <= 1) {
        // Only updated_at, no real data to update
        continue
      }

      const { error: updateError } = await supabase
        .from('published_pages')
        .update(updatePayload)
        .eq('client_id', client.id)
        .eq('slug', slug)
        .eq('status', 'published')

      if (updateError) {
        console.error(`Failed to update page ${slug}:`, updateError)
      } else {
        updatedCount++
        console.log(`Updated page: ${slug}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        repo: repoFullName,
        client_id: client.id,
        pages_updated: updatedCount,
        files_processed: [...modifiedFiles],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
