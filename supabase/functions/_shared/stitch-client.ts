// Stitch API Client for Supabase Edge Functions (Deno)
//
// Calls the Google Stitch MCP server directly via HTTP JSON-RPC.
// The @google/stitch-sdk npm package uses Node.js dependencies (zod/v4,
// @modelcontextprotocol/sdk) that don't work in Deno, so we speak the
// MCP Streamable HTTP protocol directly with fetch().
//
// Protocol: JSON-RPC 2.0 over HTTP POST to https://stitch.googleapis.com/mcp
// Auth: X-Goog-Api-Key header
// Session: Mcp-Session-Id header returned from initialize

const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp'
const STITCH_API_KEY = Deno.env.get('STITCH_API_KEY')

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/**
 * Parse a response that may be JSON or SSE (text/event-stream).
 * Stitch MCP server can return either format.
 */
async function parseResponse(response: Response): Promise<JsonRpcResponse> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('text/event-stream')) {
    // Parse SSE: look for data: lines containing JSON-RPC responses
    const text = await response.text()
    const lines = text.split('\n')
    let lastData: string | null = null

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        lastData = line.slice(6).trim()
      }
    }

    if (lastData) {
      return JSON.parse(lastData) as JsonRpcResponse
    }
    throw new Error('No data found in SSE response')
  }

  // Standard JSON response
  return await response.json() as JsonRpcResponse
}

/**
 * Send a JSON-RPC request to the Stitch MCP server.
 */
