'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/dashboard/', label: 'Dashboard', icon: '◫' },
  { href: '/business-overview/', label: 'Business Overview', icon: '◨' },
  { href: '/intake/', label: 'Intake', icon: '◧' },
  { href: '/avatars/', label: 'Avatars', icon: '◪' },
  { href: '/offers/', label: 'Offers', icon: '◭' },
  { href: '/funnel/', label: 'Funnel', icon: '◬' },
  { href: '/competitive-intel/', label: 'Competitive Intel', icon: '◮' },
  { href: '/landing-pages/', label: 'Landing Pages', icon: '◰' },
  { href: '/stats/', label: 'Stats', icon: '◩' },
  { href: '/settings/', label: 'Settings', icon: '◷' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close on escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        <span className={`hamburger ${mobileOpen ? 'open' : ''}`}>
          <span /><span /><span />
        </span>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logical-boost-hub/images/logow.png" alt="LogicalBoost" className="sidebar-logo-img" />
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(`/logical-boost-hub${item.href}`.replace(/\/$/, '')) || false
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
