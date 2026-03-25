import './globals.css'
import AppShell from '@/components/AppShell'
import { AppProvider } from '@/lib/store'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata = {
  title: 'Logical Boost Hub',
  description: 'Multi-tenant marketing platform',
}

export default function RootLayout({
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