async function mcpRequest(
  request: JsonRpcRequest,
  sessionId?: string
): Promise<{ response: JsonRpcResponse; sessionId: string | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'X-Goog-Api-Key': STITCH_API_KEY!,
  }

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId
  }

  const res = await fetch(STITCH_MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Stitch MCP error ${res.status}: ${errorText}`)
  }

  const newSessionId = res.headers.get('mcp-session-id') || sessionId || null
  const response = await parseResponse(res)

  if (response.error) {
    throw new Error(`Stitch MCP RPC error: ${response.error.message} (code: ${response.error.code})`)
  }

  return { response, sessionId: newSessionId }
}

/**
 * Initialize an MCP session with the Stitch server.
 * Returns the session ID for subsequent requests.
 */
async function initializeSession(): Promise<string> {
  // Step 1: Initialize
  const { sessionId } = await mcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: {
        name: 'logical-boost-hub',
        version: '1.0.0',
      },
    },
  })

  if (!sessionId) {
    throw new Error('Stitch MCP server did not return a session ID')
  }

  // Step 2: Send initialized notification (no id = notification)
  await mcpRequest({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }, sessionId)

  return sessionId
}

/**
 * Call an MCP tool on the Stitch server.
 */
async function callTool(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  requestId: number
): Promise<unknown> {
  const { response } = await mcpRequest({
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  }, sessionId)

  return response.result
}

/**
 * Extract text content from an MCP tool result.
 * Tool results come as { content: [{ type: 'text', text: '...' }] }
 */
function extractTextResult(result: unknown): string {
  if (result && typeof result === 'object') {
    const r = result as { content?: Array<{ type: string; text: string }> }
    if (r.content && Array.isArray(r.content)) {
      const textParts = r.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
      return textParts.join('\n')
    }
  }
  return JSON.stringify(result)
}

/**
 * Generate a landing page via the Stitch API.
 * Sends the assembled prompt and returns the HTML output.
 */
export async function generateWithStitch(
  prompt: string,
  options?: { projectId?: string; device?: 'DESKTOP' | 'MOBILE' | 'AGNOSTIC' }
): Promise<{ html: string; imageUrl: string | null; screenId: string }> {
  if (!STITCH_API_KEY) {
    throw new Error(
      'STITCH_API_KEY not configured. Go to stitch.withgoogle.com, ' +
      'Settings, generate an API key, then run: ' +
      'npx supabase secrets set STITCH_API_KEY=your-key'
    )
  }

  // Initialize MCP session
  const sessionId = await initializeSession()

  const projectId = options?.projectId || `lbh-build-${Date.now()}`

  // Create project
  await callTool(sessionId, 'create_project', {
    projectId,
  }, 2)

  // Generate screen from the assembled prompt
  const generateResult = await callTool(sessionId, 'generate_screen_from_text', {
    projectId,
    prompt,
    deviceType: options?.device || 'DESKTOP',
  }, 3)

  // Parse the result to find download URLs
  const resultText = extractTextResult(generateResult)
  let screenData: Record<string, unknown> | null = null

  try {
    screenData = JSON.parse(resultText)
  } catch {
    // Result might be a description, not JSON. Try to get screen details directly.
  }

  // Try to extract URLs from the generate result
  let htmlUrl: string | null = null
  let imageUrl: string | null = null
  let screenId = projectId

  if (screenData) {
    // Navigate the response structure to find download URLs
    // Structure: outputComponents[0].design.screens[0].htmlCode.downloadUrl
    const output = screenData as Record<string, unknown>

    // Try direct screen data
    if (output.htmlCode && typeof output.htmlCode === 'object') {
      htmlUrl = (output.htmlCode as Record<string, string>).downloadUrl || null
    }
    if (output.screenshot && typeof output.screenshot === 'object') {
      imageUrl = (output.screenshot as Record<string, string>).downloadUrl || null
    }
    if (output.screenId) {
      screenId = output.screenId as string
    }

    // Try nested outputComponents structure
    if (!htmlUrl && output.outputComponents && Array.isArray(output.outputComponents)) {
      const comp = output.outputComponents[0] as Record<string, unknown>
      if (comp?.design && typeof comp.design === 'object') {
        const design = comp.design as Record<string, unknown>
        if (design.screens && Array.isArray(design.screens)) {
          const screen = design.screens[0] as Record<string, unknown>
          if (screen?.htmlCode && typeof screen.htmlCode === 'object') {
            htmlUrl = (screen.htmlCode as Record<string, string>).downloadUrl || null
          }
          if (screen?.screenshot && typeof screen.screenshot === 'object') {
            imageUrl = (screen.screenshot as Record<string, string>).downloadUrl || null
          }
          if (screen?.screenId) {
            screenId = screen.screenId as string
          }
        }
      }
    }
  }

  // If we didn't get URLs from generate, try get_screen
  if (!htmlUrl) {
    try {
      const screenResult = await callTool(sessionId, 'get_screen', {
        projectId,
        screenId,
      }, 4)

      const screenText = extractTextResult(screenResult)
      const screenInfo = JSON.parse(screenText)

      if (screenInfo?.htmlCode?.downloadUrl) {
        htmlUrl = screenInfo.htmlCode.downloadUrl
      }
      if (screenInfo?.screenshot?.downloadUrl) {
        imageUrl = screenInfo.screenshot.downloadUrl
      }
    } catch {
      // get_screen failed, will check if we have the HTML as text
    }
  }

  // If we have a download URL, fetch the HTML
  let html = ''
  if (htmlUrl) {
    const htmlResponse = await fetch(htmlUrl)
    if (!htmlResponse.ok) {
      throw new Error(`Failed to download HTML from Stitch: ${htmlResponse.status}`)
    }
    html = await htmlResponse.text()
  } else {
    // The result text itself might be the HTML or contain it
    if (resultText.includes('<!DOCTYPE') || resultText.includes('<html')) {
      html = resultText
    } else {
      throw new Error(
        'Stitch did not return an HTML download URL. ' +
        `Raw result: ${resultText.substring(0, 500)}`
      )
    }
  }

  return {
    html,
    imageUrl,
    screenId,
  }
}

/**
 * Edit an existing Stitch screen with a change request.
 */
export async function editWithStitch(
  prompt: string,
  options?: { projectId?: string; device?: 'DESKTOP' | 'MOBILE' | 'AGNOSTIC' }
): Promise<{ html: string; imageUrl: string | null; screenId: string }> {
  // For edits, we regenerate with the full updated prompt
  return generateWithStitch(prompt, options)
}
