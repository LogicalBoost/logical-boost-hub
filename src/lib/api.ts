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
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Edge function ${name} failed`)
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

// Generate avatars via AI prompter
export async function generateAvatars(
  clientId: string,
  options?: { quantity?: number; userPrompt?: string }
) {
  return callEdgeFunction('generate-avatars', {
    client_id: clientId,
    quantity: options?.quantity,
    user_prompt: options?.userPrompt,
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

// Workflow 7: Build landing page via design engine pipeline
export async function buildLandingPage(
  clientId: string,
  avatarId: string,
  offerId: string,
  templateId: string,
  copySlots: Record<string, string>
) {
  return callEdgeFunction('build-landing-page', {
    client_id: clientId,
    avatar_id: avatarId,
    offer_id: offerId,
    template_id: templateId,
    copy_slots: copySlots,
  })
}

// Iterate on a landing page with a change prompt
export async function iterateLandingPage(
  landingPageId: string,
  userPrompt: string
) {
  return callEdgeFunction('iterate-landing-page', {
    landing_page_id: landingPageId,
    user_prompt: userPrompt,
  })
}

// Approve a landing page and convert to React
export async function approveLandingPage(landingPageId: string) {
  return callEdgeFunction('approve-landing-page', {
    landing_page_id: landingPageId,
  })
}

// Deploy an approved landing page
export async function deployLandingPage(landingPageId: string) {
  return callEdgeFunction('deploy-landing-page', {
    landing_page_id: landingPageId,
  })
}

// Generate missing copy slots for a template
export async function generateMissingCopySlots(
  clientId: string,
  avatarId: string,
  offerId: string,
  templateId: string,
  missingSlotIds: string[]
) {
  return callEdgeFunction('generate-missing-copy', {
    client_id: clientId,
    avatar_id: avatarId,
    offer_id: offerId,
    template_id: templateId,
    missing_slot_ids: missingSlotIds,
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
