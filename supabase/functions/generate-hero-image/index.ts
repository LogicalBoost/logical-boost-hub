// Generate Image — calls Google Gemini API
// to produce a photorealistic image based on the avatar description.
// Supports multiple roles: hero_image, parallax, process_step, photo,
// background_texture, gallery, other.
//
// The image is uploaded to Supabase Storage (client-assets bucket)
// and the public URL is returned for use in the landing page builder.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-client.ts'

// Google AI Studio API key (free tier — works with Gemini Flash image generation)
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY')

// Valid media asset roles that this function can generate
const VALID_ROLES = ['hero_image', 'parallax', 'process_step', 'photo', 'background_texture', 'gallery', 'other'] as const
type ImageRole = typeof VALID_ROLES[number]

/**
 * Derive a business/industry context string from avatar + offer descriptions.
 */
function deriveContext(avatarDesc: string, offerDesc: string | null): string {
  const parts = [avatarDesc]
  if (offerDesc) parts.push(offerDesc)
  return parts.join('. ')
}

/**
 * Build a parallax background prompt — wide, atmospheric, no people focus.
 */
function buildParallaxPrompt(
  avatarDescription: string,
  offerDescription: string | null,
  businessContext?: string
): string {
  const context = businessContext || deriveContext(avatarDescription, offerDescription)
  return `Wide cinematic landscape photograph suitable for a parallax scrolling background on a website.

Context about the business and audience: ${context}

Generate an atmospheric, wide-format scene that relates to this business context. The image should be:
- Dramatic and moody with rich colors and depth
- Wide aspect ratio (16:9 or wider)
- Suitable as a background — NOT the main focal point of a page
- Slightly dark or muted so text can overlay it legibly
- NO people as the main subject (distant/tiny silhouettes are OK)
- NO text, logos, or watermarks

Think: aerial neighborhood view for a roofing company, city skyline at dusk for fintech, rolling farmland for agriculture, workshop interior for trades.

STRICT RULES:
- High resolution, cinematic photography style
- Rich atmospheric lighting (golden hour, blue hour, dramatic clouds, or moody interior light)
- Sharp focus with natural depth of field
- The scene must feel relevant to the business described above`
}

/**
 * Build a contextual scene prompt for process_step, photo, or other roles.
 */
function buildScenePrompt(
  avatarDescription: string,
  offerDescription: string | null,
  businessContext?: string
): string {
  const context = businessContext || deriveContext(avatarDescription, offerDescription)
  return `Professional photograph of a scene or setting related to this business context: ${context}

Generate a contextual image that shows the world this business operates in — a setting, workspace, tool, or environment that the target audience would recognize and relate to.

- NOT a portrait of a single person (show environments, tools, workspaces, or activities)
- People can appear as part of the scene but should not be the isolated subject
- Clean, well-lit commercial photography style
- Relevant to the business and audience described above
- NO text, logos, or watermarks

STRICT RULES:
- High resolution, professional commercial photography
- Clean composition with good lighting
- Authentic and relatable — not overly staged or stock-photo generic
- Sharp focus, natural colors`
}

/**
 * Build a gallery prompt for product/service related images.
 */
function buildGalleryPrompt(
  avatarDescription: string,
  offerDescription: string | null,
  businessContext?: string
): string {
  const context = businessContext || deriveContext(avatarDescription, offerDescription)
  return `Professional product or service photograph related to this business: ${context}

Generate an image showcasing the product, service, or end result that this business delivers to its customers. Think: completed project, product in use, service being performed, or the tangible outcome a customer receives.

- Focus on the product/service/result, not on people
- Clean, well-lit product photography style
- The image should make the viewer want to buy or inquire
- NO text, logos, or watermarks

STRICT RULES:
- High resolution, commercial product photography
- Clean white or neutral background preferred, or tasteful lifestyle context
- Sharp focus, accurate colors
- Professional and aspirational`
}

/**
 * Build a background texture prompt.
 */
