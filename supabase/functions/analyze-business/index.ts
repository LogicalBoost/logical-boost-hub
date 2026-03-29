// Prompt 1: Analyze Business (Workflow 1)
// Trigger: New client setup — team provides website, call notes, etc.
// Returns: business_summary, services, differentiators, trust_signals, tone, avatars, offers

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, parseJsonResponse, corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

const SYSTEM_PROMPT = `You are a senior marketing strategist at a performance marketing agency. You are analyzing a new client's business to build the foundation for their entire campaign system.

Your job is to extract and synthesize everything relevant about this business into structured data that will power all downstream marketing — avatars, offers, ad copy, landing pages, video scripts, and creatives.

You must produce:

1. BUSINESS SUMMARY — A concise 2–3 paragraph overview of what this company does, who they serve, and what makes them notable.

2. SERVICES — A clear list of what the business offers. Be specific.

3. DIFFERENTIATORS — What makes this company different from competitors.

4. TRUST SIGNALS — Specific credibility elements: awards, certifications, years in business, number of projects, ratings, partnerships.

5. TONE — Describe the brand's voice. Provide 3–5 tone descriptors and a one-sentence summary.

6. INITIAL AVATARS — Generate 2–4 distinct audience segments with ALL fields: name, avatar_type, description, pain_points, motivations, objections, desired_outcome, trigger_events, messaging_style, preferred_platforms, recommended_angles.

7. INITIAL OFFERS — Suggest 2–4 conversion offers with ALL fields: name, offer_type, headline, subheadline, description, primary_cta, conversion_type, benefits, proof_elements, urgency_elements, faq, landing_page_type.

8. EXTRACTED CONTENT — Carefully scan the website content for real, verifiable content assets. Extract ALL of the following that you can find:

  a. "testimonials" — Customer testimonials and reviews found on the website. For EACH one extract:
     - "person_name": The customer's name (use exactly as shown on the site)
     - "person_role": Their title, company, location, or identifier (e.g. "Homeowner, Orlando" or "CEO, Acme Corp")
     - "body": The exact quote text. Do NOT paraphrase or modify. Copy verbatim.
     - "rating": Star rating if shown (1-5), or null
     - "source": Where you found it ("website", "Google Reviews widget", "Yelp widget", etc.)

  b. "stats" — Any specific numbers, metrics, or statistics mentioned on the site:
     - "stat_value": The number as displayed (e.g. "2,100+", "4.9/5.0", "$8.2M", "15 Years")
     - "stat_label": What the number represents (e.g. "Inspections Completed", "Average Rating")

  c. "team_members" — Key team members, founders, or leadership shown on the site:
     - "person_name": Full name
     - "person_role": Their title
     - "body": Short bio if available
     - "person_photo": URL to their photo if visible on the site

  d. "certifications" — Licenses, certifications, accreditations, BBB ratings, partner badges:
     - "title": Name of the certification or accreditation
     - "body": Description if available

  e. "awards" — Any awards or recognition mentioned:
     - "title": Award name
     - "body": Details

  f. "faqs" — Any FAQ content found on the site:
     - "title": The question
     - "body": The answer

  g. "process_steps" — Any "How It Works" or process steps described on the site:
     - "title": Step name
     - "body": Step description
     - "sort_order": Step number (1, 2, 3...)

CRITICAL RULES FOR EXTRACTED CONTENT:
- Only extract content that ACTUALLY EXISTS on the website. NEVER fabricate testimonials, reviews, stats, or team members.
- Copy testimonial quotes VERBATIM. Do not rewrite or improve them.
- If you cannot find any testimonials, reviews, or team members, return empty arrays for those fields. Do NOT make them up.
- Stats must be real numbers from the site. Do not estimate or round.
- Mark the source accurately so the team knows where each piece came from.

FORMATTING RULES:
- NEVER use em dashes in any generated text. Use commas, periods, colons, or separate sentences instead.
- Benefits must be SHORT bullet points (5-10 words each), suitable for banners and landing pages.

Be thorough. Be specific. No generic filler.
Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { client_id, website_url, call_notes, landing_page_content, team_notes } = await req.json()

    if (!client_id) {
      return errorResponse('client_id is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch website content if URL provided
    let fetchedContent = landing_page_content || ''
    if (website_url && !fetchedContent) {
      try {
        const res = await fetch(website_url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LogicalBoost/1.0)' },
          redirect: 'follow',
        })
        if (res.ok) {
          const html = await res.text()
          // Strip scripts/styles, keep text content
          fetchedContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 30000) // Cap to avoid token overflow
        }
      } catch (e) {
        console.error('Failed to fetch website:', e)
      }
    }

    const userMessage = `CLIENT INPUTS:

