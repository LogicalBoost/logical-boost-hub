'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  generateMockStats,
  rollupRange,
  dailyHeatmap,
  adsPerformance,
  rollupByComponent,
  previousPeriod,
  fmtMoney,
  fmtNum,
  fmtPercentDelta,
  CONVERSION_EVENTS,
  PLATFORM_LABEL,
} from '@/lib/mockStats'
import type {
  ConversionEvent, AdPlatform, AdType, HeatmapRow,
  AdPerformanceRow, ComponentRollupRow,
} from '@/lib/mockStats'

type Preset = '7' | '30' | '90' | 'custom'

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeFromPreset(preset: Preset, custom: { from: string; to: string }): { from: string; to: string } {
  if (preset === 'custom') return custom
  const days = Number(preset)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const to = isoDay(today)
  const fromDate = new Date(today.getTime() - (days - 1) * 86400000)
  return { from: isoDay(fromDate), to }
}

export default function StatsPage() {
  const { client, avatars, offers } = useAppStore()
  const [preset, setPreset] = useState<Preset>('30')
  const today = isoDay(new Date())
  const [custom, setCustom] = useState({ from: isoDay(new Date(Date.now() - 29 * 86400000)), to: today })
  const [event, setEvent] = useState<ConversionEvent>('Qualified Lead')

  // Heatmap-table-only filters. Cascading: platform → campaign → ad.
  // These do NOT scope the cards/charts above (see the note in the report).
  const [tablePlatform, setTablePlatform] = useState<'all' | AdPlatform>('all')
  const [tableCampaign, setTableCampaign] = useState<string>('all')
  const [tableAd,       setTableAd]       = useState<string>('all')
  type SortKey = 'date' | 'spend' | 'leads' | 'qualified' | 'conversions' | 'costPerConversion'
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Top Performing Ad Copy section — its own platform + ad_type filter and
  // a sort metric. Scoped only to that section.
  const [topPlatform, setTopPlatform] = useState<'all' | AdPlatform>('all')
  const [topAdType,   setTopAdType]   = useState<'all' | AdType>('all')
  type TopSortMetric = 'cpql' | 'conversions' | 'cpc'
  const [topSort, setTopSort] = useState<TopSortMetric>('cpql')

  // Narrow-viewport detection for the heatmap table. Below 600px we tighten
  // padding, abbreviate headers, and format Cost as $1.2k. Initial state
  // matches SSR (false / desktop) and re-renders on the client.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const update = () => setNarrow(window.innerWidth < 600)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const range = rangeFromPreset(preset, custom)

  // Generate (or re-use) the mock stats — deterministic per client. Memoized
  // so swapping the conversion-event picker doesn't regenerate.
  const stats = useMemo(() => {
    if (!client) return null
    return generateMockStats({
      clientId: client.id,
      clientName: client.name,
      audiences: avatars.map(a => ({ id: a.id, name: a.name, display_id: a.display_id })),
      offers: offers.map(o => ({ id: o.id, name: o.name, display_id: o.display_id })),
      days: 90,
    })
  }, [client, avatars, offers])

  const totals = useMemo(() => stats ? rollupRange(stats, range) : null, [stats, range])
  const prevTotals = useMemo(() => stats ? rollupRange(stats, previousPeriod(range)) : null, [stats, range])
  // Cascading table-filter option lists.
  const tableCampaigns = useMemo(() => {
    if (!stats) return []
    return stats.campaigns.filter(c => tablePlatform === 'all' || c.platform === tablePlatform)
  }, [stats, tablePlatform])
  const tableAds = useMemo(() => {
    if (!stats) return []
    return stats.ads.filter(a => {
      if (tablePlatform !== 'all' && a.platform !== tablePlatform) return false
      if (tableCampaign !== 'all' && a.campaign_id !== tableCampaign) return false
      return true
    })
  }, [stats, tablePlatform, tableCampaign])

  // Heatmap rows + sort.
  const heatmapRowsRaw = useMemo<HeatmapRow[]>(() => stats ? dailyHeatmap(stats, range, {
    platform: tablePlatform,
    campaignId: tableCampaign,
    adId: tableAd,
  }) : [], [stats, range, tablePlatform, tableCampaign, tableAd])

  const heatmapRows = useMemo(() => {
    const rows = [...heatmapRowsRaw]
    rows.sort((a, b) => {
      if (sortKey === 'date') {
        return sortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
      }
      // costPerConversion can be null on zero-conv days. Sort nulls to the
      // bottom regardless of asc/desc — they're "no data", not extreme values.
      if (sortKey === 'costPerConversion') {
        const av = a.costPerConversion
        const bv = b.costPerConversion
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [heatmapRowsRaw, sortKey, sortDir])

  const heatmapTotals = useMemo(() => heatmapRowsRaw.reduce(
    (acc, r) => ({
      spend:       acc.spend       + r.spend,
      leads:       acc.leads       + r.leads,
      qualified:   acc.qualified   + r.qualified,
      conversions: acc.conversions + r.conversions,
    }),
    { spend: 0, leads: 0, qualified: 0, conversions: 0 },
  ), [heatmapRowsRaw])

  const heatmapExtremes = useMemo(() => {
    const init = {
      spend:             { min: Infinity, max: -Infinity },
      leads:             { min: Infinity, max: -Infinity },
      qualified:         { min: Infinity, max: -Infinity },
      conversions:       { min: Infinity, max: -Infinity },
      costPerConversion: { min: Infinity, max: -Infinity },
    }
    const empty = {
      spend: { min: 0, max: 0 }, leads: { min: 0, max: 0 },
      qualified: { min: 0, max: 0 }, conversions: { min: 0, max: 0 },
      costPerConversion: { min: 0, max: 0 },
    }
    if (heatmapRowsRaw.length === 0) return empty
    for (const r of heatmapRowsRaw) {
      for (const k of ['spend', 'leads', 'qualified', 'conversions'] as const) {
        const v = r[k]
        if (v < init[k].min) init[k].min = v
        if (v > init[k].max) init[k].max = v
      }
      // costPerConversion: ignore null rows when computing extremes so the
      // gradient isn't polluted by zero-conv days.
      if (r.costPerConversion != null) {
        if (r.costPerConversion < init.costPerConversion.min) init.costPerConversion.min = r.costPerConversion
        if (r.costPerConversion > init.costPerConversion.max) init.costPerConversion.max = r.costPerConversion
      }
    }
    // If no row had any conversions, costPerConversion bounds stay at +/-Inf.
    // Reset to 0/0 so the cell formatter doesn't blow up.
    if (init.costPerConversion.min === Infinity) init.costPerConversion = { min: 0, max: 0 }
    return init
  }, [heatmapRowsRaw])

  // Weighted average for the footer: sum-of-cost / sum-of-conversions.
  // Mirrors how Google Ads / Meta report "Cost / Conv." in the totals row.
  const heatmapWeightedCPC = useMemo(() => (
    heatmapTotals.conversions > 0 ? heatmapTotals.spend / heatmapTotals.conversions : null
  ), [heatmapTotals])

  // ── Top Performing Ad Copy aggregations ────────────────────────────
  const adRowsAll = useMemo<AdPerformanceRow[]>(
    () => stats ? adsPerformance(stats, range, { platform: topPlatform, adType: topAdType }) : [],
    [stats, range, topPlatform, topAdType],
  )

  const top5Ads = useMemo(() => {
    const rows = [...adRowsAll]
    if (topSort === 'cpql') {
      // Lower CPQL is better. Ads with no Qualified Leads (null CPQL) and zero
      // spend sink to the bottom.
      rows.sort((a, b) => {
        const an = a.costPerQualified
        const bn = b.costPerQualified
        if (an == null && bn == null) return b.spend - a.spend
        if (an == null) return 1
        if (bn == null) return -1
        return an - bn
      })
    } else if (topSort === 'conversions') {
      rows.sort((a, b) => b.conversions - a.conversions)
    } else {
      rows.sort((a, b) => {
        const an = a.costPerConversion
        const bn = b.costPerConversion
        if (an == null && bn == null) return b.spend - a.spend
        if (an == null) return 1
        if (bn == null) return -1
        return an - bn
      })
    }
    return rows.slice(0, 5)
  }, [adRowsAll, topSort])

  const componentRollups = useMemo(
    () => stats ? rollupByComponent(stats, range, { platform: topPlatform, adType: topAdType }) : null,
    [stats, range, topPlatform, topAdType],
  )

  // Pick top-3 by ascending CPQL within each rollup. Components with no
  // Qualified Leads (null CPQL) drop out of the top list.
  function pickTop3(rows: ComponentRollupRow[]): ComponentRollupRow[] {
    return rows
      .filter(r => r.costPerQualified != null)
      .sort((a, b) => (a.costPerQualified! - b.costPerQualified!))
      .slice(0, 3)
  }
  const topBh   = useMemo(() => componentRollups ? pickTop3(componentRollups.bh)   : [], [componentRollups])
  const topBody = useMemo(() => componentRollups ? pickTop3(componentRollups.body) : [], [componentRollups])
  const topCta  = useMemo(() => componentRollups ? pickTop3(componentRollups.cta)  : [], [componentRollups])

  function pickPlatform(p: 'all' | AdPlatform) {
    setTablePlatform(p)
    setTableCampaign('all')
    setTableAd('all')
  }
  function pickCampaign(id: string) {
    setTableCampaign(id)
    setTableAd('all')
  }
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'desc')
    }
  }

  if (!client) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Stats</h1>
            <p className="page-subtitle">Ad performance across Google Ads + Meta</p>
          </div>
        </div>
        <div className="empty-state">Select a client to see stats.</div>
      </div>
    )
  }

  // Top-line numbers — selected event is the lever for cost-per-conversion.
  const totalSpend = totals?.spend ?? 0
  const eventConversions = totals?.conversionsByEvent[event] ?? 0
  const costPerEvent = eventConversions > 0 ? totalSpend / eventConversions : null

  const prevSpend = prevTotals?.spend ?? 0
  const prevEventConv = prevTotals?.conversionsByEvent[event] ?? 0
  const prevCostPerEvent = prevEventConv > 0 ? prevSpend / prevEventConv : null

  const spendDelta = fmtPercentDelta(totalSpend, prevSpend)
  const cplDelta = costPerEvent != null && prevCostPerEvent != null ? fmtPercentDelta(costPerEvent, prevCostPerEvent) : null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">
            Ad performance across Google Ads + Meta for {client.name}{' '}
            <span style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 4, verticalAlign: 'middle' }}>
              MOCK DATA
            </span>
          </p>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['7', '30', '90'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`btn btn-sm ${preset === p ? 'btn-primary' : 'btn-secondary'}`}
            >
              Last {p} days
            </button>
          ))}
          <button
            onClick={() => setPreset('custom')}
            className={`btn btn-sm ${preset === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Custom
          </button>
        </div>

        {preset === 'custom' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 150, padding: '4px 8px' }}
              value={custom.from}
              max={custom.to}
              onChange={e => setCustom({ ...custom, from: e.target.value })}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 150, padding: '4px 8px' }}
              value={custom.to}
              min={custom.from}
              max={today}
              onChange={e => setCustom({ ...custom, to: e.target.value })}
            />
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cost-per-conversion event:</label>
          <select
            className="form-input"
            value={event}
            onChange={e => setEvent(e.target.value as ConversionEvent)}
            style={{ padding: '6px 10px' }}
          >
            {CONVERSION_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Spend</div>
          <div className="stat-value">{fmtMoney(totalSpend)}</div>
          {spendDelta && (
            <div className="stat-change" style={{ color: spendDelta.positive ? 'var(--warning, #f59e0b)' : 'var(--success, #34d399)' }}>
              {spendDelta.text} vs previous period
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-label">Cost per {event}</div>
          <div className="stat-value">{costPerEvent != null ? fmtMoney(costPerEvent) : '—'}</div>
          <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
            {fmtNum(eventConversions)} {event}{eventConversions === 1 ? '' : 's'} this period
            {cplDelta && (
              <span style={{ marginLeft: 6, color: cplDelta.positive ? 'var(--warning, #f59e0b)' : 'var(--success, #34d399)' }}>
                · {cplDelta.text} vs prev
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Daily heatmap table ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 0 }}>Daily breakdown</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Filters scope this table only — cards and charts above stay on the date range + selected event.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            <label style={{ color: 'var(--text-muted)' }}>Platform:</label>
            <select
              className="form-input"
              value={tablePlatform}
              onChange={e => pickPlatform(e.target.value as 'all' | AdPlatform)}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <option value="all">All</option>
              <option value="google">{PLATFORM_LABEL.google}</option>
              <option value="meta">{PLATFORM_LABEL.meta}</option>
            </select>

            <label style={{ color: 'var(--text-muted)' }}>Campaign:</label>
            <select
              className="form-input"
              value={tableCampaign}
              onChange={e => pickCampaign(e.target.value)}
              style={{ padding: '4px 10px', fontSize: 12, maxWidth: 260 }}
            >
              <option value="all">All</option>
              {tableCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label style={{ color: 'var(--text-muted)' }}>Ad:</label>
            <select
              className="form-input"
              value={tableAd}
              onChange={e => setTableAd(e.target.value)}
              style={{ padding: '4px 10px', fontSize: 12, maxWidth: 220 }}
            >
              <option value="all">All</option>
              {tableAds.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: narrow ? 12 : 13,
            minWidth: narrow ? 0 : 640,
          }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #333)' }}>
                <SortableTh label="Date"                                       keyName="date"              sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left"  narrow={narrow} />
                <SortableTh label="Cost"                                       keyName="spend"             sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" narrow={narrow} />
                <SortableTh label="Leads"                                      keyName="leads"             sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" narrow={narrow} />
                <SortableTh label={narrow ? 'Qualified' : 'Qualified Leads'}   keyName="qualified"         sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" narrow={narrow} />
                <SortableTh label={narrow ? 'Conv.' : 'Conversions'}           keyName="conversions"       sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" narrow={narrow} />
                <SortableTh label={narrow ? '$/Conv' : 'Cost / Conv'}          keyName="costPerConversion" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" narrow={narrow} />
              </tr>
            </thead>
            <tbody>
              {heatmapRows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, color: 'var(--text-muted)' }}>No data for this filter combination.</td></tr>
              )}
              {heatmapRows.map(r => (
                <tr key={r.date} style={{ borderBottom: '1px solid var(--border, #2a2a2a)' }}>
                  <td style={{ padding: narrow ? '6px 6px' : '8px 10px', fontSize: narrow ? 11 : 12, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtShortDate(r.date)}</td>
                  <Cell value={r.spend}       min={heatmapExtremes.spend.min}       max={heatmapExtremes.spend.max}       hue={HEATMAP_HUE.cost}              format={(n) => fmtCostCompact(n, narrow)} narrow={narrow} />
                  <Cell value={r.leads}       min={heatmapExtremes.leads.min}       max={heatmapExtremes.leads.max}       hue={HEATMAP_HUE.leads}             format={fmtNum} narrow={narrow} />
                  <Cell value={r.qualified}   min={heatmapExtremes.qualified.min}   max={heatmapExtremes.qualified.max}   hue={HEATMAP_HUE.qualified}         format={fmtNum} narrow={narrow} />
                  <Cell value={r.conversions} min={heatmapExtremes.conversions.min} max={heatmapExtremes.conversions.max} hue={HEATMAP_HUE.conversions}       format={fmtNum} narrow={narrow} />
                  <CostPerConvCell value={r.costPerConversion} min={heatmapExtremes.costPerConversion.min} max={heatmapExtremes.costPerConversion.max} narrow={narrow} />
                </tr>
              ))}
            </tbody>
            {heatmapRows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border, #333)', background: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: narrow ? '6px 6px' : '8px 10px', fontWeight: 600 }}>Totals{narrow ? '' : ` · ${heatmapRowsRaw.length} day${heatmapRowsRaw.length === 1 ? '' : 's'}`}</td>
                  <td style={{ padding: narrow ? '6px 6px' : '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtCostCompact(heatmapTotals.spend, narrow)}</td>
                  <td style={{ padding: narrow ? '6px 6px' : '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(heatmapTotals.leads)}</td>
                  <td style={{ padding: narrow ? '6px 6px' : '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(heatmapTotals.qualified)}</td>
                  <td style={{ padding: narrow ? '6px 6px' : '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(heatmapTotals.conversions)}</td>
                  <td style={{ padding: narrow ? '6px 6px' : '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} title="Weighted average: total cost ÷ total conversions">
                    {heatmapWeightedCPC != null ? fmtCostCompact(heatmapWeightedCPC, narrow) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Top Performing Ad Copy ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 0 }}>Top Performing Ad Copy</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Component rollups parse the ad name (AU#_OF#_BH#-{`{body}`}#-CTA#) to find which hooks, bodies, and CTAs perform best across ads. Filters scope this section only.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            <label style={{ color: 'var(--text-muted)' }}>Platform:</label>
            <select
              className="form-input"
              value={topPlatform}
              onChange={e => setTopPlatform(e.target.value as 'all' | AdPlatform)}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <option value="all">All</option>
              <option value="google">{PLATFORM_LABEL.google}</option>
              <option value="meta">{PLATFORM_LABEL.meta}</option>
            </select>

            <label style={{ color: 'var(--text-muted)' }}>Ad type:</label>
            <select
              className="form-input"
              value={topAdType}
              onChange={e => setTopAdType(e.target.value as 'all' | AdType)}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <option value="all">All</option>
              <option value="video">Video</option>
              <option value="static">Static</option>
              <option value="text">Text</option>
            </select>

            <label style={{ color: 'var(--text-muted)' }}>Sort by:</label>
            <select
              className="form-input"
              value={topSort}
              onChange={e => setTopSort(e.target.value as 'cpql' | 'conversions' | 'cpc')}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <option value="cpql">Cost per Qualified Lead (asc)</option>
              <option value="conversions">Conversions (desc)</option>
              <option value="cpc">Cost per Conversion (asc)</option>
            </select>
          </div>
        </div>

        {/* Top 5 ads list */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Top 5 ads</div>
          {top5Ads.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No ads match the current filters.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {top5Ads.map((row, i) => (
                <div key={row.ad.id} style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 16, textAlign: 'right' }}>#{i + 1}</div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>{row.ad.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11, flexWrap: 'wrap' }}>
                      <Badge label={PLATFORM_LABEL[row.ad.platform]} tone={row.ad.platform === 'google' ? 'blue' : 'pink'} />
                      <Badge label={row.ad.ad_type} tone="muted" />
                      {row.parsed == null && <Badge label="non-standard name" tone="warn" />}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Spend</span> {fmtMoney(row.spend)}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>QL</span> {fmtNum(row.qualified)} <span style={{ color: 'var(--text-muted)' }}>· CPQL</span> {row.costPerQualified != null ? fmtMoney(row.costPerQualified) : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Three component cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 16 }}>
          <ComponentCard title="Best Hook (BH)" rows={topBh} />
          <ComponentCard title="Best Body (SH/T/PC)" rows={topBody} />
          <ComponentCard title="Best CTA" rows={topCta} />
        </div>
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
        Mock data only. Wire up real Google Ads + Meta integrations to replace.
      </div>
    </div>
  )
}

// ─── Small UI helpers ──────────────────────────────────────────────────

// Heatmap palette — single hue per column. Picked so each column reads as a
// visually distinct band and the dark-cell text stays legible.
//   Cost              amber-500 (#f59e0b)  — money out
//   Leads             cyan-500  (#06b6d4)  — top of funnel
//   Qualified         emerald-400 (#34d399) — middle of funnel
//   Conversions       violet-500 (#a855f7)  — outcomes
//   Cost / Conv       rose-500  (#f43f5e)  — distinct from amber but in the
//                                            same "warm = costs" family,
//                                            since both are "more is worse"
const HEATMAP_HUE = {
  cost:              '#f59e0b',
  leads:             '#06b6d4',
  qualified:         '#34d399',
  conversions:       '#a855f7',
  costPerConversion: '#f43f5e',
} as const

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function cellBackground(value: number, min: number, max: number, hex: string): string {
  if (max <= 0 || max === min) return 'transparent'
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  // Floor at 0.04 so even the smallest non-zero cell carries a tint; ceil at
  // 0.55 so dark cells never wash out white text on the dark theme.
  const alpha = value === 0 ? 0 : 0.04 + t * 0.55
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function Cell({
  value, min, max, hue, format, narrow,
}: {
  value: number
  min: number
  max: number
  hue: string
  format: (n: number) => string
  narrow?: boolean
}) {
  return (
    <td style={{
      padding: narrow ? '6px 6px' : '8px 10px',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      background: cellBackground(value, min, max, hue),
      color: value === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
    }}>
      {format(value)}
    </td>
  )
}

// Cost-per-conversion cell handles the null case (zero-conversion days)
// with a muted "—" instead of $Inf or $0 — those would mislead either way.
function CostPerConvCell({
  value, min, max, narrow,
}: {
  value: number | null
  min: number
  max: number
  narrow?: boolean
}) {
  if (value == null) {
    return (
      <td style={{
        padding: narrow ? '6px 6px' : '8px 10px',
        textAlign: 'right',
        color: 'var(--text-muted)',
      }}>
        —
      </td>
    )
  }
  return (
    <td style={{
      padding: narrow ? '6px 6px' : '8px 10px',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      background: cellBackground(value, min, max, HEATMAP_HUE.costPerConversion),
      color: 'var(--text-primary)',
    }}>
      {fmtCostCompact(value, !!narrow)}
    </td>
  )
}

// "2026-04-15" -> "Apr 15". Year is implicit from the date-range filter.
function fmtShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  return `${month} ${day}`
}

// Compact cost format on narrow viewports: $1,234 -> $1.2k. Desktop keeps
// the precise dollar figure via fmtMoney.
function fmtCostCompact(n: number, narrow: boolean): string {
  if (!narrow) return fmtMoney(n)
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 10_000) return '$' + (n / 1000).toFixed(0) + 'k'
  if (Math.abs(n) >= 1_000)  return '$' + (n / 1000).toFixed(1) + 'k'
  return '$' + n.toFixed(0)
}

type SortableKey = 'date' | 'spend' | 'leads' | 'qualified' | 'conversions' | 'costPerConversion'

function SortableTh({
  label, keyName, sortKey, sortDir, onClick, align, narrow,
}: {
  label: string
  keyName: SortableKey
  sortKey: SortableKey
  sortDir: 'asc' | 'desc'
  onClick: (k: SortableKey) => void
  align: 'left' | 'right'
  narrow?: boolean
}) {
  const isActive = sortKey === keyName
  const arrow = isActive ? (sortDir === 'asc' ? '▲' : '▼') : ''
  return (
    <th
      onClick={() => onClick(keyName)}
      style={{
        padding: narrow ? '6px 6px' : '8px 10px',
        textAlign: align,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 600 : 500,
        fontSize: narrow ? 11 : 13,
      }}
      title={`Sort by ${label}`}
    >
      {label}
      {arrow && <span style={{ marginLeft: 6, fontSize: 10 }}>{arrow}</span>}
    </th>
  )
}


// ─── Badge for the top-5 ads list ──────────────────────────────────────
function Badge({ label, tone }: { label: string; tone: 'blue' | 'pink' | 'muted' | 'warn' }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    blue:  { bg: 'rgba(66,133,244,0.15)',  fg: '#4285F4' },
    pink:  { bg: 'rgba(228,64,95,0.15)',   fg: '#E4405F' },
    muted: { bg: 'rgba(115,115,115,0.18)', fg: 'var(--text-muted)' },
    warn:  { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b' },
  }
  const p = palette[tone]
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: 999,
      background: p.bg,
      color: p.fg,
      fontSize: 11,
      fontWeight: 600,
      textTransform: tone === 'muted' || tone === 'warn' ? 'uppercase' : undefined,
      letterSpacing: 0.3,
    }}>
      {label}
    </span>
  )
}

// ─── Component rollup card (BH / Body / CTA) ───────────────────────────
function ComponentCard({ title, rows }: { title: string; rows: ComponentRollupRow[] }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border, #333)',
      borderRadius: 6,
      padding: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No qualified-lead activity yet for this filter.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 14, textAlign: 'right' }}>#{i + 1}</span>
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--accent)', marginRight: 6 }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{r.text || <span style={{ color: 'var(--text-muted)' }}>(no excerpt available)</span>}</span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.adCount} ad{r.adCount === 1 ? '' : 's'} · {fmtMoney(r.spend)} spend · {fmtNum(r.qualified)} QL
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>CPQL</div>
                <div>{r.costPerQualified != null ? fmtMoney(r.costPerQualified) : '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
