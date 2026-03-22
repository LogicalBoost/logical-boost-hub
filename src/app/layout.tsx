import './globals.css'
import AppShell from '@/components/AppShell'

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
