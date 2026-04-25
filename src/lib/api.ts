import { supabase } from './supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    let errorMsg = `Edge function ${name} failed (${res.status})`
    try {
      const parsed = JSON.parse(text)
      errorMsg = parsed.error || parsed.message || parsed.msg || errorMsg
    } catch {
      // Response wasn't JSON — use raw text
      if (text.trim()) errorMsg = text.substring(0, 500)
    }
    throw new Error(errorMsg)
  }
  return res.json()
}

// Workflow 1: Analyze a new business
export async function analyzeBusiness(clientId: string, websiteUrl: string, callNotes: string) {
  return callEdgeFunction('analyze-business', {
    client_id: clientId,
    website_url: websiteUrl,
    call_notes: callNotes,
  })
}

// Workflow 2: Generate intake questions
export async function generateIntake(clientId: string) {
  return callEdgeFunction('generate-intake', { client_id: clientId })
}

// Workflow 3: Refine system after intake
export async function refineSystem(clientId: string, newCallNotes?: string, newMaterials?: string) {
  return callEdgeFunction('refine-system', {
    client_id: clientId,
    new_call_notes: newCallNotes,
    new_materials: newMaterials,
  })
}

// Workflow 4: Generate funnel (multi-angle — AI generates across all recommended angles)
// mode: "full" = new instance, "fill_all" = add all missing to existing, "video_only" = just video batch
export async function generateFunnel(avatarId: string, offerId: string, mode: 'full' | 'fill_all' | 'video_only' = 'full') {
  return callEdgeFunction('generate-funnel', {
    avatar_id: avatarId,
    offer_id: offerId,
    mode,
  })
}

// Workflow 5: Generate more items for a section
export async function generateMore(
  funnelInstanceId: string,
  sectionType: string,
  options?: { userPrompt?: string; quantity?: number; angleFilter?: string }
) {
  return callEdgeFunction('generate-more', {
    funnel_instance_id: funnelInstanceId,
    section_type: sectionType,
    user_prompt: options?.userPrompt,
    quantity: options?.quantity,
    angle_filter: options?.angleFilter,
  })
}

// Prompt 0: Recommend angles
export async function recommendAngles(avatarId: string, offerId: string) {
  return callEdgeFunction('recommend-angles', {
    avatar_id: avatarId,
    offer_id: offerId,
  })
}

// Generate Banner Headline suggestions for one audience + offer.
// Returns suggestions only — caller picks which to save into banner_headlines.
export async function generateBannerHeadlines(
  clientId: string,
  audienceId: string,
  offerId: string,
  options?: { count?: number; userPrompt?: string },
): Promise<{ suggestions: { BH: string[] } }> {
  return callEdgeFunction('generate-banner-headlines', {
    client_id: clientId,
    audience_id: audienceId,
    offer_id: offerId,
    count: options?.count,
    user_prompt: options?.userPrompt,
  })
}

// Generate avatars via AI prompter
export async function generateAvatars(
  clientId: string,
  options?: { quantity?: number; userPrompt?: string; audienceMode?: 'general' | 'granular' }
) {
  return callEdgeFunction('generate-avatars', {
    client_id: clientId,
    quantity: options?.quantity,
    user_prompt: options?.userPrompt,
    audience_mode: options?.audienceMode || 'granular',
  })
}

// Prompt 8: Suggest offers
export async function suggestOffers(clientId: string) {
  return callEdgeFunction('suggest-offers', { client_id: clientId })
}

// Workflow 9: Analyze brand kit from client website
export async function analyzeBrandKit(clientId: string) {
  return callEdgeFunction('analyze-brand-kit', { client_id: clientId })
}

// Workflow 11: Analyze competitor landing pages
export async function analyzeCompetitorPages(clientId: string) {
  return callEdgeFunction('analyze-competitor-pages', { client_id: clientId })
}

// Workflow 12: Generate landing page playbook
export async function generatePlaybook(clientId: string) {
  return callEdgeFunction('generate-playbook', { client_id: clientId })
}

// Workflow 13: Generate landing page concepts
export async function generateConcepts(clientId: string) {
  return callEdgeFunction('generate-concepts', { client_id: clientId })
}

// Generate hero image via AI image generation
export async function generateHeroImage(
  clientId: string,
  avatarId: string,
  imageStyle: 'hero' | 'family' | 'trust' | 'lifestyle' = 'hero',
  customPrompt?: string,
  offerId?: string,
  role: string = 'hero_image',
  referenceImage?: { base64: string; mimeType: string }
) {
  return callEdgeFunction('generate-hero-image', {
    client_id: clientId,
    avatar_id: avatarId,
    offer_id: offerId || undefined,
    image_style: imageStyle,
    custom_prompt: customPrompt,
    role,
    reference_image: referenceImage || undefined,
  })
}

// Legacy: Generate a landing page (old pipeline - kept for backward compat)
export async function generateLandingPage(
  clientId: string,
  avatarId: string,
  offerId: string,
  templateId: string,
  conceptBriefIndex?: number
) {
  return callEdgeFunction('generate-landing-page', {
    client_id: clientId,
    avatar_id: avatarId,
    offer_id: offerId,
    template_id: templateId,
    concept_brief_index: conceptBriefIndex,
  })
}

// Generate landing page copy — AI produces complete sections array from avatar+offer+business
export async function generateLandingPageCopy(params: {
  client_id: string
  avatar_id: string
  offer_id: string
  template_slug?: string
}) {
  return callEdgeFunction('generate-landing-page-copy', params)
}

// Deploy landing page — publishes to Hub and pushes to client GitHub repo
export async function deployLandingPage(params: {
  client_id: string
  client_slug: string
  client_name: string
  template_id: string
  slug: string
  copy_slots: Record<string, string>
  sections?: unknown[]
  brand_kit?: Record<string, unknown>
  media_assets?: Record<string, unknown>
  avatar_id?: string
  offer_id?: string
  form_id?: string
  phone_number?: string
}) {
  return callEdgeFunction('deploy-landing-page', params)
}

// Legacy: Edit a landing page section or full page via AI prompter
export async function editLandingPageSection(
  landingPageId: string,
  userPrompt: string,
  editScope: 'section' | 'full_page',
  sectionId?: string
) {
  return callEdgeFunction('edit-landing-page-section', {
    landing_page_id: landingPageId,
    user_prompt: userPrompt,
    edit_scope: editScope,
    section_id: sectionId,
  })
}

// QA Review: Run copywriter quality review on all copy components
export async function runQACopywriterReview(funnelInstanceId: string) {
  return callEdgeFunction('qa-copywriter-review', {
    funnel_instance_id: funnelInstanceId,
  })
}

// QA Review: Run compliance review on all copy components
export async function runQAComplianceReview(funnelInstanceId: string) {
  return callEdgeFunction('qa-compliance-review', {
    funnel_instance_id: funnelInstanceId,
  })
}

// Workflow 10: AI-powered competitor discovery
export async function discoverCompetitors(
  clientId: string,
  options?: { userPrompt?: string }
) {
  return callEdgeFunction('discover-competitors', {
    client_id: clientId,
    user_prompt: options?.userPrompt,
  })
}

// Invite user — creates account via service role (auto-confirmed) + sends password setup email
export async function inviteUser(
  email: string,
  name: string,
  role: string,
  clientId?: string,
  assignedClientIds?: string[]
) {
  return callEdgeFunction('invite-user', {
    email,
    name,
    role,
    client_id: clientId,
    assigned_client_ids: assignedClientIds,
  })
}
