import './globals.css'
import AppShell from '@/components/AppShell'
import { AppProvider } from '@/lib/store'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata = {
  title: 'Logical Boost Hub',
  description: 'Multi-tenant marketing platform',
  icons: {
    icon: '/images/icon.png',
    apple: '/images/icon.png',
  },
}

export default function HubLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </AppProvider>
      </body>
    </html>
  )
}
