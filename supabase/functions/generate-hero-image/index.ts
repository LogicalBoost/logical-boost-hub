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
 * Build an image generation prompt from avatar data.
 * Creates a professional, brand-safe hero shot description.
 */
function buildImagePrompt(
  avatarDescription: string,
  imageStyle: string = 'hero',
  customPrompt?: string
): string {
  if (customPrompt?.trim()) {
    // User provided their own prompt — wrap with quality instructions
    return `${customPrompt.trim()}. Professional commercial photography, studio lighting, clean modern background, high resolution, shallow depth of field. The person should look confident, approachable, and genuine.`
  }

  // Extract demographic hints from avatar description
  const desc = avatarDescription.toLowerCase()

  // Determine setting context from avatar description
  let settingContext = 'a modern professional environment'
  if (desc.includes('home') || desc.includes('family') || desc.includes('parent')) {
    settingContext = 'a bright, comfortable modern home'
  } else if (desc.includes('office') || desc.includes('business') || desc.includes('executive') || desc.includes('corporate')) {
    settingContext = 'a sleek modern office with natural light'
  } else if (desc.includes('outdoor') || desc.includes('active') || desc.includes('fitness')) {
    settingContext = 'an outdoor setting with natural light'
  } else if (desc.includes('medical') || desc.includes('health') || desc.includes('doctor') || desc.includes('patient')) {
    settingContext = 'a clean, modern healthcare setting'
  } else if (desc.includes('student') || desc.includes('education') || desc.includes('learn')) {
    settingContext = 'a bright, modern learning environment'
  } else if (desc.includes('tech') || desc.includes('developer') || desc.includes('startup')) {
    settingContext = 'a modern tech workspace'
  }

  // Determine emotional expression from avatar
  let emotionalExpression = 'looking confident and approachable with a genuine smile'
  if (desc.includes('stress') || desc.includes('overwhelm') || desc.includes('frustrat')) {
    // For pain-point avatars, show the SOLUTION state — relieved, happy
    emotionalExpression = 'looking relieved and optimistic, genuine smile, as if a weight has been lifted'
  } else if (desc.includes('success') || desc.includes('achiev') || desc.includes('ambitious')) {
    emotionalExpression = 'looking accomplished and confident, natural smile'
  } else if (desc.includes('skepti') || desc.includes('cautious') || desc.includes('careful')) {
    emotionalExpression = 'looking thoughtful and assured, with a warm natural expression'
  }

  const styleVariants: Record<string, string> = {
    hero: `Professional photograph of a person, ${emotionalExpression}, in ${settingContext}. Waist-up portrait composition. Clean modern background with subtle depth, soft diffused natural lighting. Commercial advertising photography style, high resolution, shallow depth of field, 85mm lens look. The person is the clear focal point.`,
    family: `Professional photograph of a small diverse family (2-3 people), looking happy and connected, in ${settingContext}. Natural candid moment with genuine expressions. Warm soft lighting, medium shot composition. Commercial lifestyle photography style, high resolution, shallow depth of field. Authentic and relatable.`,
    trust: `Professional headshot-style photograph of a person, ${emotionalExpression}, clean solid-color background with subtle gradient. Shoulders-up composition, direct eye contact with camera. Studio lighting with soft key light. Executive portrait photography style, high resolution. Trustworthy and professional.`,
    lifestyle: `Professional lifestyle photograph of a person in ${settingContext}, ${emotionalExpression}. Environmental portrait with context clues of their world. Natural light, medium-wide composition. Editorial photography style, high resolution, cinematic color grading. Authentic and aspirational.`,
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

    // Build the image prompt from avatar description
    const imagePrompt = buildImagePrompt(
      avatar.description || avatar.name,
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

    return jsonResponse({
      success: true,
      image_url: publicUrl,
      storage_path: storagePath,
      prompt_used: imagePrompt,
      style: image_style,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
