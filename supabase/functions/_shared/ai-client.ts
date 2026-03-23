// Shared AI client for Supabase Edge Functions
// Uses Claude API for all generation workflows

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const model = options?.model || 'claude-haiku-4-5-20251001'
  const maxTokens = options?.maxTokens || 4096

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }] as Message[],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''

  return text
}

export function parseJsonResponse<T>(text: string): T {
  // Try to extract JSON from the response, handling markdown code blocks
  // Handle both complete (```json...```) and truncated (```json... without closing) blocks
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
    || text.match(/```\s*([\s\S]*?)```/)
    || text.match(/```json\s*([\s\S]*)/)
    || text.match(/```\s*([\s\S]*)/)
  let jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()

  // If the JSON is truncated (no closing brace), try to repair it
  if (jsonStr && !jsonStr.endsWith('}')) {
    // Find the last complete object/array by counting braces
    let braceCount = 0
    let lastValidPos = -1
    for (let i = 0; i < jsonStr.length; i++) {
      if (jsonStr[i] === '{') braceCount++
      if (jsonStr[i] === '}') {
        braceCount--
        if (braceCount === 0) lastValidPos = i
      }
    }
    if (lastValidPos > 0) {
      jsonStr = jsonStr.substring(0, lastValidPos + 1)
    }
  }

  try {
    return JSON.parse(jsonStr) as T
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${jsonStr.substring(0, 200)}...`)
  }
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}
