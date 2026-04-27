'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  generateMockStats,
  rollupRange,
  dailyByPlatform,
  dailyFunnel,
  dailyHeatmap,
  previousPeriod,
  fmtMoney,
  fmtNum,
  fmtPercentDelta,
  CONVERSION_EVENTS,
  PLATFORM_LABEL,
  PLATFORM_COLOR,
} from '@/lib/mockStats'
import type { ConversionEvent, AdPlatform, HeatmapRow } from '@/lib/mockStats'

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
  type SortKey = 'date' | 'spend' | 'leads' | 'qualified' | 'purchases'
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const range = rangeFromPreset(preset, custom)

  // Generate (or re-use) the mock stats — deterministic per client. Memoized
  // so swapping the conversion-event picker doesn't regenerate.
  const stats = useMemo(() => {
    if (!client) return null
    return generateMockStats({
      clientId: client.id,
      clientName: client.name,
      audiences: avatars.map(a => ({ id: a.id, name: a.name })),
      offers: offers.map(o => ({ id: o.id, name: o.name })),
      days: 90,
    })
  }, [client, avatars, offers])

  const totals = useMemo(() => stats ? rollupRange(stats, range) : null, [stats, range])
  const prevTotals = useMemo(() => stats ? rollupRange(stats, previousPeriod(range)) : null, [stats, range])
  const dailySpend = useMemo(() => stats ? dailyByPlatform(stats, range) : [], [stats, range])
  const funnelDaily = useMemo(() => stats ? dailyFunnel(stats, range) : [], [stats, range])

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
      const av = a[sortKey], bv = b[sortKey]
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [heatmapRowsRaw, sortKey, sortDir])

  const heatmapTotals = useMemo(() => heatmapRowsRaw.reduce(
    (acc, r) => ({
      spend:     acc.spend + r.spend,
      leads:     acc.leads + r.leads,
      qualified: acc.qualified + r.qualified,
      purchases: acc.purchases + r.purchases,
    }),
    { spend: 0, leads: 0, qualified: 0, purchases: 0 },
  ), [heatmapRowsRaw])

  const heatmapExtremes = useMemo(() => {
    const init = {
      spend:     { min: Infinity, max: -Infinity },
      leads:     { min: Infinity, max: -Infinity },
      qualified: { min: Infinity, max: -Infinity },
      purchases: { min: Infinity, max: -Infinity },
    }
    if (heatmapRowsRaw.length === 0) {
      return { spend: { min: 0, max: 0 }, leads: { min: 0, max: 0 }, qualified: { min: 0, max: 0 }, purchases: { min: 0, max: 0 } }
    }
    for (const r of heatmapRowsRaw) {
      for (const k of ['spend', 'leads', 'qualified', 'purchases'] as const) {
        const v = r[k]
        if (v < init[k].min) init[k].min = v
        if (v > init[k].max) init[k].max = v
      }
    }
    return init
  }, [heatmapRowsRaw])

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
  const totalConversions = totals?.totalConversions ?? 0
  const eventConversions = totals?.conversionsByEvent[event] ?? 0
  const costPerEvent = eventConversions > 0 ? totalSpend / eventConversions : null

  const prevSpend = prevTotals?.spend ?? 0
  const prevTotalConv = prevTotals?.totalConversions ?? 0
  const prevEventConv = prevTotals?.conversionsByEvent[event] ?? 0
  const prevCostPerEvent = prevEventConv > 0 ? prevSpend / prevEventConv : null

  const spendDelta = fmtPercentDelta(totalSpend, prevSpend)
  const convDelta = fmtPercentDelta(totalConversions, prevTotalConv)
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
          <div className="stat-label">Total Conversions <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(all events)</span></div>
          <div className="stat-value">{fmtNum(totalConversions)}</div>
          {convDelta && (
            <div className="stat-change" style={{ color: convDelta.positive ? 'var(--success, #34d399)' : 'var(--warning, #f59e0b)' }}>
              {convDelta.text} vs previous period
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

        <div className="stat-card">
          <div className="stat-label">Active Campaigns</div>
          <div className="stat-value">
            {stats?.campaigns.filter(c => c.status === 'active').length ?? 0}
            <span style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 6 }}>/ {stats?.campaigns.length ?? 0}</span>
          </div>
          <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
            {stats?.ads.length ?? 0} total ads
          </div>
        </div>
      </div>

      {/* ── Spend over time chart ───────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Spend over time</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <PlatformDot platform="google" /> {PLATFORM_LABEL.google}
            <PlatformDot platform="meta"   /> {PLATFORM_LABEL.meta}
          </div>
        </div>
        <SpendChart data={dailySpend} />
      </div>

      {/* ── Conversions by day chart (funnel) ───────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 0 }}>Conversions by day</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Funnel: every Qualified Lead is also a Lead, every Purchase is also a Qualified Lead.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            <SeriesDot color={FUNNEL_COLORS.lead} />      Lead
            <SeriesDot color={FUNNEL_COLORS.qualified} /> Qualified Lead
            <SeriesDot color={FUNNEL_COLORS.purchase} />  Purchase
          </div>
        </div>
        <ConversionsChart data={funnelDaily} />
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #333)' }}>
                <SortableTh label="Date"            keyName="date"      sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left" />
                <SortableTh label="Cost"            keyName="spend"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Leads"           keyName="leads"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Qualified Leads" keyName="qualified" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Conversions"     keyName="purchases" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" subLabel="(Purchases)" />
              </tr>
            </thead>
            <tbody>
              {heatmapRows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, color: 'var(--text-muted)' }}>No data for this filter combination.</td></tr>
              )}
              {heatmapRows.map(r => (
                <tr key={r.date} style={{ borderBottom: '1px solid var(--border, #2a2a2a)' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, whiteSpace: 'nowrap' }}>{r.date}</td>
                  <Cell value={r.spend}     min={heatmapExtremes.spend.min}     max={heatmapExtremes.spend.max}     hue={HEATMAP_HUE.cost}      format={fmtMoney} />
                  <Cell value={r.leads}     min={heatmapExtremes.leads.min}     max={heatmapExtremes.leads.max}     hue={HEATMAP_HUE.leads}     format={fmtNum} />
                  <Cell value={r.qualified} min={heatmapExtremes.qualified.min} max={heatmapExtremes.qualified.max} hue={HEATMAP_HUE.qualified} format={fmtNum} />
                  <Cell value={r.purchases} min={heatmapExtremes.purchases.min} max={heatmapExtremes.purchases.max} hue={HEATMAP_HUE.purchases} format={fmtNum} />
                </tr>
              ))}
            </tbody>
            {heatmapRows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border, #333)', background: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>Totals · {heatmapRowsRaw.length} day{heatmapRowsRaw.length === 1 ? '' : 's'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(heatmapTotals.spend)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(heatmapTotals.leads)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(heatmapTotals.qualified)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(heatmapTotals.purchases)}</td>
                </tr>
              </tfoot>
            )}
          </table>
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

// Funnel chart palette: cool → warm progression matches the funnel narrative
// (top-of-funnel cyan, qualified emerald, purchase amber/gold = the "win").
const FUNNEL_COLORS = {
  lead:      '#06b6d4',  // cyan-500
  qualified: '#34d399',  // emerald-400
  purchase:  '#fbbf24',  // amber-400
} as const

function SeriesDot({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color }} />
    </span>
  )
}

function PlatformDot({ platform }: { platform: AdPlatform }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PLATFORM_COLOR[platform] }} />
    </span>
  )
}

// Heatmap palette — single hue per column. Picked so each column reads as a
// visually distinct band and the dark-cell text stays legible.
//   Cost            amber-500 (#f59e0b)  — money
//   Leads           cyan-500  (#06b6d4)  — top of funnel (matches chart)
//   Qualified Leads emerald-400 (#34d399) — middle (matches chart)
//   Conversions     violet-500 (#a855f7) — distinct from amber/Cost
const HEATMAP_HUE = {
  cost:      '#f59e0b',
  leads:     '#06b6d4',
  qualified: '#34d399',
  purchases: '#a855f7',
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
  value, min, max, hue, format,
}: {
  value: number
  min: number
  max: number
  hue: string
  format: (n: number) => string
}) {
  return (
    <td style={{
      padding: '8px 10px',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      background: cellBackground(value, min, max, hue),
      color: value === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
    }}>
      {format(value)}
    </td>
  )
}

type SortableKey = 'date' | 'spend' | 'leads' | 'qualified' | 'purchases'

function SortableTh({
  label, keyName, sortKey, sortDir, onClick, align, subLabel,
}: {
  label: string
  keyName: SortableKey
  sortKey: SortableKey
  sortDir: 'asc' | 'desc'
  onClick: (k: SortableKey) => void
  align: 'left' | 'right'
  subLabel?: string
}) {
  const isActive = sortKey === keyName
  const arrow = isActive ? (sortDir === 'asc' ? '▲' : '▼') : ''
  return (
    <th
      onClick={() => onClick(keyName)}
      style={{
        padding: '8px 10px',
        textAlign: align,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 600 : 500,
      }}
      title={`Sort by ${label}`}
    >
      {label}
      {subLabel && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 4 }}>{subLabel}</span>}
      {arrow && <span style={{ marginLeft: 6, fontSize: 10 }}>{arrow}</span>}
    </th>
  )
}

// ─── SVG stacked-bar chart ─────────────────────────────────────────────
// Each day = one bar; google stacks under meta. ViewBox-scaled so it
// responds to container width without a chart library.

function SpendChart({ data }: { data: { date: string; google: number; meta: number }[] }) {
  const W = 1000
  const H = 220
  const PAD_LEFT = 56
  const PAD_RIGHT = 12
  const PAD_TOP = 12
  const PAD_BOTTOM = 32
  const innerW = W - PAD_LEFT - PAD_RIGHT
  const innerH = H - PAD_TOP - PAD_BOTTOM

  const max = Math.max(1, ...data.map(d => d.google + d.meta))
  // Round max up to a nice tick
  const niceMax = niceCeil(max)
  const barW = innerW / Math.max(data.length, 1)

  // Y-axis ticks: 4 evenly-spaced values incl. 0.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(niceMax * t))

  // X-axis labels: show ~6 evenly-spaced dates.
  const labelEvery = Math.max(1, Math.floor(data.length / 6))

  function y(value: number) {
    return PAD_TOP + innerH - (value / niceMax) * innerH
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 240, display: 'block' }} preserveAspectRatio="none">
      {/* Gridlines + Y-axis labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_LEFT} x2={W - PAD_RIGHT}
            y1={y(t)} y2={y(t)}
            stroke="var(--border, #2a2a2a)"
            strokeDasharray={i === 0 ? '' : '2 3'}
          />
          <text
            x={PAD_LEFT - 6} y={y(t) + 3}
            textAnchor="end" fontSize="10" fill="var(--text-muted)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            ${t.toLocaleString()}
          </text>
        </g>
      ))}

      {/* Bars (google bottom, meta on top) */}
      {data.map((d, i) => {
        const x = PAD_LEFT + i * barW
        const gH = (d.google / niceMax) * innerH
        const mH = (d.meta   / niceMax) * innerH
        const gY = PAD_TOP + innerH - gH
        const mY = gY - mH
        const gap = barW > 6 ? 1 : 0
        const w = Math.max(1, barW - gap)
        return (
          <g key={d.date}>
            {gH > 0 && (
              <rect
                x={x} y={gY} width={w} height={gH}
                fill={PLATFORM_COLOR.google}
              >
                <title>{`${d.date} · Google: $${d.google.toFixed(0)} · Meta: $${d.meta.toFixed(0)}`}</title>
              </rect>
            )}
            {mH > 0 && (
              <rect
                x={x} y={mY} width={w} height={mH}
                fill={PLATFORM_COLOR.meta}
              >
                <title>{`${d.date} · Google: $${d.google.toFixed(0)} · Meta: $${d.meta.toFixed(0)}`}</title>
              </rect>
            )}
          </g>
        )
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % labelEvery !== 0 && i !== data.length - 1) return null
        const x = PAD_LEFT + i * barW + barW / 2
        const label = d.date.slice(5)  // MM-DD
        return (
          <text
            key={`x-${i}`} x={x} y={H - 12}
            textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// ─── SVG grouped-bar chart for the conversion funnel ───────────────────
// Three series side-by-side per day. NOT stacked because Lead, Qualified
// Lead, and Purchase nest — stacking would visually double-count.

function ConversionsChart({ data }: { data: { date: string; lead: number; qualified: number; purchase: number }[] }) {
  const W = 1000
  const H = 220
  const PAD_LEFT = 56
  const PAD_RIGHT = 12
  const PAD_TOP = 12
  const PAD_BOTTOM = 32
  const innerW = W - PAD_LEFT - PAD_RIGHT
  const innerH = H - PAD_TOP - PAD_BOTTOM

  // Lead is always the largest of the three (it's the parent in the funnel),
  // so axis scaling off lead is enough.
  const max = Math.max(1, ...data.map(d => Math.max(d.lead, d.qualified, d.purchase)))
  const niceMax = niceCeil(max)

  const dayWidth = innerW / Math.max(data.length, 1)
  // Three series. Tiny gap between bars within a day, larger gap between days.
  const innerGap = dayWidth > 12 ? 1 : 0
  const seriesW = Math.max(1, (dayWidth - innerGap * 2 - 2) / 3)

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(niceMax * t))
  const labelEvery = Math.max(1, Math.floor(data.length / 6))

  function y(value: number) {
    return PAD_TOP + innerH - (value / niceMax) * innerH
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 240, display: 'block' }} preserveAspectRatio="none">
      {/* Gridlines + Y-axis labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_LEFT} x2={W - PAD_RIGHT}
            y1={y(t)} y2={y(t)}
            stroke="var(--border, #2a2a2a)"
            strokeDasharray={i === 0 ? '' : '2 3'}
          />
          <text
            x={PAD_LEFT - 6} y={y(t) + 3}
            textAnchor="end" fontSize="10" fill="var(--text-muted)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {t.toLocaleString()}
          </text>
        </g>
      ))}

      {/* Grouped bars */}
      {data.map((d, i) => {
        const dayX = PAD_LEFT + i * dayWidth + 1  // 1px left margin within slot
        const tip = `${d.date} · Leads: ${d.lead} · Qualified: ${d.qualified} · Purchases: ${d.purchase}`
        return (
          <g key={d.date}>
            {/* Lead */}
            {d.lead > 0 && (() => {
              const barH = (d.lead / niceMax) * innerH
              return (
                <rect
                  x={dayX} y={PAD_TOP + innerH - barH}
                  width={seriesW} height={barH}
                  fill={FUNNEL_COLORS.lead}
                ><title>{tip}</title></rect>
              )
            })()}
            {/* Qualified */}
            {d.qualified > 0 && (() => {
              const barH = (d.qualified / niceMax) * innerH
              return (
                <rect
                  x={dayX + seriesW + innerGap} y={PAD_TOP + innerH - barH}
                  width={seriesW} height={barH}
                  fill={FUNNEL_COLORS.qualified}
                ><title>{tip}</title></rect>
              )
            })()}
            {/* Purchase */}
            {d.purchase > 0 && (() => {
              const barH = (d.purchase / niceMax) * innerH
              return (
                <rect
                  x={dayX + (seriesW + innerGap) * 2} y={PAD_TOP + innerH - barH}
                  width={seriesW} height={barH}
                  fill={FUNNEL_COLORS.purchase}
                ><title>{tip}</title></rect>
              )
            })()}
          </g>
        )
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % labelEvery !== 0 && i !== data.length - 1) return null
        const x = PAD_LEFT + i * dayWidth + dayWidth / 2
        const label = d.date.slice(5)  // MM-DD
        return (
          <text
            key={`x-${i}`} x={x} y={H - 12}
            textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

function niceCeil(n: number): number {
  if (n <= 0) return 1
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * base >= n) return m * base
  }
  return Math.ceil(n / base) * base
}
