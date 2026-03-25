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
export async function generateFunnel(avatarId: string, offerId: string) {
  return callEdgeFunction('generate-funnel', {
    avatar_id: avatarId,
    offer_id: offerId,
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
