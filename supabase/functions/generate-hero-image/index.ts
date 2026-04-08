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
  return `You are an expert brand photographer and art director creating a cinematic background photograph for a website trust section.

BUSINESS & AUDIENCE CONTEXT:
${context}

AVATAR (the target customer):
${avatarDescription}

${offerDescription ? `OFFER: ${offerDescription}` : ''}

YOUR TASK:
Create a wide, atmospheric photograph that captures the WORLD this business and its customers live in. This image will sit behind a dark branded overlay with white text on top, so it needs to work as a background — moody, textured, and rich.

CREATIVE DIRECTION:
- Think about where this avatar LIVES and WORKS. What does their world look like?
- A lending company targeting gig workers → city streets at dusk, car dashboards, urban intersections with ride-share lights
- A roofing company → aerial neighborhood rooftops, dramatic storm clouds over suburbs, close-up of roof shingles with rain
- A fitness brand → gym interior with moody lighting, weights rack in dramatic light, empty track at dawn
- A financial advisor → city skyline at blue hour, modern office corridor with warm lights, stock exchange floor
- A restaurant → kitchen with steam and warm light, table setting with candles, chef's hands plating food

TECHNICAL REQUIREMENTS:
- Wide aspect ratio (16:9 or wider)
- Dramatic atmospheric lighting — golden hour, blue hour, dramatic clouds, or moody interior ambient light
- Rich colors and deep shadows — this will have a colored overlay on top so darker images work better
- Shallow to medium depth of field for a cinematic feel
- NO people as the main subject (distant/tiny silhouettes are OK)
- NO text, logos, watermarks, or UI elements of ANY kind
- High resolution, cinematic photography style (think movie still or editorial spread)
- The scene MUST feel specific to the business and audience described above — not generic stock photography`
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
    return `You are an expert brand photographer creating a hero image for a landing page.

${customPrompt.trim()}.

PHOTOGRAPHY RULES:
- Full contextual scene photograph — the person is IN their natural environment.
- Warm, professional lighting. Shallow depth of field (f/1.8-2.8) with beautifully blurred background.
- The person should look confident, genuine, and approachable — looking at camera with a warm natural expression.
- Square or 4:5 aspect ratio (portrait orientation, not landscape).
- NO text, logos, watermarks, or overlays of any kind.
- NO artificial studio look. This should feel like a real moment captured by a professional photographer.
- High resolution, magazine-quality commercial photography.`
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

  // ── Hero image: contextual scene photo of the avatar in their world ──
  const offerContext = offerDescription
    ? `\nThe offer/service being promoted: ${offerDescription}`
    : ''

  const businessInfo = businessContext
    ? `\nBusiness context: ${businessContext}`
    : ''

  const sharedRules = `

PHOTOGRAPHY DIRECTION:
You are an expert brand photographer and creative director. Your job is to capture a single hero photograph that instantly communicates who this person is and what world they live in.

TECHNICAL REQUIREMENTS:
- Full contextual scene — the person is IN their real environment (their workplace, their daily setting, the place where they do what they do).
- Warm, natural lighting. Golden hour, window light, or soft ambient — never harsh or clinical.
- Shallow depth of field (f/1.8-2.8) — the person is sharp, the background is a beautiful soft bokeh that tells the story of their world.
- The person is the clear subject but the environment is visible and relevant. Think: a contractor on a job site, a nurse in a clinic hallway, a gig driver near their car, a parent in their kitchen.
- Square or 4:5 aspect ratio (portrait format).
- The person should look directly at camera with a warm, confident, genuine expression. Not overly posed. Natural.
- Their clothing MUST match who they really are. Read the avatar description carefully. A gig worker wears casual clothes. A trades worker wears work gear. A corporate exec wears a blazer. Match it exactly.

ABSOLUTE RULES:
- NO text, logos, watermarks, UI elements, or overlays of ANY kind.
- NO white/plain backgrounds. The person must be in a real, contextual environment.
- NO stock photo clichés (no pointing at screens, no fake handshakes, no sterile conference rooms unless that's actually their world).
- NO floating objects, icons, or decorative graphics.
- This must look like an editorial photograph from a brand campaign — authentic, aspirational, and specific to this person's life.
- High resolution, magazine-quality commercial photography. Think Apple or Nike campaign imagery.`

  const styleVariants: Record<string, string> = {
    hero: `Create a waist-up portrait photograph of a real person who matches this avatar description:
"${avatarDescription}"
${offerContext}
${businessInfo}

The person is in their natural environment — the place that defines their daily life. They are looking at camera with a warm, confident expression. 85mm lens perspective. The background tells the story of who they are.${sharedRules}`,

    family: `Create a medium shot photograph of a small relatable family (2-3 people) that matches this audience:
"${avatarDescription}"
${offerContext}
${businessInfo}

The family is in a natural home or everyday setting. They look happy, connected, and genuine — a real candid moment. Warm natural lighting. The environment reflects their real life.${sharedRules}`,

    trust: `Create a professional headshot photograph (shoulders-up, tightly framed) of a person who matches this description:
"${avatarDescription}"
${offerContext}
${businessInfo}

Direct eye contact with camera. Trustworthy and approachable. Soft natural key light. The background should be a softly blurred version of their professional environment — just enough to suggest context without distraction.${sharedRules}`,

    lifestyle: `Create a medium-wide editorial photograph showing a person who matches this description in an active moment:
"${avatarDescription}"
${offerContext}
${businessInfo}

The person is engaged in their work or daily activity — not just standing and posing. Show them doing what they do, but pausing to look at camera with a natural expression. Environmental storytelling through the setting.${sharedRules}`,
  }

  return styleVariants[imageStyle] || styleVariants.hero
}

/**
 * Generate an image using Gemini Flash (free tier).
 * Uses the generateContent endpoint with responseModalities: ["IMAGE"]
 *
 * Imagen requires a paid plan, but Gemini Flash image generation is free.
 */
async function generateImage(prompt: string, referenceImage?: { base64: string; mimeType: string }): Promise<Uint8Array> {
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

  // Build parts array — text prompt + optional reference image
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

  if (referenceImage) {
    // Add reference image first so the model "sees" it before reading the prompt
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.base64,
      },
    })
    // Prepend reference instruction to the prompt
    parts.push({
      text: `Use the attached image as a visual reference for style, composition, setting, and mood. Generate a NEW image inspired by it that matches the following direction:\n\n${prompt}`,
    })
  } else {
    parts.push({ text: prompt })
  }

  const body = {
    contents: [{
      parts,
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
      reference_image,           // Optional — { base64: string, mimeType: string } for image-to-image
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

    console.log(`Generating ${role} image for avatar "${avatar.name}" with style "${image_style}"${reference_image ? ' (with reference image)' : ''}`)
    console.log(`Prompt: ${imagePrompt.substring(0, 200)}...`)

    // Generate image via Gemini Flash (with optional reference image)
    const imageBytes = await generateImage(imagePrompt, reference_image || undefined)

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
