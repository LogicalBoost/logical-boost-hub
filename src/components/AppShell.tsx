'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuth } from './AuthProvider'
import { useAppStore } from '@/lib/store'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname?.startsWith('/login')
  const isLandingPage = pathname?.startsWith('/p/')
  const isClientRoute = pathname?.startsWith('/client')
  const { profile } = useAuth()
  const { client } = useAppStore()

  // Login, landing pages, and client routes render without agency shell
  if (isLoginPage || isLandingPage || isClientRoute) {
    return <>{children}</>
  }

  // For client-role users: block page content until their client is loaded
  // Header handles the auto-selection — we just wait for it to finish
  const isClientRole = profile?.role === 'client'
  const clientReady = !isClientRole || !!client

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Header />
        <main className="content-area">
          <div className="bg-watermark" aria-hidden="true" />
          {clientReady ? children : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 300,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>&#9881;&#65039;</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading your account...</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