Website URL: ${website_url || 'Not provided'}
Website Content (scraped from site):
${fetchedContent || 'Could not fetch website content'}

Call Notes:
${call_notes || 'None provided'}

Additional Notes from Team:
${team_notes || 'None provided'}`

    const response = await callClaude(SYSTEM_PROMPT, userMessage, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
    })

    const rawParsed = parseJsonResponse<Record<string, unknown>>(response)

    // The AI may nest everything under a top-level key (e.g. "client_analysis")
    // Unwrap it if needed
    const keys = Object.keys(rawParsed)
    const parsed = (keys.length === 1 && typeof rawParsed[keys[0]] === 'object' && !Array.isArray(rawParsed[keys[0]]))
      ? rawParsed[keys[0]] as Record<string, unknown>
      : rawParsed

    // Extract fields, handling nested structures like "initial_avatars" or "avatars"
    const businessSummary = parsed.business_summary as string || ''
    const services = parsed.services as string || ''
    const differentiators = parsed.differentiators as string || ''
    const trustSignals = parsed.trust_signals as string || ''
    const tone = parsed.tone as string || ''
    const avatarsData = (parsed.avatars || parsed.initial_avatars || []) as Array<Record<string, unknown>>
    const offersData = (parsed.offers || parsed.initial_offers || []) as Array<Record<string, unknown>>

    // Update client record
    await supabase.from('clients').update({
      business_summary: businessSummary,
      services: typeof services === 'string' ? services : JSON.stringify(services),
      differentiators: typeof differentiators === 'string' ? differentiators : JSON.stringify(differentiators),
      trust_signals: typeof trustSignals === 'string' ? trustSignals : JSON.stringify(trustSignals),
      tone: typeof tone === 'string' ? tone : JSON.stringify(tone),
      website: website_url,
      updated_at: new Date().toISOString(),
    }).eq('id', client_id)

    // Insert avatars
    let avatarsCreated = 0
    if (avatarsData?.length) {
      const avatarRecords = avatarsData.map(a => ({
        client_id,
        name: String(a.name || 'Unnamed Avatar'),
        avatar_type: a.avatar_type ? String(a.avatar_type) : null,
        description: a.description ? String(a.description) : null,
        pain_points: a.pain_points ? String(a.pain_points) : null,
        motivations: a.motivations ? String(a.motivations) : null,
        objections: a.objections ? String(a.objections) : null,
        desired_outcome: a.desired_outcome ? String(a.desired_outcome) : null,
        trigger_events: a.trigger_events ? String(a.trigger_events) : null,
        messaging_style: a.messaging_style ? String(a.messaging_style) : null,
        preferred_platforms: Array.isArray(a.preferred_platforms) ? a.preferred_platforms : null,
        recommended_angles: Array.isArray(a.recommended_angles) ? a.recommended_angles : null,
        status: 'approved',
      }))
      const { error: avatarError } = await supabase.from('avatars').insert(avatarRecords)
      if (avatarError) {
        console.error('Avatar insert error:', JSON.stringify(avatarError))
      } else {
        avatarsCreated = avatarRecords.length
      }
    }

    // Insert offers
    let offersCreated = 0
    if (offersData?.length) {
      const offerRecords = offersData.map(o => ({
        client_id,
        name: String(o.name || 'Unnamed Offer'),
        offer_type: o.offer_type ? String(o.offer_type) : null,
        headline: o.headline ? String(o.headline) : null,
        subheadline: o.subheadline ? String(o.subheadline) : null,
        description: o.description ? String(o.description) : null,
        primary_cta: o.primary_cta ? String(o.primary_cta) : null,
        conversion_type: o.conversion_type ? String(o.conversion_type) : null,
        benefits: Array.isArray(o.benefits) ? o.benefits : null,
        proof_elements: Array.isArray(o.proof_elements) ? o.proof_elements : null,
        urgency_elements: Array.isArray(o.urgency_elements) ? o.urgency_elements : null,
        faq: Array.isArray(o.faq) ? o.faq : null,
        landing_page_type: o.landing_page_type ? String(o.landing_page_type) : null,
        status: 'approved',
      }))
      const { error: offerError } = await supabase.from('offers').insert(offerRecords)
      if (offerError) {
        console.error('Offer insert error:', JSON.stringify(offerError))
      } else {
        offersCreated = offerRecords.length
      }
    }

    // Clear old website-extracted content (preserve manually-added items)
    await supabase.from('client_content')
      .delete()
      .eq('client_id', client_id)
      .eq('source', 'website')

    // Insert extracted content (testimonials, reviews, stats, team, certs, awards, faqs, process steps)
    let contentCreated = 0
    const extractedContent = parsed.extracted_content as Record<string, unknown[]> | undefined

    if (extractedContent) {
      const contentRecords: Array<Record<string, unknown>> = []

      // Testimonials
      const testimonials = (extractedContent.testimonials || []) as Array<Record<string, unknown>>
      for (const t of testimonials) {
        contentRecords.push({
          client_id,
          content_type: 'testimonial',
          person_name: t.person_name ? String(t.person_name) : null,
          person_role: t.person_role ? String(t.person_role) : null,
          body: t.body ? String(t.body) : null,
          rating: typeof t.rating === 'number' ? t.rating : null,
          source: t.source ? String(t.source) : 'website',
          is_featured: true,
        })
      }

      // Stats
      const stats = (extractedContent.stats || []) as Array<Record<string, unknown>>
      for (const s of stats) {
        contentRecords.push({
          client_id,
          content_type: 'stat',
          stat_value: s.stat_value ? String(s.stat_value) : null,
          stat_label: s.stat_label ? String(s.stat_label) : null,
          source: 'website',
        })
      }

      // Team members
      const team = (extractedContent.team_members || []) as Array<Record<string, unknown>>
      for (const m of team) {
        contentRecords.push({
          client_id,
          content_type: 'team_member',
          person_name: m.person_name ? String(m.person_name) : null,
          person_role: m.person_role ? String(m.person_role) : null,
          body: m.body ? String(m.body) : null,
          person_photo: m.person_photo ? String(m.person_photo) : null,
          source: 'website',
        })
      }

      // Certifications
      const certs = (extractedContent.certifications || []) as Array<Record<string, unknown>>
      for (const c of certs) {
        contentRecords.push({
          client_id,
          content_type: 'certification',
          title: c.title ? String(c.title) : null,
          body: c.body ? String(c.body) : null,
          source: 'website',
        })
      }

      // Awards
      const awards = (extractedContent.awards || []) as Array<Record<string, unknown>>
      for (const a of awards) {
        contentRecords.push({
          client_id,
          content_type: 'award',
          title: a.title ? String(a.title) : null,
          body: a.body ? String(a.body) : null,
          source: 'website',
        })
      }

      // FAQs
      const faqs = (extractedContent.faqs || []) as Array<Record<string, unknown>>
      for (const f of faqs) {
        contentRecords.push({
          client_id,
          content_type: 'faq',
          title: f.title ? String(f.title) : null,
          body: f.body ? String(f.body) : null,
          source: 'website',
        })
      }

      // Process steps
      const steps = (extractedContent.process_steps || []) as Array<Record<string, unknown>>
      for (const s of steps) {
        contentRecords.push({
          client_id,
          content_type: 'process_step',
          title: s.title ? String(s.title) : null,
          body: s.body ? String(s.body) : null,
          sort_order: typeof s.sort_order === 'number' ? s.sort_order : 0,
          source: 'website',
        })
      }

      if (contentRecords.length > 0) {
        const { error: contentError } = await supabase.from('client_content').insert(contentRecords)
        if (contentError) {
          console.error('Content insert error:', JSON.stringify(contentError))
        } else {
          contentCreated = contentRecords.length
        }
      }
    }

    return jsonResponse({
      success: true,
      avatars_created: avatarsCreated,
      offers_created: offersCreated,
      content_extracted: contentCreated,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
