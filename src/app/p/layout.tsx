import './landing-page.css'

export const metadata = {
  title: 'Landing Page',
}

export default function LandingPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
