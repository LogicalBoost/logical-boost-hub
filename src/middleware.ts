import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that are public (no auth needed)
const PUBLIC_ROUTES = ['/login', '/p/']
// Static assets
const SKIP_PREFIXES = ['/_next', '/api', '/images', '/favicon']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets
  if (SKIP_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Root URL → always redirect to /login
  // AuthProvider on the login page will redirect authenticated users to their dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
