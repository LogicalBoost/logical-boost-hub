// Form submission handler
// Receives form data from landing pages, stores submission, forwards to webhooks

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

function deriveTrafficSource(referrer: string | null): string {
  if (!referrer) return 'direct'
  const r = referrer.toLowerCase()
  if (r.includes('google.')) return 'google'
  if (r.includes('facebook.') || r.includes('fb.')) return 'facebook'
  if (r.includes('instagram.')) return 'instagram'
  if (r.includes('bing.')) return 'bing'
  if (r.includes('youtube.')) return 'youtube'
  if (r.includes('tiktok.')) return 'tiktok'
  if (r.includes('linkedin.')) return 'linkedin'
  if (r.includes('twitter.') || r.includes('x.com')) return 'twitter'
  if (r.includes('pinterest.')) return 'pinterest'
  return 'referral'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const body = await req.json()
    const {
      form_id,
      published_page_id,
      form_data,
      page_slug,
      client_slug,
      page_url,
      utm,
      referrer,
      user_agent,
    } = body

    if (!form_id || !form_data) {
      return errorResponse('form_id and form_data are required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey)

    // 1. Validate form exists and is active
    const { data: form, error: formErr } = await sb
      .from('forms')
      .select('id, name, client_id, fields, status')
      .eq('id', form_id)
      .single()

    if (formErr || !form) return errorResponse('Form not found')
    if (form.status !== 'active') return errorResponse('Form is not active')

    // 2. Validate required fields
    const fields = (form.fields || []) as Array<{ name: string; required?: boolean }>
    for (const field of fields) {
      if (field.required && (!form_data[field.name] || String(form_data[field.name]).trim() === '')) {
        return errorResponse(`Field "${field.name}" is required`, 422)
      }
    }

    // 3. Get client info for webhook payload
    const { data: client } = await sb
      .from('clients')
      .select('name, slug')
      .eq('id', form.client_id)
      .single()

    const trafficSource = deriveTrafficSource(referrer)

    // 4. Insert submission
    const { data: submission, error: subErr } = await sb
      .from('form_submissions')
      .insert({
        form_id,
        client_id: form.client_id,
        published_page_id: published_page_id || null,
        form_data,
        page_slug: page_slug || null,
        client_slug: client_slug || null,
        page_url: page_url || null,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
        utm_content: utm?.utm_content || null,
        utm_term: utm?.utm_term || null,
        referrer: referrer || null,
        traffic_source: trafficSource,
        user_agent: user_agent || null,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
      })
      .select('id')
      .single()

    if (subErr) return errorResponse(`Failed to save submission: ${subErr.message}`)

    // 5. Load active webhooks for this form
    const { data: webhooks } = await sb
      .from('form_webhooks')
      .select('id, webhook_url, name, headers')
      .eq('form_id', form_id)
      .eq('is_active', true)

    // 6. Build webhook payload
    const webhookPayload = {
      form_name: form.name,
      form_id: form.id,
      submission_id: submission.id,
      submitted_at: new Date().toISOString(),
      client: {
        name: client?.name || '',
        slug: client_slug || client?.slug || '',
      },
      page: {
        slug: page_slug || '',
        url: page_url || '',
      },
      lead: form_data,
      tracking: {
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
        utm_content: utm?.utm_content || null,
        utm_term: utm?.utm_term || null,
        referrer: referrer || null,
        traffic_source: trafficSource,
        user_agent: user_agent || null,
      },
    }

    // 7. Fire webhooks (non-blocking — we don't wait for all to succeed)
    const webhookResults: Array<{ webhook_id: string; status: string; response_code: number | null; sent_at: string }> = []

    if (webhooks && webhooks.length > 0) {
      const results = await Promise.allSettled(
        webhooks.map(async (wh) => {
          try {
            const customHeaders = (wh.headers || {}) as Record<string, string>
            const res = await fetch(wh.webhook_url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...customHeaders,
              },
              body: JSON.stringify(webhookPayload),
            })
            return {
              webhook_id: wh.id,
              status: res.ok ? 'sent' : 'failed',
              response_code: res.status,
              sent_at: new Date().toISOString(),
            }
          } catch (err) {
            return {
              webhook_id: wh.id,
              status: 'error',
              response_code: null,
              sent_at: new Date().toISOString(),
              error: (err as Error).message,
            }
          }
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled') webhookResults.push(r.value)
      }

      // Update submission with webhook status
      await sb
        .from('form_submissions')
        .update({ webhook_status: webhookResults })
        .eq('id', submission.id)
    }

    return jsonResponse({
      success: true,
      submission_id: submission.id,
      webhooks_fired: webhookResults.length,
    })

  } catch (err) {
    console.error('Form submission error:', err)
    return errorResponse(`Submission failed: ${(err as Error).message}`, 500)
  }
})
