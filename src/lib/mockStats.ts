// ─────────────────────────────────────────────────────────────────────────
// Mock ad-platform stats — Google Ads + Meta Ads.
// Deterministic per-client; same input -> same output. No DB writes.
//
// Shape mirrors what the real Google Ads / Meta Marketing APIs return at
// (campaign, day) and (ad, day) granularity, so a future real-data swap is
// a source change inside this file, not a UI rebuild.
//
// Delete or replace this file when real integrations come online.
// ─────────────────────────────────────────────────────────────────────────


export type AdPlatform = 'google' | 'meta'

export const PLATFORM_LABEL: Record<AdPlatform, string> = {
  google: 'Google Ads',
  meta:   'Meta Ads',
}

export const PLATFORM_COLOR: Record<AdPlatform, string> = {
  google: '#4285F4',  // Google blue
  meta:   '#E4405F',  // Meta umbrella pink/red (Instagram-leaning)
}

// The five conversion events surfaced in the dropdown. Real Google/Meta data
// has a similar string-keyed structure where each campaign/ad reports counts
// per named conversion event.
//
// The first three form a funnel: every Qualified Lead is also a Lead; every
// Purchase is also a Qualified Lead. Phone Call and Add to Cart are
// independent tracks that don't strictly nest.
export const CONVERSION_EVENTS = [
  'Lead',
  'Qualified Lead',
  'Purchase',
  'Phone Call',
  'Add to Cart',
] as const
export type ConversionEvent = typeof CONVERSION_EVENTS[number]

export interface MockCampaign {
  id: string
  platform: AdPlatform
  name: string
  audience_label: string         // for display; in real data this is a
                                  // targeting/audience-id
  primary_event: ConversionEvent  // the campaign's optimization target
  status: 'active' | 'paused'
}

// Coarse creative-type bucket the user can filter by. Independent of the
// platform-specific `format` (search/display/etc.) which is a finer detail.
export type AdType = 'video' | 'static' | 'text'

export interface MockAd {
  id: string
  campaign_id: string
  platform: AdPlatform
  // Hub naming convention: AU{aud_seq}_OF{offer_seq}_BH{n}-{body_type}{n}-CTA{n}_V{n}
  // The convention tells you exactly which copy components went into the ad.
  name: string
  ad_type: AdType
  format: 'search' | 'display' | 'video' | 'image' | 'carousel'
  // Component IDs parsed back out of the name. Stored on the ad so the UI
  // doesn't have to re-parse on every aggregation.
  components: {
    audience_seq: number
    offer_seq: number
    bh: number
    body_type: 'SH' | 'T' | 'PC'
    body_seq: number
    cta: number
    variation: number  // V1, V2…
  }
}

// Per-client pool of copy components. Each entry has a stable seq number used
// in ad names + a fake excerpt so the UI can show "BH4 — Tired of overpriced…".
// In production the excerpts would come from copy_components.text; here they
// stay in the mock since the live copy_components rarely has matching rows
// loaded for the visible client.
export interface ComponentEntry {
  seq: number
  text: string
}

export interface ComponentPool {
  bh:  ComponentEntry[]
  sh:  ComponentEntry[]
  t:   ComponentEntry[]
  pc:  ComponentEntry[]
  cta: ComponentEntry[]
}

export interface DailyMetric {
  ad_id: string
  campaign_id: string
  platform: AdPlatform
  date: string  // YYYY-MM-DD
  spend: number
  impressions: number
  clicks: number
  // Counts per conversion event. Mirrors how Google Ads / Meta surface
  // multiple named conversion actions on the same ad.
  conversions: Record<ConversionEvent, number>
}

export interface MockStats {
  campaigns: MockCampaign[]
  ads: MockAd[]
  daily: DailyMetric[]   // one row per (ad, day)
  components: ComponentPool
}

// ─── Deterministic PRNG ──────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

// Box-Muller-ish: given uniform random in [0,1), bias toward the middle.
function bell(rng: () => number, low: number, high: number): number {
  const u = (rng() + rng() + rng()) / 3
  return low + (high - low) * u
}

