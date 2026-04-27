'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  generateMockStats,
  rollupRange,
  rollupByCampaign,
  rollupByAd,
  dailyByPlatform,
  previousPeriod,
  fmtMoney,
  fmtNum,
  fmtPercentDelta,
  CONVERSION_EVENTS,
  PLATFORM_LABEL,
  PLATFORM_COLOR,
} from '@/lib/mockStats'
import type { ConversionEvent, AdPlatform } from '@/lib/mockStats'

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
  const [campaignFilter, setCampaignFilter] = useState<string>('')  // for ad table

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
  const campaignRows = useMemo(() => stats ? rollupByCampaign(stats, range, event) : [], [stats, range, event])
  const adRows = useMemo(() => stats ? rollupByAd(stats, range, event, campaignFilter || undefined) : [], [stats, range, event, campaignFilter])

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

      {/* ── Cost by campaign ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Cost by campaign</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #333)' }}>
                <th style={{ padding: '8px 6px', minWidth: 80 }}>Platform</th>
                <th style={{ padding: '8px 6px', minWidth: 280 }}>Campaign</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Spend</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>{event}s</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Cost / {event}</th>
                <th style={{ padding: '8px 6px' }}>Optimized for</th>
                <th style={{ padding: '8px 6px' }}>Status</th>
                <th style={{ padding: '8px 6px', width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 20, color: 'var(--text-muted)' }}>No campaigns in this date range.</td></tr>
              )}
              {[...campaignRows].sort((a, b) => b.spend - a.spend).map(r => (
                <tr key={r.campaign.id} style={{ borderBottom: '1px solid var(--border, #2a2a2a)' }}>
                  <td style={{ padding: '8px 6px' }}><PlatformBadge platform={r.campaign.platform} /></td>
                  <td style={{ padding: '8px 6px' }}>{r.campaign.name}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.spend)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.conversionsForEvent)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.costPerConversion != null ? fmtMoney(r.costPerConversion) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 6px', fontSize: 12, color: 'var(--text-muted)' }}>{r.campaign.primary_event}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: r.campaign.status === 'active' ? 'rgba(52,211,153,0.15)' : 'rgba(115,115,115,0.2)',
                      color: r.campaign.status === 'active' ? '#34d399' : 'var(--text-muted)',
                    }}>
                      {r.campaign.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setCampaignFilter(c => c === r.campaign.id ? '' : r.campaign.id)}
                      title="Filter ads to this campaign"
                    >
                      {campaignFilter === r.campaign.id ? '× clear' : 'View ads'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cost by ad ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Cost by ad</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <label style={{ color: 'var(--text-muted)' }}>Campaign:</label>
            <select
              className="form-input"
              value={campaignFilter}
              onChange={e => setCampaignFilter(e.target.value)}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <option value="">All campaigns</option>
              {stats?.campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #333)' }}>
                <th style={{ padding: '8px 6px', minWidth: 80 }}>Platform</th>
                <th style={{ padding: '8px 6px', minWidth: 240 }}>Ad</th>
                <th style={{ padding: '8px 6px', minWidth: 200 }}>Campaign</th>
                <th style={{ padding: '8px 6px' }}>Format</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Spend</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>{event}s</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Cost / {event}</th>
              </tr>
            </thead>
            <tbody>
              {adRows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, color: 'var(--text-muted)' }}>No ads in this date range.</td></tr>
              )}
              {[...adRows].sort((a, b) => b.spend - a.spend).slice(0, 50).map(r => (
                <tr key={r.ad.id} style={{ borderBottom: '1px solid var(--border, #2a2a2a)' }}>
                  <td style={{ padding: '8px 6px' }}><PlatformBadge platform={r.ad.platform} /></td>
                  <td style={{ padding: '8px 6px' }}>{r.ad.name}</td>
                  <td style={{ padding: '8px 6px', color: 'var(--text-muted)', fontSize: 12 }}>{r.campaignName}</td>
                  <td style={{ padding: '8px 6px', fontSize: 12 }}>{r.ad.format}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.spend)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.conversionsForEvent)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.costPerConversion != null ? fmtMoney(r.costPerConversion) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {adRows.length > 50 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
            Showing top 50 of {adRows.length} ads (by spend).
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
        Mock data only. Wire up real Google Ads + Meta integrations to replace.
      </div>
    </div>
  )
}

// ─── Small UI helpers ──────────────────────────────────────────────────

function PlatformDot({ platform }: { platform: AdPlatform }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PLATFORM_COLOR[platform] }} />
    </span>
  )
}

function PlatformBadge({ platform }: { platform: AdPlatform }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: `${PLATFORM_COLOR[platform]}22`, color: PLATFORM_COLOR[platform],
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: PLATFORM_COLOR[platform] }} />
      {PLATFORM_LABEL[platform]}
    </span>
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

function niceCeil(n: number): number {
  if (n <= 0) return 1
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * base >= n) return m * base
  }
  return Math.ceil(n / base) * base
}
