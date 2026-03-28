import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!
const VERCEL_TOKEN = Deno.env.get('VERCEL_TOKEN')!
const VERCEL_TEAM_ID = Deno.env.get('VERCEL_TEAM_ID')!
const TEMPLATE_REPO_OWNER = 'LogicalBoost'
const TEMPLATE_REPO_NAME = 'landing-page-templates'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      client_id,
      client_slug,
      client_name,
      template_id,
      copy_slots,
      brand_kit,
      media_assets,
      avatar_id,
      offer_id,
    } = await req.json()

    if (!client_id || !client_slug || !template_id || !copy_slots) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_id, client_slug, template_id, copy_slots' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const clientRepoName = `${client_slug}-pages`
    const clientRepoFull = `${TEMPLATE_REPO_OWNER}/${clientRepoName}`

    // ─── Step 1: Check if client repo exists, create from template if not ───
    let repoExists = false
    const repoCheck = await fetch(`https://api.github.com/repos/${clientRepoFull}`, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
    })
    repoExists = repoCheck.status === 200

    if (!repoExists) {
      console.log(`Creating repo ${clientRepoFull} from template...`)
      const createRes = await fetch(
        `https://api.github.com/repos/${TEMPLATE_REPO_OWNER}/${TEMPLATE_REPO_NAME}/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.baptiste-preview+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            owner: TEMPLATE_REPO_OWNER,
            name: clientRepoName,
            description: `Landing pages for ${client_name || client_slug}`,
            private: true,
          }),
        }
      )
      if (!createRes.ok) {
        const err = await createRes.text()
        throw new Error(`Failed to create repo: ${err}`)
      }
      // Wait for repo to be ready
      await new Promise(r => setTimeout(r, 3000))
    }

    // ─── Step 2: Push page data file to the repo ───
    const pageSlug = `${template_id}-${Date.now()}`
    const pageDataContent = JSON.stringify({
      slug: pageSlug,
      template: template_id,
      client_id,
      avatar_id,
      offer_id,
      brand_kit: brand_kit || {},
      media_assets: media_assets || {},
      copy_slots: copy_slots || {},
      created_at: new Date().toISOString(),
    }, null, 2)

    // Base64 encode the content
    const encoded = btoa(unescape(encodeURIComponent(pageDataContent)))

    // Check if pages directory exists, create/update the page data file
    const filePath = `src/data/pages/${pageSlug}.json`
    const putRes = await fetch(
      `https://api.github.com/repos/${clientRepoFull}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Add landing page: ${pageSlug}`,
          content: encoded,
          branch: 'master',
        }),
      }
    )
    if (!putRes.ok) {
      // Try 'main' branch if 'master' fails
      const putRes2 = await fetch(
        `https://api.github.com/repos/${clientRepoFull}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Add landing page: ${pageSlug}`,
            content: encoded,
            branch: 'main',
          }),
        }
      )
      if (!putRes2.ok) {
        const err = await putRes2.text()
        throw new Error(`Failed to push page data: ${err}`)
      }
    }

    // ─── Step 3: Create Vercel project if needed ───
    let vercelUrl = ''
    let vercelProjectId = ''

    // Check if Vercel project exists
    const vercelCheck = await fetch(
      `https://api.vercel.com/v9/projects/${clientRepoName}?teamId=${VERCEL_TEAM_ID}`,
      { headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` } }
    )

    if (vercelCheck.status === 200) {
      const proj = await vercelCheck.json()
      vercelProjectId = proj.id
      // Get the latest deployment URL
      const deploys = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${proj.id}&teamId=${VERCEL_TEAM_ID}&limit=1&target=production`,
        { headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` } }
      )
      const deployData = await deploys.json()
      if (deployData.deployments?.[0]?.url) {
        vercelUrl = `https://${deployData.deployments[0].url}`
      }
    } else {
      // Create new Vercel project
      console.log(`Creating Vercel project for ${clientRepoName}...`)
      const createVercel = await fetch(
        `https://api.vercel.com/v11/projects?teamId=${VERCEL_TEAM_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: clientRepoName,
            framework: 'nextjs',
            gitRepository: {
              type: 'github',
              repo: clientRepoFull,
            },
            environmentVariables: [
              {
                key: 'NEXT_PUBLIC_SUPABASE_URL',
                target: ['production', 'preview'],
                type: 'encrypted',
                value: Deno.env.get('SUPABASE_URL')!,
              },
              {
                key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
                target: ['production', 'preview'],
                type: 'encrypted',
                value: Deno.env.get('LBH_ANON_KEY') || '',
              },
              {
                key: 'CLIENT_ID',
                target: ['production', 'preview'],
                type: 'encrypted',
                value: client_id,
              },
            ],
          }),
        }
      )
      if (createVercel.ok) {
        const proj = await createVercel.json()
        vercelProjectId = proj.id
        vercelUrl = `https://${clientRepoName}.vercel.app`
      } else {
        const err = await createVercel.text()
        console.error('Vercel project creation failed:', err)
        // Not fatal — repo was created, user can connect Vercel manually
      }
    }

    // ─── Step 4: Save to published_pages or landing_pages table ───
    const pageUrl = vercelUrl ? `${vercelUrl}/${pageSlug}` : null

    // Update clients table with repo info
    await supabase
      .from('clients')
      .update({
        github_repo: clientRepoFull,
        vercel_project_id: vercelProjectId || null,
        vercel_url: vercelUrl || null,
      })
      .eq('id', client_id)

    // Save the landing page record
    const { data: savedPage, error: saveError } = await supabase
      .from('landing_pages')
      .insert({
        client_id,
        avatar_id: avatar_id || null,
        offer_id: offer_id || null,
        template_id,
        headline: copy_slots.t1_headline || copy_slots.headline || 'Landing Page',
        status: 'approved',
        deploy_status: vercelUrl ? 'published' : 'draft',
        deployed_url: pageUrl,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save landing page record:', saveError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        page_slug: pageSlug,
        github_repo: clientRepoFull,
        github_url: `https://github.com/${clientRepoFull}`,
        vercel_project_id: vercelProjectId,
        vercel_url: vercelUrl,
        preview_url: pageUrl,
        landing_page: savedPage,
        message: repoExists
          ? 'Page added to existing client repo. Vercel will auto-deploy.'
          : 'Client repo created from template. Vercel project created. First deploy in progress.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Deploy error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Deploy failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
