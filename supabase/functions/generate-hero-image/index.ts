// Generate Hero Image — calls Google Imagen 4 via Gemini API
// to produce a photorealistic hero shot based on the avatar description.
//
// The image is uploaded to Supabase Storage (client-assets bucket)
// and the public URL is returned for use in the landing page Stitch prompt.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

// Google AI Studio API key (free tier — works with Gemini Flash image generation)
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY')

/**
 * Build an image generation prompt from avatar + offer data.
 *
 * Key principles:
 * - The person must LOOK like the avatar (gig worker ≠ corporate suit)
 * - Clothing, posture, and expression must match who the avatar actually is
 * - Any optional icons/graphics must directly relate to the avatar's world and the offer
 * - NEVER use generic "business" imagery for non-business avatars
 * - Always transparent/blank background — person is isolated
 */
function buildImagePrompt(
  avatarDescription: string,
  offerDescription: string | null,
  imageStyle: string = 'hero',
  customPrompt?: string
): string {
  if (customPrompt?.trim()) {
    return `${customPrompt.trim()}.

STRICT RULES:
- TRANSPARENT BACKGROUND — completely blank, no environment, no room, no scenery, no floor, no gradient.
- The person is fully isolated on transparency.
- If any small icons or graphics float around the person, they must directly relate to the person described above. No random corporate icons.
- Professional studio lighting, high resolution, sharp focus.
- The person should look confident, approachable, and genuine.`
  }

  const desc = avatarDescription.toLowerCase()
  const offer = (offerDescription || '').toLowerCase()

  // ── Person appearance ──
  // Read the avatar description carefully to determine who this person actually is.
  // The prompt must describe clothing, look, and vibe that match the real avatar.
  let personAppearance = 'a real everyday person in casual-professional clothing'

  if (desc.includes('gig') || desc.includes('driver') || desc.includes('delivery') || desc.includes('rideshare') || desc.includes('uber') || desc.includes('lyft') || desc.includes('doordash')) {
    personAppearance = 'a real gig worker / rideshare driver — wearing a casual t-shirt or hoodie, relaxed and approachable, NOT in a suit or formal wear'
  } else if (desc.includes('freelance') || desc.includes('self-employ') || desc.includes('solopreneur') || desc.includes('side hustle')) {
    personAppearance = 'a self-employed freelancer — casual clothes (t-shirt, flannel, or simple top), relaxed and independent vibe'
  } else if (desc.includes('contractor') || desc.includes('trades') || desc.includes('plumb') || desc.includes('electri') || desc.includes('hvac') || desc.includes('roof') || desc.includes('construction')) {
    personAppearance = 'a skilled trades worker — wearing a work shirt or polo, practical and hands-on look, NOT in a suit'
  } else if (desc.includes('nurse') || desc.includes('medical') || desc.includes('healthcare') || desc.includes('doctor') || desc.includes('caregiver')) {
    personAppearance = 'a healthcare professional — wearing scrubs or a medical coat, warm and caring expression'
  } else if (desc.includes('teacher') || desc.includes('educator') || desc.includes('professor')) {
    personAppearance = 'a teacher or educator — wearing smart casual clothing, warm and knowledgeable expression'
  } else if (desc.includes('parent') || desc.includes('mom') || desc.includes('dad') || desc.includes('stay-at-home') || desc.includes('family')) {
    personAppearance = 'a parent — wearing comfortable everyday clothes, warm and relatable'
  } else if (desc.includes('student') || desc.includes('college') || desc.includes('grad')) {
    personAppearance = 'a young student — casual clothes (hoodie, t-shirt, backpack strap on shoulder), youthful and optimistic'
  } else if (desc.includes('retiree') || desc.includes('retire') || desc.includes('senior') || desc.includes('older')) {
    personAppearance = 'an older adult — wearing neat casual clothes, dignified and relaxed'
  } else if (desc.includes('executive') || desc.includes('ceo') || desc.includes('corporate') || desc.includes('c-suite')) {
    personAppearance = 'a corporate executive — wearing a tailored suit or blazer, polished and authoritative'
  } else if (desc.includes('small business') || desc.includes('business owner') || desc.includes('entrepreneur')) {
    personAppearance = 'a small business owner — wearing business casual (button-up shirt, no tie), confident and hands-on'
  } else if (desc.includes('tech') || desc.includes('developer') || desc.includes('engineer') || desc.includes('startup')) {
    personAppearance = 'a tech professional — wearing a casual button-up or clean t-shirt, modern and sharp'
  } else if (desc.includes('fitness') || desc.includes('athlete') || desc.includes('gym') || desc.includes('trainer')) {
    personAppearance = 'a fitness-oriented person — wearing athletic or athleisure clothing, energetic and healthy'
  } else if (desc.includes('creative') || desc.includes('artist') || desc.includes('designer') || desc.includes('photographer')) {
    personAppearance = 'a creative professional — wearing stylish casual clothing, expressive and authentic'
  } else if (desc.includes('restaurant') || desc.includes('chef') || desc.includes('food') || desc.includes('server')) {
    personAppearance = 'a food industry worker — wearing a clean apron or casual work clothes, personable'
  } else if (desc.includes('retail') || desc.includes('sales') || desc.includes('store')) {
    personAppearance = 'a retail worker — wearing a casual polo or everyday work clothes, friendly and helpful'
  }

  // ── Emotional expression ──
  let expression = 'looking confident and approachable with a genuine, natural smile'
  if (desc.includes('stress') || desc.includes('overwhelm') || desc.includes('frustrat') || desc.includes('struggling')) {
    expression = 'looking relieved and hopeful, genuine smile, as if a burden has been lifted'
  } else if (desc.includes('skepti') || desc.includes('cautious') || desc.includes('careful') || desc.includes('distrust')) {
    expression = 'looking pleasantly surprised and reassured, warm natural expression'
  }

  // ── Icon context ──
  // Icons must match what this specific avatar deals with daily.
  // Derive from avatar description AND offer description.
  let iconGuidance = 'Do NOT include any floating icons or graphics.'

  // Build specific icon suggestions from avatar + offer context
  const iconIdeas: string[] = []

  // Avatar-based icons
  if (desc.includes('gig') || desc.includes('driver') || desc.includes('rideshare') || desc.includes('delivery')) {
    iconIdeas.push('car', 'phone with map', 'dollar sign', 'steering wheel')
  }
  if (desc.includes('tax') || desc.includes('deduction') || offer.includes('tax')) {
    iconIdeas.push('tax form', 'receipt', 'calculator', 'money')
  }
  if (desc.includes('freelance') || desc.includes('self-employ') || desc.includes('1099')) {
    iconIdeas.push('laptop', 'invoice', 'calendar', 'dollar sign')
  }
  if (desc.includes('contractor') || desc.includes('trades') || desc.includes('plumb') || desc.includes('roof')) {
    iconIdeas.push('wrench', 'hard hat', 'house', 'tools')
  }
  if (desc.includes('medical') || desc.includes('health') || desc.includes('nurse') || desc.includes('patient')) {
    iconIdeas.push('heart', 'medical cross', 'stethoscope', 'shield')
  }
  if (desc.includes('fitness') || desc.includes('gym') || desc.includes('workout')) {
    iconIdeas.push('dumbbell', 'heart rate', 'running shoe', 'timer')
  }
  if (desc.includes('parent') || desc.includes('family') || desc.includes('mom') || desc.includes('dad')) {
    iconIdeas.push('house', 'heart', 'piggy bank', 'calendar')
  }
  if (desc.includes('student') || desc.includes('education') || desc.includes('learn')) {
    iconIdeas.push('book', 'graduation cap', 'lightbulb', 'pencil')
  }
  if (desc.includes('small business') || desc.includes('business owner') || desc.includes('entrepreneur')) {
    iconIdeas.push('storefront', 'chart', 'handshake', 'lightbulb')
  }
  if (desc.includes('tech') || desc.includes('developer') || desc.includes('startup')) {
    iconIdeas.push('code brackets', 'laptop', 'gear', 'cloud')
  }
  if (desc.includes('restaurant') || desc.includes('food') || desc.includes('chef')) {
    iconIdeas.push('plate', 'chef hat', 'fork and knife', 'receipt')
  }

  // Offer-based icons
  if (offer.includes('loan') || offer.includes('financ') || offer.includes('credit') || offer.includes('money')) {
    iconIdeas.push('dollar sign', 'wallet', 'money stack')
  }
  if (offer.includes('insurance') || offer.includes('protect') || offer.includes('coverage')) {
    iconIdeas.push('shield', 'umbrella', 'checkmark')
  }
  if (offer.includes('save') || offer.includes('discount') || offer.includes('deal')) {
    iconIdeas.push('piggy bank', 'percentage sign', 'savings')
  }
  if (offer.includes('consult') || offer.includes('call') || offer.includes('appointment') || offer.includes('book')) {
    iconIdeas.push('phone', 'calendar', 'checkmark')
  }

  if (iconIdeas.length > 0) {
    // Deduplicate and pick up to 4
    const unique = [...new Set(iconIdeas)].slice(0, 4)
    iconGuidance = `OPTIONAL: 2-3 very small, subtle, flat-style icons can float around the person for visual context. ONLY use icons from this list: ${unique.join(', ')}. Icons must be tiny, semi-transparent, and not distract from the person. If in doubt, use NO icons — a clean image is always better than wrong icons.`
  }

  // ── Assemble prompt by style ──
  const shared = `
STRICT RULES:
- TRANSPARENT BACKGROUND — completely blank/white/transparent. No room, no environment, no scenery, no floor, no wall, no gradient, no office, no outdoor scene. Just the person on nothing.
- The person must look like ${personAppearance}. Match their clothing, age range, and vibe to this description exactly.
- ${expression}.
- ${iconGuidance}
- Do NOT add any background elements, furniture, or environment. The person floats on blank space.
- Professional studio lighting, soft diffused light, high resolution, sharp commercial photography.`

  const styleVariants: Record<string, string> = {
    hero: `Waist-up portrait of ${personAppearance}. ${expression}. Clean, modern commercial photography style, 85mm lens look. The person is the only element in the frame.${shared}`,
    family: `Medium shot of a small relatable family (2-3 people) in comfortable everyday clothes. They look happy, connected, and genuine — a natural candid moment. Warm soft studio lighting.${shared}`,
    trust: `Shoulders-up headshot of ${personAppearance}. Direct eye contact with camera. ${expression}. Trustworthy and approachable. Soft key light, executive portrait style.${shared}`,
    lifestyle: `Medium-wide shot of ${personAppearance}. ${expression}. Natural-looking studio light. Editorial photography style — authentic and aspirational.${shared}`,
  }

  return styleVariants[imageStyle] || styleVariants.hero
}