function buildTexturePrompt(
  avatarDescription: string,
  offerDescription: string | null,
  businessContext?: string
): string {
  const context = businessContext || deriveContext(avatarDescription, offerDescription)
  return `Abstract or subtle textured background image suitable for a website section background.

Business context: ${context}

Generate a subtle, non-distracting background texture or pattern that complements this type of business. The image should:
- Be suitable as a CSS background-image (tileable or full-bleed)
- Have very low visual noise so text remains readable on top
- Use muted, professional colors related to the business industry
- NOT contain any recognizable objects, people, or text
- Be abstract, geometric, or organic texture only

STRICT RULES:
- High resolution, seamless or near-seamless texture
- Muted and understated — this is a background, not a focal image
- Professional color palette
- NO text, logos, watermarks, or identifiable objects`
}

/**
 * Build an image generation prompt from avatar + offer data.
 *
 * Key principles:
 * - The person must LOOK like the avatar (gig worker ≠ corporate suit)
 * - Clothing, posture, and expression must match who the avatar actually is
 * - Any optional icons/graphics must directly relate to the avatar's world and the offer
 * - NEVER use generic "business" imagery for non-business avatars
 * - Always pure white background — person is isolated (studio backdrop style)
 */
function buildImagePrompt(
  avatarDescription: string,
  offerDescription: string | null,
  imageStyle: string = 'hero',
  customPrompt?: string,
  role: ImageRole = 'hero_image',
  businessContext?: string
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

  // ── Role-specific prompts (non-hero) ──
  if (role === 'parallax') {
    return buildParallaxPrompt(avatarDescription, offerDescription, businessContext)
  }
  if (role === 'process_step' || role === 'photo') {
    return buildScenePrompt(avatarDescription, offerDescription, businessContext)
  }
  if (role === 'gallery') {
    return buildGalleryPrompt(avatarDescription, offerDescription, businessContext)
  }
  if (role === 'background_texture') {
    return buildTexturePrompt(avatarDescription, offerDescription, businessContext)
  }
  if (role === 'other') {
    return buildScenePrompt(avatarDescription, offerDescription, businessContext)
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
- PURE WHITE BACKGROUND (#FFFFFF) — solid white, no gradients, no patterns, no checkerboard, no gray. The background must be completely solid white like a professional studio backdrop.
- The person must look like ${personAppearance}. Match their clothing, age range, and vibe to this description exactly.
- ${expression}.
- ${iconGuidance}
- Do NOT add any background elements, furniture, or environment. The person is shot against a plain white studio backdrop.
- Professional studio lighting, soft diffused light, high resolution, sharp commercial photography.
- The image must look like a product photo on white — clean isolation against pure white.`

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
      role = 'hero_image',       // hero_image | parallax | process_step | photo | background_texture | gallery | other
    } = await req.json()

    if (!client_id || !avatar_id) {
      return errorResponse('client_id and avatar_id are required')
    }

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return errorResponse(`Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`)
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
      custom_prompt,
      role as ImageRole
    )

    console.log(`Generating ${role} image for avatar "${avatar.name}" with style "${image_style}"`)
    console.log(`Prompt: ${imagePrompt.substring(0, 200)}...`)

    // Generate image via Gemini Flash
    const imageBytes = await generateImage(imagePrompt)

    // Upload to Supabase Storage
    const filename = `${role}-${avatar_id}-${image_style}-${Date.now()}.png`
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

    // Save to media_assets table for reuse
    const { data: assetRecord, error: assetError } = await supabase
      .from('media_assets')
      .insert({
        client_id,
        avatar_id,
        role,
        file_url: publicUrl,
        file_type: 'image',
        storage_path: storagePath,
        filename,
        prompt_used: imagePrompt,
        style: image_style,
        display_name: `${avatar.name} - ${role} - ${image_style}`,
        metadata: { avatar_name: avatar.name, source: 'ai_generated' },
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
      role,
      asset: assetRecord || null,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
