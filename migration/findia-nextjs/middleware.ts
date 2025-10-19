import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    console.log('Middleware called:', { 
      pathname, 
      hasToken: !!token, 
      tokenSub: token?.sub,
      url: req.url 
    })

    // Redirect authenticated users from root to dashboard
    if (token && pathname === '/') {
      console.log('Redirecting authenticated user from home to dashboard')
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Redirect unauthenticated users from protected routes
    if (!token && pathname.startsWith('/dashboard')) {
      console.log('Redirecting unauthenticated user from dashboard to home')
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: () => {
        // This callback determines if the request is authorized
        // For our use case, we want to run middleware for all requests
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}