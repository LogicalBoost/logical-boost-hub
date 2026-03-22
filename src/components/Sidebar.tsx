'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '◫' },
  { href: '/stats', label: 'Stats', icon: '◩' },
  { href: '/funnel', label: 'Funnel', icon: '◬' },
  { href: '/business-overview', label: 'Business Overview', icon: '◨' },
  { href: '/intake', label: 'Intake', icon: '◧' },
  { href: '/avatars', label: 'Avatars', icon: '◪' },
  { href: '/offers', label: 'Offers', icon: '◭' },
  { href: '/competitor-ads', label: 'Competitor Ads', icon: '◮' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const basePath = '/logical-boost-hub'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>
          <span>Logical</span> Boost Hub
        </h1>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const fullHref = `${basePath}${item.href}`
          const isActive = pathname === fullHref || pathname === item.href
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