// ─── Generator ───────────────────────────────────────────────────────────

interface GenerateInput {
  clientId: string
  clientName: string
  audiences: { id: string; name: string; display_id?: number | null }[]
  offers:    { id: string; name: string; display_id?: number | null }[]
  /** how many days of history to generate (default 90) */
  days?: number
}

const FORMATS_BY_PLATFORM: Record<AdPlatform, MockAd['format'][]> = {
  google: ['search', 'display', 'video'],
  meta:   ['image', 'carousel', 'video'],
}

// ad_type weights per platform (total ~1.0). Google leans text/RSA; Meta
// leans video/static.
const AD_TYPE_WEIGHTS: Record<AdPlatform, Array<[AdType, number]>> = {
  google: [['text', 0.60], ['static', 0.25], ['video', 0.15]],
  meta:   [['video', 0.60], ['static', 0.35], ['text', 0.05]],
}

function pickAdType(rng: () => number, platform: AdPlatform): AdType {
  const r = rng()
  let acc = 0
  for (const [t, w] of AD_TYPE_WEIGHTS[platform]) {
    acc += w
    if (r < acc) return t
  }
  return 'text'
}

// ad_type also constrains the platform-specific format. Meta video stays
// video; Google video stays video; static can be display/image; text is
// always Google search.
function pickFormatForAdType(rng: () => number, platform: AdPlatform, adType: AdType): MockAd['format'] {
  if (adType === 'video') return 'video'
  if (adType === 'text')  return platform === 'google' ? 'search' : 'image'
  // static
  return platform === 'google' ? 'display' : pick(rng, ['image', 'carousel'] as const)
}

// Fake excerpts for the per-client component pool. Tilted toward home-security
// language because the showcase client is SmarterHome.ai; reads as plausible
// for any home-services business too. The aggregation tab shows these next to
// the BH4/SH7/CTA3 labels so the user has something concrete to react to.
const BH_BANK = [
  'Suburban parents: is your alarm really working?',
  'Cost-conscious homeowners — security without the upsell.',
  'Empty nesters: the simplest security move you\'ll make.',
  'Tired of overpriced security systems?',
  'Tech-savvy homeowners, this changes everything.',
  'Hate pushy security salespeople?',
  'New homeowners: lock in fair pricing now.',
  'Frequent travelers — your home shouldn\'t be a target.',
  'Done with overengineered home security?',
  'Want security that actually works the first time?',
  'Family-first homeowners: protect what matters.',
  'Still relying on a 1990s alarm system?',
]
const SH_BANK = [
  'Custom plans designed around how you actually live.',
  '24/7 monitoring with response in under 30 seconds.',
  'No long-term contracts. Cancel anytime.',
  'Pro install in under 2 hours. Often same-day.',
  'Your existing equipment may already be compatible.',
  'Built by ex-military and law enforcement experts.',
  'A real local team, not a faceless call center.',
  'Quotes in writing, no hidden fees.',
  'Compatible with the smart home you already love.',
  'Free professional install on every plan.',
]
const T_BANK = [
  'BBB A+ rated since 2014.',
  'Licensed, bonded, and insured in 14 states.',
  'Family-owned and operated for over 20 years.',
  'UL-certified central station monitoring.',
  '4.9★ average from 3,200+ verified reviews.',
  'Featured in CNET, The Verge, and Wirecutter.',
]
const PC_BANK = [
  'Reduced false alarms by 72% across our service area last year.',
  'Helped 18,000+ families upgrade their home security.',
  'Average customer saves $340/year vs. their previous provider.',
  'Detected 1,140 attempted entries in 2026 alone.',
  '93% of customers stay on past their first year.',
  'Won "Best Home Security" three years running in [Region].',
  'Independent test labs rank our system #1 for response time.',
  'Customer-rated 4.9 stars on our last 1,000 installs.',
]
const CTA_BANK = [
  'Get My Free Security Plan',
  'Book My Free Walk-Through',
  'Claim My No-Obligation Quote',
  'See If My Home Qualifies',
  'Talk to a Real Expert',
  'Lock In Today\'s Pricing',
  'Schedule My Free Consult',
  'Get an Instant Quote',
  'Start My Custom Plan',
  'Reserve My Install Slot',
]

