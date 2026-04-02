'use client'

import { useAppStore } from '@/lib/store'

export default function ClientLandingPagesPage() {
  const { client, publishedPages } = useAppStore()

  if (!client) return null

  const livePages = publishedPages.filter(p => p.status === 'published')
  const draftPages = publishedPages.filter(p => p.status === 'draft')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Landing Pages</h1>
          <p className="page-subtitle">Your published landing pages</p>
        </div>
      </div>

      {publishedPages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128196;</div>
          <div className="empty-state-text">No Landing Pages Yet</div>
          <div className="empty-state-sub">
            Your agency team is working on building landing pages for your campaigns.
            They will appear here once published.
          </div>
        </div>
      ) : (
        <>
          {/* Live pages */}
          {livePages.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                Live Pages ({livePages.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {livePages.map((page) => {
                  const pageUrl = page.custom_domain
                    ? `https://${page.custom_domain}/${page.slug}`
                    : `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${page.client_slug || client.id}/${page.slug}`

                  return (
                    <div key={page.id} className="funnel-section-card" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {page.slug}
                          </h3>
                          {page.slug && (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                              /{page.slug}
                            </div>
                          )}
                          <a
                            href={pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 13,
                              color: 'var(--accent)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            View Page &#8599;
                          </a>
                        </div>
                        <span className="badge badge-approved" style={{ flexShrink: 0, fontSize: 11 }}>
                          Live
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Draft pages */}
          {draftPages.length > 0 && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)' }}>
                In Progress ({draftPages.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {draftPages.map((page) => (
                  <div key={page.id} className="funnel-section-card" style={{ padding: '20px', opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {page.slug || 'Untitled Page'}
                        </h3>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          Being built by your agency team
                        </div>
                      </div>
                      <span className="badge badge-pending" style={{ flexShrink: 0, fontSize: 11 }}>
                        Draft
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
