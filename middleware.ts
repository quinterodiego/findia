import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl
    
    // Skip middleware for API routes, static files, etc.
    if (
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/manifest.json') ||
      pathname.includes('.')
    ) {
      return NextResponse.next()
    }

    // For now, let all requests pass through
    // We'll handle authentication redirects in the client side
    return NextResponse.next()
  } catch {
    // If anything fails, just continue
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except API routes, static files, and assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
}