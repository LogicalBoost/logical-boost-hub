'use client'

import { useState } from 'react'

const mockClient = {
  name: 'RoofCo Exteriors',
  website: 'https://roofcoexteriors.com',
  business_summary: 'RoofCo Exteriors is a full-service residential and commercial roofing company serving the greater Dallas-Fort Worth area. Founded in 2015, they specialize in storm damage repair, full roof replacements, and preventive maintenance. Their team of 45+ certified professionals has completed over 2,300 projects with a 4.9-star rating across 500+ Google reviews.',
  services: 'Residential roof replacement, storm damage repair, roof inspections, gutter installation, commercial roofing, emergency tarping, insurance claim assistance',
  differentiators: 'GAF Master Elite certified (top 3% of contractors nationwide), 24/7 emergency response team, full insurance claim management, lifetime workmanship warranty, drone-assisted inspections',
  trust_signals: 'GAF Master Elite Certified, BBB A+ Rating, 2,300+ completed projects, 4.9 stars on Google (500+ reviews), Licensed and fully insured, 8+ years in business',
  tone: 'Professional, reassuring, authoritative. Speak with confidence but empathy. The homeowner is stressed — acknowledge their situation and show expertise without being pushy.',
  ad_copy_rules: {
    tone_descriptors: ['professional', 'reassuring', 'authoritative', 'empathetic'],
    banned_words: ['cheap', 'guarantee', 'best', '#1', 'act now'],
    required_disclaimers: ['Licensed and insured', 'Results may vary'],
    platform_rules: {
      google: { headline_max_chars: 30, description_max_chars: 90 },
      meta: { primary_text_max_chars: 125, headline_max_chars: 40 },
      youtube: {},
    },
    brand_constraints: 'Never use all caps. Always include company name in first headline. No exclamation marks in Google Ads.',
    compliance_notes: 'No income claims. No before/after photos without consent. All stats must be verifiable.',
  },
  ad_copy_notes: 'Focus on the free inspection offer as the primary hook. Emphasize the insurance claim assistance — this is our biggest differentiator. Avoid fear-mongering language; be factual about risks.',
  competitors: [
    { name: 'StormGuard Roofing', website: 'https://stormguardroofing.com', notes: 'Largest competitor. Heavy Meta ad spend. Similar free inspection offer.' },
    { name: 'DFW Roof Pros', website: 'https://dfwroofpros.com', notes: 'Lower prices, aggressive discounting. Less established brand.' },
    { name: 'Apex Restoration', website: 'https://apexrestoration.com', notes: 'Full restoration services. Higher price point. Premium positioning.' },
  ],
}

export default function BusinessOverviewPage() {
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Overview</h1>
          <p className="page-subtitle">Foundation data that powers all AI generation</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(!editing)}>
          {editing ? 'Save Changes' : 'Edit'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Company Info */}
        <div className="card">
          <div className="card-title">Company Info</div>
          <div className="detail-grid" style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="detail-item">
                <span className="detail-label">Business Name</span>
                <span className="detail-value">{mockClient.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Website</span>
                <span className="detail-value">{mockClient.website}</span>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Business Summary</span>
              <span className="detail-value">{mockClient.business_summary}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Services</span>
              <span className="detail-value">{mockClient.services}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Differentiators</span>
              <span className="detail-value">{mockClient.differentiators}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Trust Signals</span>
              <span className="detail-value">{mockClient.trust_signals}</span>
            </div>
          </div>
        </div>

        {/* Ad Copy Rules */}
        <div className="card">
          <div className="card-title">Ad Copy Rules &amp; Guidelines</div>
          <div className="detail-grid" style={{ marginTop: 16 }}>
            <div className="detail-item">
              <span className="detail-label">Tone</span>
              <div className="tag-list">
                {mockClient.ad_copy_rules.tone_descriptors.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Banned Words</span>
              <div className="tag-list">
                {mockClient.ad_copy_rules.banned_words.map((w) => (
                  <span key={w} className="tag" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{w}</span>
                ))}
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Required Disclaimers</span>
              <div className="tag-list">
                {mockClient.ad_copy_rules.required_disclaimers.map((d) => (
                  <span key={d} className="tag">{d}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="detail-item">
                <span className="detail-label">Google Ads Limits</span>
                <span className="detail-value">
                  Headlines: {mockClient.ad_copy_rules.platform_rules.google.headline_max_chars} chars |
                  Descriptions: {mockClient.ad_copy_rules.platform_rules.google.description_max_chars} chars
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Meta Ads Limits</span>
                <span className="detail-value">
                  Primary text: {mockClient.ad_copy_rules.platform_rules.meta.primary_text_max_chars} chars |
                  Headlines: {mockClient.ad_copy_rules.platform_rules.meta.headline_max_chars} chars
                </span>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Brand Constraints</span>
              <span className="detail-value">{mockClient.ad_copy_rules.brand_constraints}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Compliance Notes</span>
              <span className="detail-value">{mockClient.ad_copy_rules.compliance_notes}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Additional Copy Notes</span>
              <span className="detail-value">{mockClient.ad_copy_notes}</span>
            </div>
          </div>
        </div>

        {/* Competitors */}
        <div className="card">
          <div className="card-title">Competitors</div>
          <div style={{ marginTop: 16 }}>
            {mockClient.competitors.map((c) => (
              <div key={c.name} className="copy-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{c.website}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{c.notes}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call Notes */}
        <div className="card">
          <div className="card-title">Call Notes / Raw Inputs</div>
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-text">No call notes uploaded yet</div>
            <div className="empty-state-sub">Upload call transcripts, documents, or paste notes here</div>
            <button className="btn btn-secondary" style={{ marginTop: 16 }}>Upload Materials</button>
          </div>
        </div>
      </div>
    </div>
  )
}