function buildComponentPool(rng: () => number): ComponentPool {
  // Sample size per type. Multiple ads will share these (the only way the
  // component aggregation is interesting).
  const take = (bank: string[], min: number, max: number): ComponentEntry[] => {
    const n = min + Math.floor(rng() * (max - min + 1))
    const shuffled = [...bank].sort(() => rng() - 0.5)
    return shuffled.slice(0, Math.min(n, bank.length)).map((text, i) => ({ seq: i + 1, text }))
  }
  return {
    bh:  take(BH_BANK,  8, 12),
    sh:  take(SH_BANK,  6, 10),
    t:   take(T_BANK,   4, 6),
    pc:  take(PC_BANK,  5, 8),
    cta: take(CTA_BANK, 6, 10),
  }
}

export function generateMockStats(input: GenerateInput): MockStats {
  const days = input.days ?? 90
  const baseSeed = hash(input.clientId)
  const rng = mulberry32(baseSeed)

  // Build 5-8 campaigns by mixing audiences × offers × platforms.
  // Fall back to AU1/OF1 when the caller didn't pass display_ids (only matters
  // for clients that pre-date migration 037).
  const audiences = (input.audiences.length > 0
    ? input.audiences
    : [{ id: 'aud-1', name: 'Primary Audience', display_id: 1 }])
    .map((a, i) => ({ ...a, display_id: a.display_id ?? i + 1 }))
  const offers = (input.offers.length > 0
    ? input.offers
    : [{ id: 'off-1', name: 'Main Offer', display_id: 1 }])
    .map((o, i) => ({ ...o, display_id: o.display_id ?? i + 1 }))

  // One per-client component pool. Component IDs (BH4, SH7, CTA3, etc.) are
  // shared across many ads — that's what makes the aggregation tab interesting.
  const components = buildComponentPool(rng)

  const targetCampaignCount = 5 + Math.floor(rng() * 4)  // 5-8
  const campaigns: MockCampaign[] = []
  // Round-robin through audience × offer combos so we get diversity, then
  // flip platforms to balance Google/Meta presence.
  const combos: Array<{ aud: typeof audiences[number]; off: typeof offers[number] }> = []
  for (const aud of audiences) for (const off of offers) combos.push({ aud, off })
  // Shuffle combos deterministically.
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[combos[i], combos[j]] = [combos[j], combos[i]]
  }

  for (let i = 0; i < targetCampaignCount && i < combos.length; i++) {
    const { aud, off } = combos[i]
    const platform: AdPlatform = i % 2 === 0 ? 'google' : 'meta'
    const channel = platform === 'google'
      ? pick(rng, ['Search', 'Display', 'YouTube', 'Performance Max'])
      : pick(rng, ['Feed', 'Reels', 'Stories', 'Audience Network'])
    const event: ConversionEvent = pick(rng, ['Lead', 'Qualified Lead', 'Purchase'])
    const status: MockCampaign['status'] = rng() > 0.18 ? 'active' : 'paused'
    campaigns.push({
      id: `c_${i + 1}`,
      platform,
      name: `${input.clientName} - ${aud.name} - ${off.name} - ${channel}`,
      audience_label: aud.name,
      primary_event: event,
      status,
    })
  }

  // 3-5 ads per campaign. Each ad picks BH/body/CTA from the shared pool so
  // multiple ads end up using the same component IDs — the only way the
  // component aggregation card has interesting peaks.
  const ads: MockAd[] = []
  for (const c of campaigns) {
    const adCount = 3 + Math.floor(rng() * 3)
    // Map campaign back to its (audience, offer) display IDs.
    const aud = audiences.find(a => a.name === c.audience_label) ?? audiences[0]
    const off = offers.find(o => c.name.includes(o.name)) ?? offers[0]
    const audSeq = aud.display_id ?? 1
    const offSeq = off.display_id ?? 1

    for (let k = 0; k < adCount; k++) {
      const adType = pickAdType(rng, c.platform)
      const fmt    = pickFormatForAdType(rng, c.platform, adType)

      const bh   = pick(rng, components.bh)
      // Body slot: SH/T/PC, weighted toward SH which is the most common
      // body type in real campaigns.
      const bodyTypeRoll = rng()
      const bodyType: 'SH' | 'T' | 'PC' =
        bodyTypeRoll < 0.55 ? 'SH' :
        bodyTypeRoll < 0.80 ? 'T'  : 'PC'
      const bodyEntry = pick(rng,
        bodyType === 'SH' ? components.sh :
        bodyType === 'T'  ? components.t  : components.pc,
      )
      const cta = pick(rng, components.cta)
      const variation = 1 + Math.floor(rng() * 3)  // V1..V3

      const name = `AU${audSeq}_OF${offSeq}_BH${bh.seq}-${bodyType}${bodyEntry.seq}-CTA${cta.seq}_V${variation}`

      ads.push({
        id: `${c.id}_a${k + 1}`,
        campaign_id: c.id,
        platform: c.platform,
        name,
        ad_type: adType,
        format: fmt,
        components: {
          audience_seq: audSeq,
          offer_seq: offSeq,
          bh: bh.seq,
          body_type: bodyType,
          body_seq: bodyEntry.seq,
          cta: cta.seq,
          variation,
        },
      })
    }
  }

  // Per-(ad, day) metrics.
  const daily: DailyMetric[] = []
  for (const ad of ads) {
    const camp = campaigns.find(c => c.id === ad.campaign_id)!
    // Each ad gets a stable scale factor so some ads are big spenders and
    // others are barely getting impressions — matches reality.
    const adRng = mulberry32(hash(ad.id))
    const baseSpend = 5 + adRng() * 50      // $5-$55 average daily spend
    const ctr       = 0.005 + adRng() * 0.025
    const cvr       = 0.02 + adRng() * 0.10
    const cpc       = 0.4 + adRng() * 2.6   // $0.40-$3.00 cost-per-click

    for (let d = 0; d < days; d++) {
      const dt = daysAgo(days - 1 - d)
      const dayRng = mulberry32(hash(`${ad.id}|${isoDay(dt)}`))
      // Paused campaigns spend 0 (still keep the row so the chart axis is steady).
      if (camp.status === 'paused' && d < days - 14) {
        // paused for the older portion of the window; resumes recently. Skip spend.
        daily.push({
          ad_id: ad.id, campaign_id: camp.id, platform: ad.platform, date: isoDay(dt),
          spend: 0, impressions: 0, clicks: 0,
          conversions: { 'Lead': 0, 'Qualified Lead': 0, 'Purchase': 0, 'Phone Call': 0, 'Add to Cart': 0 },
        })
        continue
      }
      // Weekday vs weekend variance + seasonal drift.
      const dow = dt.getUTCDay()
      const dowMult = dow === 0 || dow === 6 ? 0.65 : 1
      const trend = 1 + Math.sin((d / days) * Math.PI * 2) * 0.18
      const noise = bell(dayRng, 0.7, 1.3)
      const spend = Math.max(0, baseSpend * dowMult * trend * noise)
      const clicks = Math.max(0, Math.round(spend / cpc))
      const impressions = Math.round(clicks / Math.max(ctr, 0.001))

      // True funnel: Lead is the broad top of funnel, Qualified Lead is a
      // subset of leads, Purchase is a subset of qualified.
      // Phone Call and Add to Cart are independent micro-events.
      const leads = Math.max(0, Math.round(clicks * cvr))
      // Funnel invariant: leads >= qualified >= purchases for every row.
      // The math here can't break it given the percentage bounds, but the
      // explicit min() clamps protect the invariant if those bounds ever
      // change — the heatmap and Cost/Conv math depend on it.
      const qualifiedRaw = Math.round(leads * (0.30 + dayRng() * 0.20))     // 30-50% of leads
      const qualified    = Math.min(qualifiedRaw, leads)
      const purchasesRaw = Math.round(qualified * (0.10 + dayRng() * 0.15)) // 10-25% of qualified
      const purchases    = Math.min(purchasesRaw, qualified)
      const phoneCalls = Math.round(clicks * (0.005 + dayRng() * 0.015))
      const addToCart  = Math.round(clicks * (0.02  + dayRng() * 0.04))

      const conversions: Record<ConversionEvent, number> = {
        'Lead':           leads,
        'Qualified Lead': qualified,
        'Purchase':       purchases,
        'Phone Call':     phoneCalls,
        'Add to Cart':    addToCart,
      }

      daily.push({
        ad_id: ad.id,
        campaign_id: camp.id,
        platform: ad.platform,
        date: isoDay(dt),
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        conversions,
      })
    }
  }

  return { campaigns, ads, daily, components }
}

