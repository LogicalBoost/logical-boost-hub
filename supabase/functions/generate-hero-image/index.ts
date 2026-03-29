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
 * - Pass the FULL avatar description to the AI — no keyword matching
 * - The person must LOOK like the avatar description says
 * - Pure white background for easy CSS removal (mix-blend-mode: multiply)
 * - No floating icons or graphics — clean portrait only
 */
function buildImagePrompt(
  avatarDescription: string,
  offerDescription: string | null,
  imageStyle: string = 'hero',
  customPrompt?: string,
  role: ImageRole = 'hero_image',
  businessContext?: string
): string {
  // ── Custom prompt with role-aware rules ──
  if (customPrompt?.trim()) {
    if (role === 'parallax') {
      return `${customPrompt.trim()}.

STRICT RULES:
- Wide cinematic landscape photograph (16:9 or wider aspect ratio).
- Dramatic atmospheric lighting — golden hour, blue hour, or moody.
- Slightly dark or muted so text overlays remain legible.
- NO people as the main subject. NO text, logos, or watermarks.
- High resolution, cinematic photography style with natural depth of field.`
    }
    return `${customPrompt.trim()}.

STRICT RULES:
- PURE WHITE BACKGROUND (#FFFFFF). Solid white, no gradients, no patterns, no gray, no environment.
- The person is fully isolated on a white studio backdrop.
- NO floating icons, graphics, or decorative elements.
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

  // ── Hero image: use full avatar + offer description directly ──
  const offerContext = offerDescription
    ? `\nThe offer/service being promoted: ${offerDescription}`
    : ''

  const sharedRules = `
STRICT RULES:
- PURE WHITE BACKGROUND (#FFFFFF). Solid white like a professional studio backdrop. No gradients, no patterns, no gray, no checkerboard, no environment, no furniture, no floor.
- The person's clothing, age, appearance, and vibe must match the avatar description above. Read it carefully. A gig worker should NOT wear a suit. A construction worker should NOT be in an office. Match the real person described.
- NO floating icons, graphics, decorative elements, or text overlays. Just the person on white.
- Professional studio lighting, soft diffused light, high resolution, sharp commercial photography.
- The image must look like a product/catalog photo on solid white. Clean isolation.
- The person should look confident, genuine, and approachable with a natural expression.`

  const styleVariants: Record<string, string> = {
    hero: `Waist-up portrait photograph of a person who matches this description:
"${avatarDescription}"
${offerContext}

Generate a photorealistic person who looks exactly like someone described above. Their clothing, posture, grooming, and overall vibe must authentically represent who this person is in real life. Clean, modern commercial photography style, 85mm lens look. The person is the only element in the frame, looking at camera with a warm natural expression.${sharedRules}`,

    family: `Medium shot photograph of a small relatable family (2-3 people) that matches the audience described below:
"${avatarDescription}"
${offerContext}

The family should look like real people from this demographic. Their clothing and setting should match who they actually are. They look happy, connected, and genuine. Warm soft studio lighting. Natural candid moment.${sharedRules}`,

    trust: `Professional headshot photograph (shoulders-up) of a person who matches this description:
"${avatarDescription}"
${offerContext}

Direct eye contact with camera. Trustworthy and approachable. The person's appearance must authentically match the description above. Soft key light, executive portrait style.${sharedRules}`,

    lifestyle: `Medium-wide editorial photograph of a person who matches this description:
"${avatarDescription}"
${offerContext}

Natural-looking studio light. The person's clothing and demeanor must authentically represent the avatar described above. Editorial photography style: authentic and aspirational.${sharedRules}`,
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

  // Image-capable models (paid tier): gemini-2.5-flash-image
  // Preview models (free tier only): gemini-3.1-flash-image-preview, gemini-3-pro-image-preview
  // Note: "-preview" suffix models route to free tier quotas even on paid plans
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'

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

    // Fetch business context for better scene prompts (parallax, gallery, etc.)
    let businessContext: string | undefined
    if (role !== 'hero_image') {
      const { data: clientData } = await supabase
        .from('clients')
        .select('name, business_summary, services')
        .eq('id', client_id)
        .single()
      if (clientData) {
        const parts = [`Business: ${clientData.name}`]
        if (clientData.business_summary) parts.push(clientData.business_summary)
        if (clientData.services && Array.isArray(clientData.services)) {
          parts.push(`Services: ${clientData.services.join(', ')}`)
        }
        businessContext = parts.join('. ')
      }
    }

    // Build the image prompt from avatar + offer + business context
    const imagePrompt = buildImagePrompt(
      avatar.description || avatar.name,
      offerDescription,
      image_style,
      custom_prompt,
      role as ImageRole,
      businessContext
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
