import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
const TEMPLATE_REPO_OWNER = 'LogicalBoost'
const TEMPLATE_REPO_NAME = 'landing-page-templates'
const HUB_URL = 'https://hub.logicalboost.com'

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
      slug,
      copy_slots,
      brand_kit,
      media_assets,
      avatar_id,
      offer_id,
    } = await req.json()

    if (!client_id || !client_slug || !template_id || !copy_slots || !slug) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_id, client_slug, template_id, copy_slots, slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ─── Step 1: Save to published_pages table ───
    // Page is immediately live at hub.logicalboost.com/p/[client_slug]/[slug]
    const { data: savedPage, error: saveError } = await supabase
      .from('published_pages')
      .insert({
        client_id,
        avatar_id: avatar_id || null,
        offer_id: offer_id || null,
        template_id,
        slug,
        copy_slots: copy_slots || {},
        media_assets: media_assets || {},
        brand_kit_snapshot: brand_kit || {},
        status: 'published',
      })
      .select()
      .single()

    if (saveError) {
      // Check if slug already exists for this client
      if (saveError.code === '23505') {
        return new Response(
          JSON.stringify({ error: `Slug "${slug}" already exists for this client. Choose a different slug.` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Failed to save published page: ${saveError.message}`)
    }

    const previewUrl = `${HUB_URL}/p/${client_slug}/${slug}`

    // ─── Step 2: Create GitHub repo for editing (optional — only if GITHUB_TOKEN is set) ───
    let githubRepo = ''
    let githubUrl = ''

    if (GITHUB_TOKEN) {
      const clientRepoName = `${client_slug}-pages`
      const clientRepoFull = `${TEMPLATE_REPO_OWNER}/${clientRepoName}`

      // Check if client repo exists
      const repoCheck = await fetch(`https://api.github.com/repos/${clientRepoFull}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
      })
      const repoExists = repoCheck.status === 200

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
          console.error(`Failed to create repo (non-fatal): ${err}`)
        } else {
          // Wait for repo to be ready
          await new Promise(r => setTimeout(r, 3000))
        }
      }

      // Push page data file to the repo
      const pageDataContent = JSON.stringify({
        slug,
        template: template_id,
        client_id,
        avatar_id,
        offer_id,
        brand_kit: brand_kit || {},
        media_assets: media_assets || {},
        copy_slots: copy_slots || {},
        created_at: new Date().toISOString(),
      }, null, 2)

      const encoded = btoa(unescape(encodeURIComponent(pageDataContent)))
      const filePath = `src/data/pages/${slug}.json`

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
            message: `Add landing page: ${slug}`,
            content: encoded,
            branch: 'master',
          }),
        }
      )
      if (!putRes.ok) {
        // Try 'main' branch if 'master' fails
        await fetch(
          `https://api.github.com/repos/${clientRepoFull}/contents/${filePath}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Add landing page: ${slug}`,
              content: encoded,
              branch: 'main',
            }),
          }
        )
      }

      githubRepo = clientRepoFull
      githubUrl = `https://github.com/${clientRepoFull}`

      // Update clients table with repo info
      await supabase
        .from('clients')
        .update({ github_repo: clientRepoFull })
        .eq('id', client_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        preview_url: previewUrl,
        github_repo: githubRepo || null,
        github_url: githubUrl || null,
        published_page: savedPage,
        message: `Page published! Live at ${previewUrl}`,
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