// ─── Aggregations the UI uses ────────────────────────────────────────────

export interface DateRange {
  from: string  // YYYY-MM-DD inclusive
  to:   string  // YYYY-MM-DD inclusive
}

export function inRange(day: string, range: DateRange): boolean {
  return day >= range.from && day <= range.to
}

export function previousPeriod(range: DateRange): DateRange {
  const from = new Date(range.from + 'T00:00:00Z')
  const to   = new Date(range.to   + 'T00:00:00Z')
  const span = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  const newTo   = new Date(from.getTime() - 86400000)
  const newFrom = new Date(newTo.getTime()   - (span - 1) * 86400000)
  return { from: isoDay(newFrom), to: isoDay(newTo) }
}

export interface RangeTotals {
  spend: number
  conversionsByEvent: Record<ConversionEvent, number>
  totalConversions: number
}

export function rollupRange(stats: MockStats, range: DateRange): RangeTotals {
  const totals: RangeTotals = {
    spend: 0,
    conversionsByEvent: {
      'Lead': 0, 'Qualified Lead': 0, 'Purchase': 0, 'Phone Call': 0, 'Add to Cart': 0,
    },
    totalConversions: 0,
  }
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    totals.spend += m.spend
    for (const e of CONVERSION_EVENTS) {
      const n = m.conversions[e]
      totals.conversionsByEvent[e] += n
      totals.totalConversions += n
    }
  }
  return totals
}

