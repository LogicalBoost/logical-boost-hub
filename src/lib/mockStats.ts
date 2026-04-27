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

import type { Avatar, Offer } from '@/types/database'

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

export interface MockAd {
  id: string
  campaign_id: string
  platform: AdPlatform
  name: string
  format: 'search' | 'display' | 'video' | 'image' | 'carousel'
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
  audiences: Pick<Avatar, 'id' | 'name'>[]
  offers: Pick<Offer, 'id' | 'name'>[]
  /** how many days of history to generate (default 90) */
  days?: number
}

const FORMATS_BY_PLATFORM: Record<AdPlatform, MockAd['format'][]> = {
  google: ['search', 'display', 'video'],
  meta:   ['image', 'carousel', 'video'],
}

const AD_HEADLINE_FRAGMENTS = [
  'Free Quote', 'Same-Day Service', 'No Obligation', 'Limited Time',
  '5-Star Rated', 'Family Owned', 'Local Experts', 'Save 30%',
  'Hassle-Free', 'Get Started Today', 'Custom Plan', 'Trusted Choice',
]

export function generateMockStats(input: GenerateInput): MockStats {
  const days = input.days ?? 90
  const baseSeed = hash(input.clientId)
  const rng = mulberry32(baseSeed)

  // Build 5-8 campaigns by mixing audiences × offers × platforms.
  const audiences = input.audiences.length > 0
    ? input.audiences
    : [{ id: 'aud-1', name: 'Primary Audience' }]
  const offers = input.offers.length > 0
    ? input.offers
    : [{ id: 'off-1', name: 'Main Offer' }]

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

  // 3-5 ads per campaign.
  const ads: MockAd[] = []
  for (const c of campaigns) {
    const adCount = 3 + Math.floor(rng() * 3)
    for (let k = 0; k < adCount; k++) {
      const fmt = pick(rng, FORMATS_BY_PLATFORM[c.platform])
      const headline = `${pick(rng, AD_HEADLINE_FRAGMENTS)} · ${c.audience_label.split(' ')[0]} v${k + 1}`
      ads.push({
        id: `${c.id}_a${k + 1}`,
        campaign_id: c.id,
        platform: c.platform,
        name: headline,
        format: fmt,
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
      const qualified = Math.round(leads * (0.30 + dayRng() * 0.20))     // 30-50% of leads
      const purchases = Math.round(qualified * (0.10 + dayRng() * 0.15)) // 10-25% of qualified
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

  return { campaigns, ads, daily }
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
export interface HeatmapRow {
  date: string
  spend: number
  leads: number
  qualified: number
  purchases: number
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
    map.set(d, { date: d, spend: 0, leads: 0, qualified: 0, purchases: 0 })
  }
  for (const m of stats.daily) {
    if (!inRange(m.date, range)) continue
    if (platform   !== 'all' && m.platform    !== platform)   continue
    if (campaignId !== 'all' && m.campaign_id !== campaignId) continue
    if (adId       !== 'all' && m.ad_id       !== adId)       continue
    const row = map.get(m.date)
    if (!row) continue
    row.spend     += m.spend
    row.leads     += m.conversions['Lead']
    row.qualified += m.conversions['Qualified Lead']
    row.purchases += m.conversions['Purchase']
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
