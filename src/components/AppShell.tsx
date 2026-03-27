'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname?.startsWith('/login')

  // Login page renders full-screen without shell
  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Header />
        <main className="content-area">
          <div className="bg-watermark" aria-hidden="true" />
          {children}
        </main>
      </div>
    </div>
  )
}