export interface DailyPlatformSpend {
  date: string
  google: number
  meta:   number
}

export function dailyByPlatform(stats: MockStats, range: DateRange): DailyPlatformSpend[] {
  const map = new Map<string, DailyPlatformSpend>()
  // Seed every day in the range so the chart has no gaps.
  const from = new Date(range.from + 'T00:00:00Z')
  const to   = new Date(range.to   + 'T00:00:00Z')
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const d = isoDay(new Date(t))
    map.set(d, { date: d, google: 0, meta: 0 })
  }
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    const row = map.get(m.date)
    if (!row) continue
    row[m.platform] += m.spend
  }
  return Array.from(map.values()).sort((a, b) => a.date < b.date ? -1 : 1)
}

// Daily heatmap row: spend + funnel counts for one day, after filtering.
// Drives the daily breakdown table on /stats/.
//
//   leads / qualified / conversions   — strict funnel: Lead -> Qualified Lead
//                                        -> Purchase. Invariant for every
//                                        row: leads >= qualified >= conversions.
//                                        Phone Call and Add to Cart are
//                                        deliberately excluded — they're
//                                        independent micro-events, not part
//                                        of the same funnel.
//   costPerConversion                 — spend / conversions, null when 0.
export interface HeatmapRow {
  date: string
  spend: number
  leads: number
  qualified: number
  conversions: number
  costPerConversion: number | null
}

export interface HeatmapFilters {
  platform?: AdPlatform | 'all'
  campaignId?: string | 'all'
  adId?: string | 'all'
}

