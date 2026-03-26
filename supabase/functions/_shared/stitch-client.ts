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
 * Extract session ID from response headers.
 * Tries multiple header name casings since servers vary.
 */
function extractSessionId(res: Response, fallback?: string): string | null {
  // Try various header casings
  return res.headers.get('mcp-session-id')
    || res.headers.get('Mcp-Session-Id')
    || res.headers.get('MCP-Session-ID')
    || res.headers.get('x-mcp-session-id')
    || fallback
    || null
}

/**
 * Send a JSON-RPC request to the Stitch MCP server.
 */
async function mcpRequest(
  request: JsonRpcRequest,
  sessionId?: string
): Promise<{ response: JsonRpcResponse; sessionId: string | null; rawHeaders: string }> {
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

  // Collect all response headers for debugging
  const headerEntries: string[] = []
  res.headers.forEach((value, key) => {
    headerEntries.push(`${key}: ${value}`)
  })
  const rawHeaders = headerEntries.join('; ')

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Stitch MCP error ${res.status}: ${errorText}. Headers: ${rawHeaders}`)
  }

  const newSessionId = extractSessionId(res, sessionId || undefined)
  const response = await parseResponse(res)

  if (response.error) {
    throw new Error(`Stitch MCP RPC error: ${response.error.message} (code: ${response.error.code})`)
  }

  return { response, sessionId: newSessionId, rawHeaders }
}

/**
 * Initialize an MCP session with the Stitch server.
 * Returns the session ID for subsequent requests.
 */
async function initializeSession(): Promise<string> {
  // Step 1: Initialize
  const { response, sessionId, rawHeaders } = await mcpRequest({
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

  // Try to get session ID from response body if not in headers
  let finalSessionId = sessionId
  if (!finalSessionId && response.result && typeof response.result === 'object') {
    const result = response.result as Record<string, unknown>
    if (result.sessionId) {
      finalSessionId = result.sessionId as string
    }
    if (result.meta && typeof result.meta === 'object') {
      const meta = result.meta as Record<string, unknown>
      if (meta.sessionId) finalSessionId = meta.sessionId as string
    }
  }

  // If still no session ID, generate one from the response or use a placeholder
  // Some MCP servers don't require session IDs for stateless operation
  if (!finalSessionId) {
    // Log details for debugging but don't fail — try to proceed without session
    console.warn(`Stitch MCP: No session ID found. Response headers: ${rawHeaders}. Result keys: ${response.result ? Object.keys(response.result as object).join(', ') : 'none'}`)
    finalSessionId = `fallback-${Date.now()}`
  }

  // Step 2: Send initialized notification (no id = notification)
  try {
    await mcpRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }, finalSessionId)
  } catch (e) {
    // Non-fatal — some servers don't require this notification
    console.warn(`Stitch MCP: initialized notification failed: ${(e as Error).message}`)
  }

  return finalSessionId
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
 * Parse the MCP tool result. Stitch returns:
 * { content: [{ type: 'text', text: '<JSON string>' }] }
 * or possibly { structuredContent: { ... } }
 * We need to parse the JSON text to get the actual data.
 */
function parseToolResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object') {
    throw new Error(`Unexpected tool result type: ${typeof result}`)
  }

  const r = result as Record<string, unknown>

  // Check for error flag
  if (r.isError) {
    const errorText = extractTextResult(result)
    throw new Error(`Stitch tool error: ${errorText}`)
  }

  // Check structuredContent first (preferred)
  if (r.structuredContent && typeof r.structuredContent === 'object') {
    return r.structuredContent as Record<string, unknown>
  }

  // Parse text content as JSON
  const textContent = extractTextResult(result)
  try {
    return JSON.parse(textContent) as Record<string, unknown>
  } catch {
    // Return as-is in a wrapper
    return { _raw: textContent }
  }
}

/**
 * Deep search for a key in a nested object.
 * Returns the first value found at any depth.
 */
function deepFind(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const o = obj as Record<string, unknown>
  if (key in o) return o[key]
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') {
      const found = deepFind(v, key)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * Generate a landing page via the Stitch API.
 * Sends the assembled prompt and returns the HTML output.
 *
 * Flow (matching the SDK's internal behavior):
 * 1. create_project({ title }) -> returns { name: "projects/12345..." }
 * 2. generate_screen_from_text({ projectId, prompt, deviceType })
 *    -> returns { outputComponents[0].design.screens[0].{htmlCode, screenshot} }
 * 3. Download HTML from htmlCode.downloadUrl
 */
export async function generateWithStitch(
  prompt: string,
  options?: { title?: string; device?: 'DESKTOP' | 'MOBILE' | 'AGNOSTIC' }
): Promise<{ html: string; imageUrl: string | null; screenId: string; projectId: string }> {
  if (!STITCH_API_KEY) {
    throw new Error(
      'STITCH_API_KEY not configured. Go to stitch.withgoogle.com, ' +
      'Settings, generate an API key, then run: ' +
      'npx supabase secrets set STITCH_API_KEY=your-key'
    )
  }

  // Initialize MCP session
  const sessionId = await initializeSession()

  // Step 1: Create project — returns { name: "projects/12345..." }
  const createResult = await callTool(sessionId, 'create_project', {
    title: options?.title || `Landing Page ${new Date().toISOString()}`,
  }, 2)

  const projectData = parseToolResult(createResult)
  // Extract project ID: strip "projects/" prefix from name field
  let projectName = (projectData.name as string) || ''
  if (projectName.startsWith('projects/')) {
    projectName = projectName.slice(9)
  }
  const projectId = projectName

  if (!projectId) {
    throw new Error(`Stitch create_project did not return a project name. Got: ${JSON.stringify(projectData).substring(0, 300)}`)
  }

  // Step 2: Generate screen from the assembled prompt
  // This can take a few minutes per Stitch docs
  const generateResult = await callTool(sessionId, 'generate_screen_from_text', {
    projectId,
    prompt,
    deviceType: options?.device || 'DESKTOP',
    modelId: 'GEMINI_3_PRO',
  }, 3)

  const genData = parseToolResult(generateResult)

  // Step 3: Extract screen data
  // SDK path: outputComponents[0].design.screens[0]
  let htmlUrl: string | null = null
  let imageUrl: string | null = null
  let screenId = ''

  // Try the known SDK structure first
  try {
    const outputComponents = genData.outputComponents as Array<Record<string, unknown>>
    if (outputComponents?.[0]) {
      const design = outputComponents[0].design as Record<string, unknown>
      if (design?.screens && Array.isArray(design.screens)) {
        const screen = design.screens[0] as Record<string, unknown>
        screenId = (screen.screenId as string) || (screen.name as string) || ''
        if (screen.htmlCode && typeof screen.htmlCode === 'object') {
          htmlUrl = (screen.htmlCode as Record<string, string>).downloadUrl || null
        }
        if (screen.screenshot && typeof screen.screenshot === 'object') {
          imageUrl = (screen.screenshot as Record<string, string>).downloadUrl || null
        }
      }
    }
  } catch {
    // Structure didn't match, try deep search
  }

  // Fallback: deep search for downloadUrl in the response
  if (!htmlUrl) {
    const foundHtmlCode = deepFind(genData, 'htmlCode')
    if (foundHtmlCode && typeof foundHtmlCode === 'object') {
      htmlUrl = (foundHtmlCode as Record<string, string>).downloadUrl || null
    }
  }
  if (!imageUrl) {
    const foundScreenshot = deepFind(genData, 'screenshot')
    if (foundScreenshot && typeof foundScreenshot === 'object') {
      imageUrl = (foundScreenshot as Record<string, string>).downloadUrl || null
    }
  }
  if (!screenId) {
    screenId = (deepFind(genData, 'screenId') as string) || projectId
  }

  // If still no HTML URL, try get_screen as fallback
  if (!htmlUrl && screenId) {
    try {
      const screenResult = await callTool(sessionId, 'get_screen', {
        name: `projects/${projectId}/screens/${screenId}`,
        projectId,
        screenId,
      }, 4)

      const screenInfo = parseToolResult(screenResult)
      if (screenInfo.htmlCode && typeof screenInfo.htmlCode === 'object') {
        htmlUrl = (screenInfo.htmlCode as Record<string, string>).downloadUrl || null
      }
      if (!imageUrl && screenInfo.screenshot && typeof screenInfo.screenshot === 'object') {
        imageUrl = (screenInfo.screenshot as Record<string, string>).downloadUrl || null
      }
    } catch (e) {
      console.warn(`get_screen fallback failed: ${(e as Error).message}`)
    }
  }

  // Step 4: Download the HTML
  let html = ''
  if (htmlUrl) {
    const htmlResponse = await fetch(htmlUrl)
    if (!htmlResponse.ok) {
      throw new Error(`Failed to download HTML from Stitch: ${htmlResponse.status}`)
    }
    html = await htmlResponse.text()
  } else {
    // Check if the raw result contains HTML
    const rawText = genData._raw as string || JSON.stringify(genData)
    if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
      html = rawText
    } else {
      throw new Error(
        'Stitch did not return an HTML download URL. ' +
        `Raw result: ${JSON.stringify(genData).substring(0, 500)}`
      )
    }
  }

  return { html, imageUrl, screenId, projectId }
}

/**
 * Edit an existing Stitch screen with a change request.
 */
export async function editWithStitch(
  prompt: string,
  options?: { title?: string; device?: 'DESKTOP' | 'MOBILE' | 'AGNOSTIC' }
): Promise<{ html: string; imageUrl: string | null; screenId: string; projectId: string }> {
  return generateWithStitch(prompt, options)
}
