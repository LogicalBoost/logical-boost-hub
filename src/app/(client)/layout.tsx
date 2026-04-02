import '../(hub)/globals.css'
import { AppProvider } from '@/lib/store'
import { AuthProvider } from '@/components/AuthProvider'
import ClientShell from '@/components/ClientShell'

export const metadata = {
  title: 'Logical Boost Hub',
  description: 'Client Portal',
  icons: {
    icon: '/images/icon.png',
    apple: '/images/icon.png',
  },
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AuthProvider>
            <ClientShell>{children}</ClientShell>
          </AuthProvider>
        </AppProvider>
      </body>
    </html>
  )
}