export function dailyHeatmap(
  stats: MockStats,
  range: DateRange,
  filters: HeatmapFilters = {},
): HeatmapRow[] {
  const platform   = filters.platform   ?? 'all'
  const campaignId = filters.campaignId ?? 'all'
  const adId       = filters.adId       ?? 'all'

  const map = new Map<string, HeatmapRow>()
  const from = new Date(range.from + 'T00:00:00Z')
  const to   = new Date(range.to   + 'T00:00:00Z')
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const d = isoDay(new Date(t))
    map.set(d, { date: d, spend: 0, leads: 0, qualified: 0, conversions: 0, costPerConversion: null })
  }
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    if (platform   !== 'all' && m.platform    !== platform)   continue
    if (campaignId !== 'all' && m.campaign_id !== campaignId) continue
    if (adId       !== 'all' && m.ad_id       !== adId)       continue
    const row = map.get(m.date)
    if (!row) continue
    row.spend       += m.spend
    row.leads       += m.conversions['Lead']
    row.qualified   += m.conversions['Qualified Lead']
    // Conversions = bottom of the funnel only (Purchase). NOT the platform's
    // "all events" rollup — the user's funnel is strict, so this column
    // must remain >= 0 and <= qualified for every row.
    row.conversions += m.conversions['Purchase']
  }
  // Compute cost-per-conversion per row now that totals are settled.
  for (const row of map.values()) {
    row.costPerConversion = row.conversions > 0 ? row.spend / row.conversions : null
  }
  // Default: newest first.
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
}

// Daily funnel counts: Lead -> Qualified Lead -> Purchase. These three nest;
// Phone Call and Add to Cart are deliberately not included (they're separate
// tracks, not part of the same funnel).
export interface DailyFunnel {
  date: string
  lead: number
  qualified: number
  purchase: number
}

export function dailyFunnel(stats: MockStats, range: DateRange): DailyFunnel[] {
  const map = new Map<string, DailyFunnel>()
  const from = new Date(range.from + 'T00:00:00Z')
  const to   = new Date(range.to   + 'T00:00:00Z')
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const d = isoDay(new Date(t))
    map.set(d, { date: d, lead: 0, qualified: 0, purchase: 0 })
  }
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    const row = map.get(m.date)
    if (!row) continue
    row.lead      += m.conversions['Lead']
    row.qualified += m.conversions['Qualified Lead']
    row.purchase  += m.conversions['Purchase']
  }
  return Array.from(map.values()).sort((a, b) => a.date < b.date ? -1 : 1)
}

export interface CampaignRollup {
  campaign: MockCampaign
  spend: number
  conversionsForEvent: number  // for the currently selected conversion event
  costPerConversion: number | null
}

export function rollupByCampaign(
  stats: MockStats,
  range: DateRange,
  event: ConversionEvent,
): CampaignRollup[] {
  const acc = new Map<string, { spend: number; convs: number }>()
  for (const c of stats.campaigns) acc.set(c.id, { spend: 0, convs: 0 })
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    const row = acc.get(m.campaign_id)
    if (!row) continue
    row.spend += m.spend
    row.convs += m.conversions[event]
  }
  return stats.campaigns.map(c => {
    const r = acc.get(c.id)!
    return {
      campaign: c,
      spend: r.spend,
      conversionsForEvent: r.convs,
      costPerConversion: r.convs > 0 ? r.spend / r.convs : null,
    }
  })
}

export interface AdRollup {
  ad: MockAd
  campaignName: string
  spend: number
  conversionsForEvent: number
  costPerConversion: number | null
}

export function rollupByAd(
  stats: MockStats,
  range: DateRange,
  event: ConversionEvent,
  campaignFilter?: string,  // campaign id; undefined = all
): AdRollup[] {
  const acc = new Map<string, { spend: number; convs: number }>()
  for (const a of stats.ads) acc.set(a.id, { spend: 0, convs: 0 })
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    if (campaignFilter && m.campaign_id !== campaignFilter) continue
    const row = acc.get(m.ad_id)
    if (!row) continue
    row.spend += m.spend
    row.convs += m.conversions[event]
  }
  const campNameById = new Map(stats.campaigns.map(c => [c.id, c.name]))
  return stats.ads
    .filter(a => !campaignFilter || a.campaign_id === campaignFilter)
    .map(a => {
      const r = acc.get(a.id)!
      return {
        ad: a,
        campaignName: campNameById.get(a.campaign_id) ?? '—',
        spend: r.spend,
        conversionsForEvent: r.convs,
        costPerConversion: r.convs > 0 ? r.spend / r.convs : null,
      }
    })
}

