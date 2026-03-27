'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

const COLLAPSED_KEY = 'lbh_sidebar_collapsed'

const navItems = [
  { href: '/dashboard/', label: 'Dashboard', icon: '◫' },
  { href: '/stats/', label: 'Stats', icon: '◩' },
  { href: '/copy/', label: 'Copy', icon: '◬' },
  { href: '/landing-pages/', label: 'Landing Pages', icon: '◰' },
  { href: '/avatars/', label: 'Avatars', icon: '◪' },
  { href: '/offers/', label: 'Offers', icon: '◭' },
  { href: '/competitor-intel/', label: 'Competitor Intel', icon: '◮' },
  { href: '/settings/', label: 'Settings', icon: '◷' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY)
      if (saved === 'true') setCollapsed(true)
    } catch { /* storage unavailable */ }
  }, [])

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(COLLAPSED_KEY, String(next)) } catch {}
      return next
    })
  }, [])

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

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-logo">
          {!collapsed && (
            <>
              <img src="/logical-boost-hub/images/logow.png" alt="LogicalBoost" className="sidebar-logo-img" />
              <span className="beta-badge">BETA</span>
            </>
          )}
          {collapsed && (
            <img src="/logical-boost-hub/images/icon.png" alt="LB" className="sidebar-logo-icon" style={{ height: 28, width: 28, objectFit: 'contain' }} />
          )}
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(`/logical-boost-hub${item.href}`.replace(/\/$/, '')) || false
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        {/* Collapse toggle button */}
        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span style={{ transform: collapsed ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>
            &#9664;
          </span>
        </button>
      </aside>
    </>
  )
}
