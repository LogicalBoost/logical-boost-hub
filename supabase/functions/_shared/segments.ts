// Segment resolution helpers for edge functions.
//
// Every segment-scoped child row needs a `segment_id`. Edge functions accept
// an optional `segment_id` in their request body; when absent we fall back
// to the client's default segment. These helpers centralize that logic.

// deno-lint-ignore-file no-explicit-any
type SupabaseClient = any

/** Fetch the default segment row for a client (auto-created in migration 008). */
export async function getDefaultSegment(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw new Error(`Failed to load default segment: ${error.message}`)
  return data
}

/**
 * Resolve the segment ID to use for a request.
 * If `segmentId` is provided and valid for this client, use it.
 * Otherwise fall back to the client's default segment (auto-created if missing).
 */
export async function resolveSegmentId(
  supabase: SupabaseClient,
  clientId: string,
  segmentId?: string | null,
): Promise<string> {
  if (segmentId) {
    const { data } = await supabase
      .from('segments')
      .select('id, client_id')
      .eq('id', segmentId)
      .maybeSingle()
    if (data && data.client_id === clientId) return data.id
  }

  const defaultSeg = await getDefaultSegment(supabase, clientId)
  if (defaultSeg) return defaultSeg.id

  // Client has no default segment yet — create one on the fly
  const { data: created, error } = await supabase
    .from('segments')
    .insert({
      client_id: clientId,
      name: 'Default',
      slug: 'default',
      is_default: true,
      sort_order: 0,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create default segment: ${error.message}`)
  return created.id
}

/** Fetch a full segment row by ID. Used by generators that need voice/guardrails. */
export async function getSegment(supabase: SupabaseClient, segmentId: string) {
  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('id', segmentId)
    .single()
  if (error) throw new Error(`Failed to load segment: ${error.message}`)
  return data
}