export function fmtMoney(n: number): string {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return '$' + n.toFixed(2)
}

export function fmtNum(n: number): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function fmtPercentDelta(curr: number, prev: number): { text: string; positive: boolean } | null {
  if (!isFinite(curr) || !isFinite(prev) || prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  const positive = pct >= 0
  const sign = positive ? '+' : ''
  return { text: `${sign}${pct.toFixed(0)}%`, positive }
}

// ─── Top Performing Ad Copy aggregations ─────────────────────────────────

// Parses an ad name in Hub convention: AU1_OF3_BH4-SH5-CTA8_V1
// Returns null if the name doesn't match (custom-named ads still appear in
// the top-5-ads list but are excluded from component rollups).
const AD_NAME_RE = /^AU(\d+)_OF(\d+)_BH(\d+)-(SH|T|PC)(\d+)-CTA(\d+)(?:_V(\d+))?$/

export interface ParsedAdName {
  audSeq: number
  offSeq: number
  bh: number
  bodyType: 'SH' | 'T' | 'PC'
  bodySeq: number
  cta: number
  variation: number | null
}

export function parseAdName(name: string): ParsedAdName | null {
  const m = AD_NAME_RE.exec(name)
  if (!m) return null
  return {
    audSeq:   Number(m[1]),
    offSeq:   Number(m[2]),
    bh:       Number(m[3]),
    bodyType: m[4] as 'SH' | 'T' | 'PC',
    bodySeq:  Number(m[5]),
    cta:      Number(m[6]),
    variation: m[7] ? Number(m[7]) : null,
  }
}

export interface TopFilters {
  platform?: AdPlatform | 'all'
  adType?:   AdType | 'all'
}

export interface AdPerformanceRow {
  ad: MockAd
  campaign: MockCampaign | null
  spend: number
  qualified: number  // Qualified Lead count
  conversions: number  // Purchase count (matches the heatmap)
  costPerQualified: number | null
  costPerConversion: number | null
  parsed: ParsedAdName | null
}

export function adsPerformance(
  stats: MockStats,
  range: DateRange,
  filters: TopFilters = {},
): AdPerformanceRow[] {
  const platform = filters.platform ?? 'all'
  const adType   = filters.adType   ?? 'all'

  const acc = new Map<string, { spend: number; qualified: number; purchases: number }>()
  for (const a of stats.ads) acc.set(a.id, { spend: 0, qualified: 0, purchases: 0 })
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    if (platform !== 'all' && m.platform !== platform) continue
    const ad = stats.ads.find(a => a.id === m.ad_id)
    if (!ad) continue
    if (adType !== 'all' && ad.ad_type !== adType) continue
    const row = acc.get(m.ad_id)
    if (!row) continue
    row.spend     += m.spend
    row.qualified += m.conversions['Qualified Lead']
    row.purchases += m.conversions['Purchase']
  }
  const campById = new Map(stats.campaigns.map(c => [c.id, c]))
  return stats.ads
    .filter(a => platform === 'all' || a.platform === platform)
    .filter(a => adType   === 'all' || a.ad_type   === adType)
    .map(a => {
      const r = acc.get(a.id)!
      return {
        ad: a,
        campaign: campById.get(a.campaign_id) ?? null,
        spend: r.spend,
        qualified: r.qualified,
        conversions: r.purchases,
        costPerQualified:  r.qualified  > 0 ? r.spend / r.qualified  : null,
        costPerConversion: r.purchases > 0 ? r.spend / r.purchases : null,
        parsed: parseAdName(a.name),
      }
    })
}

