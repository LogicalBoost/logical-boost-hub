// Stitch API Client for Supabase Edge Functions (Deno)
// Wraps the Google Stitch SDK for landing page generation

const STITCH_API_KEY = Deno.env.get('STITCH_API_KEY')

/**
 * Generate a landing page via the Stitch API.
 * Sends the assembled prompt and returns the HTML output.
 */
export async function generateWithStitch(
  prompt: string,
  options?: { projectId?: string; device?: 'DESKTOP' | 'MOBILE' | 'AGNOSTIC' }
): Promise<{ html: string; imageUrl: string | null; screenId: string }> {
  if (!STITCH_API_KEY) {
    throw new Error('STITCH_API_KEY not configured. Go to stitch.withgoogle.com → Settings to generate one, then run: npx supabase secrets set STITCH_API_KEY=your-key')
  }

  // Dynamic import of the Stitch SDK
  const { stitch } = await import('https://esm.sh/@google/stitch-sdk@0.0.3')

  // Use the provided project ID or create one from timestamp
  const projectId = options?.projectId || `lbh-build-${Date.now()}`
  const project = stitch.project(projectId)

  // Generate the screen with our assembled prompt
  const screen = await project.generate(prompt, {
    device: options?.device || 'DESKTOP',
  })

  // Get the HTML download URL
  const htmlUrl = await screen.getHtml()

  // Download the actual HTML content
  const htmlResponse = await fetch(htmlUrl)
  if (!htmlResponse.ok) {
    throw new Error(`Failed to download Stitch HTML: ${htmlResponse.status}`)
  }
  const html = await htmlResponse.text()

  // Get the screenshot URL (for preview thumbnails)
  let imageUrl: string | null = null
  try {
    imageUrl = await screen.getImage()
  } catch {
    // Screenshot is optional — don't fail the build
  }

  return {
    html,
    imageUrl,
    screenId: screen.id || projectId,
  }
}

/**
 * Edit an existing Stitch screen with a change request.
 * Uses the original prompt + change instruction.
 */
export async function editWithStitch(
  prompt: string,
  options?: { projectId?: string; device?: 'DESKTOP' | 'MOBILE' | 'AGNOSTIC' }
): Promise<{ html: string; imageUrl: string | null; screenId: string }> {
  // For edits, we regenerate with the full updated prompt
  // (original prompt + iteration instruction appended)
  return generateWithStitch(prompt, options)
}