/**
 * Generate an image using Gemini Flash (free tier).
 * Uses the generateContent endpoint with responseModalities: ["IMAGE"]
 *
 * Imagen requires a paid plan, but Gemini Flash image generation is free.
 */
async function generateImage(prompt: string): Promise<Uint8Array> {
  const apiKey = GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GOOGLE_AI_API_KEY not configured. Get a key from Google AI Studio ' +
      '(aistudio.google.com), then run: npx supabase secrets set GOOGLE_AI_API_KEY=your-key'
    )
  }

  // Image-capable models: gemini-3.1-flash-image-preview, gemini-3-pro-image-preview, gemini-2.5-flash-image
  // Standard models (gemini-2.0-flash etc) do NOT support image output
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent'

  const body = {
    contents: [{
      parts: [{ text: prompt }],
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  }

  console.log('Calling Gemini Flash image generation...')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Gemini image API error ${res.status}: ${errorText}`)
  }

  const data = await res.json()

  // Response: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
  const candidates = data.candidates
  if (!candidates || candidates.length === 0) {
    throw new Error(`Gemini returned no candidates. Response: ${JSON.stringify(data).substring(0, 500)}`)
  }

  const parts = candidates[0].content?.parts
  if (!parts || parts.length === 0) {
    throw new Error('Gemini response has no content parts')
  }

  // Find the image part
  const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart) {
    throw new Error(`No image in response. Parts: ${parts.map((p: { text?: string; inlineData?: { mimeType: string } }) => p.text ? 'text' : p.inlineData?.mimeType || 'unknown').join(', ')}`)
  }

  const base64 = imagePart.inlineData.data
  if (!base64) {
    throw new Error('Image part has no data')
  }

  // Decode base64 to bytes
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const {
      client_id,
      avatar_id,
      offer_id,                  // Optional — used for icon/context relevance
      image_style = 'hero',    // hero | family | trust | lifestyle
      custom_prompt,             // Optional override prompt
    } = await req.json()

    if (!client_id || !avatar_id) {
      return errorResponse('client_id and avatar_id are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch avatar for description
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('name, description')
      .eq('id', avatar_id)
      .single()

    if (avatarError || !avatar) {
      return errorResponse(`Avatar not found: ${avatarError?.message || 'No data'}`)
    }

    // Fetch offer for context (optional — helps with icon relevance)
    let offerDescription: string | null = null
    if (offer_id) {
      const { data: offer } = await supabase
        .from('offers')
        .select('name, description')
        .eq('id', offer_id)
        .single()
      if (offer) {
        offerDescription = offer.description || offer.name
      }
    }

    // Build the image prompt from avatar + offer context
    const imagePrompt = buildImagePrompt(
      avatar.description || avatar.name,
      offerDescription,
      image_style,
      custom_prompt
    )

    console.log(`Generating hero image for avatar "${avatar.name}" with style "${image_style}"`)
    console.log(`Prompt: ${imagePrompt.substring(0, 200)}...`)

    // Generate image via Gemini Flash
    const imageBytes = await generateImage(imagePrompt)

    // Upload to Supabase Storage
    const filename = `hero-${avatar_id}-${image_style}-${Date.now()}.png`
    const storagePath = `${client_id}/${filename}`

    const { error: uploadError } = await supabase
      .storage
      .from('client-assets')
      .upload(storagePath, imageBytes, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      return errorResponse(`Failed to upload image: ${uploadError.message}`, 500)
    }

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('client-assets')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Save to client_assets table for reuse
    const { data: assetRecord, error: assetError } = await supabase
      .from('client_assets')
      .insert({
        client_id,
        asset_type: image_style === 'hero' || image_style === 'family' || image_style === 'trust' || image_style === 'lifestyle'
          ? 'hero_image' : image_style,
        url: publicUrl,
        storage_path: storagePath,
        filename,
        prompt_used: imagePrompt,
        style: image_style,
        metadata: { avatar_id, avatar_name: avatar.name, source: 'ai_generated' },
      })
      .select()
      .single()

    if (assetError) {
      console.warn(`Failed to save asset record: ${assetError.message}`)
    }

    return jsonResponse({
      success: true,
      image_url: publicUrl,
      storage_path: storagePath,
      prompt_used: imagePrompt,
      style: image_style,
      asset: assetRecord || null,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