export interface ComponentRollupRow {
  label: string         // e.g. "BH4", "SH7", "CTA3"
  seq: number
  type: 'BH' | 'SH' | 'T' | 'PC' | 'CTA'
  text: string          // excerpt
  spend: number
  qualified: number
  costPerQualified: number | null
  adCount: number
}

export interface ComponentRollups {
  bh:   ComponentRollupRow[]
  body: ComponentRollupRow[]   // SH + T + PC combined; type field tells you which
  cta:  ComponentRollupRow[]
}

export function rollupByComponent(
  stats: MockStats,
  range: DateRange,
  filters: TopFilters = {},
): ComponentRollups {
  const platform = filters.platform ?? 'all'
  const adType   = filters.adType   ?? 'all'

  // Map: type:seq -> { spend, qualified, adIds }
  type Bucket = { spend: number; qualified: number; ads: Set<string> }
  const empty = (): Bucket => ({ spend: 0, qualified: 0, ads: new Set() })
  const bh:   Map<number, Bucket> = new Map()
  const body: Map<string, Bucket> = new Map()  // key = "SH:5" / "T:2" / "PC:3"
  const cta:  Map<number, Bucket> = new Map()

  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    if (platform !== 'all' && m.platform !== platform) continue
    const ad = stats.ads.find(a => a.id === m.ad_id)
    if (!ad) continue
    if (adType !== 'all' && ad.ad_type !== adType) continue
    const p = parseAdName(ad.name)
    if (!p) continue   // skip non-standard names

    const sp = m.spend
    const ql = m.conversions['Qualified Lead']

    let b = bh.get(p.bh); if (!b) { b = empty(); bh.set(p.bh, b) }
    b.spend += sp; b.qualified += ql; b.ads.add(ad.id)

    const bodyKey = `${p.bodyType}:${p.bodySeq}`
    let bb = body.get(bodyKey); if (!bb) { bb = empty(); body.set(bodyKey, bb) }
    bb.spend += sp; bb.qualified += ql; bb.ads.add(ad.id)

    let cb = cta.get(p.cta); if (!cb) { cb = empty(); cta.set(p.cta, cb) }
    cb.spend += sp; cb.qualified += ql; cb.ads.add(ad.id)
  }

  const findText = (type: 'BH' | 'SH' | 'T' | 'PC' | 'CTA', seq: number): string => {
    const arr =
      type === 'BH'  ? stats.components.bh  :
      type === 'SH'  ? stats.components.sh  :
      type === 'T'   ? stats.components.t   :
      type === 'PC'  ? stats.components.pc  :
                       stats.components.cta
    return arr.find(c => c.seq === seq)?.text ?? ''
  }

  const bhRows: ComponentRollupRow[] = Array.from(bh.entries()).map(([seq, b]) => ({
    label: `BH${seq}`, seq, type: 'BH',
    text: findText('BH', seq),
    spend: b.spend, qualified: b.qualified,
    costPerQualified: b.qualified > 0 ? b.spend / b.qualified : null,
    adCount: b.ads.size,
  }))
  const bodyRows: ComponentRollupRow[] = Array.from(body.entries()).map(([key, b]) => {
    const [type, seqStr] = key.split(':') as [string, string]
    const seq = Number(seqStr)
    const t = type as 'SH' | 'T' | 'PC'
    return {
      label: `${t}${seq}`, seq, type: t,
      text: findText(t, seq),
      spend: b.spend, qualified: b.qualified,
      costPerQualified: b.qualified > 0 ? b.spend / b.qualified : null,
      adCount: b.ads.size,
    }
  })
  const ctaRows: ComponentRollupRow[] = Array.from(cta.entries()).map(([seq, b]) => ({
    label: `CTA${seq}`, seq, type: 'CTA',
    text: findText('CTA', seq),
    spend: b.spend, qualified: b.qualified,
    costPerQualified: b.qualified > 0 ? b.spend / b.qualified : null,
    adCount: b.ads.size,
  }))

  return { bh: bhRows, body: bodyRows, cta: ctaRows }
}
